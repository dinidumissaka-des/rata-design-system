/**
 * Does every name the lookup commands accept mean exactly one thing — and do
 * the install and lookup surfaces agree about which names exist at all?
 *
 * Two bugs prompted this, both found by auditing rather than by use, and both
 * of the kind this repo's first rule is about: a confident wrong answer.
 *
 * ONE: `resolveComponent` returned the FIRST alias match in key order and
 * announced it as the answer. Three aliases name two components each, and
 * `drawer` is the one that bites — it is a Sheet held against an edge, and it
 * is also MobileNav, a drawer holding a SideNav. `rata props drawer` said
 * "drawer is mobile-nav in this system" with no hint a choice had been made,
 * so someone wanting an edge-anchored panel was handed a component requiring
 * a `sections` prop.
 *
 * TWO: the lookup commands resolved aliases and the install command did not.
 * `rata props bottom-sheet` answered, and `rata add bottom-sheet` replied
 * "Unknown component" about the same name in the same session.
 *
 * What this asserts is the CONTRACT of the resolver, not that ambiguity is
 * absent — `drawer` genuinely means both, and refusing to choose is the right
 * answer rather than a gap to close.
 */
import { loadRegistry, resolveComponent } from "../packages/cli/lib/index.mjs";
import { resolveClosure } from "../packages/cli/lib/install-plan.mjs";

async function main() {
  const registry = await loadRegistry();
  const problems = [];

  const aliasOwners = new Map();
  for (const [canonical, entry] of Object.entries(registry)) {
    for (const alias of entry.alsoKnownAs ?? []) {
      if (!aliasOwners.has(alias)) aliasOwners.set(alias, []);
      aliasOwners.get(alias).push(canonical);
    }
  }

  let unique = 0;
  const ambiguous = [];

  for (const [alias, owners] of [...aliasOwners].sort()) {
    // An alias must never shadow a real component name: the canonical name
    // has to win, or asking for a component by its own name could answer
    // with a different one.
    if (registry[alias]) {
      problems.push(
        `"${alias}" is both a component name and an alias of ${owners.join(", ")} — ` +
          `the canonical name must be the only meaning`,
      );
      continue;
    }

    const resolved = resolveComponent(alias, registry);

    if (owners.length > 1) {
      ambiguous.push(`${alias} → ${owners.join(" | ")}`);
      if (!resolved.ambiguous) {
        problems.push(
          `"${alias}" names ${owners.length} components (${owners.join(", ")}) but ` +
            `resolveComponent picked ${resolved.name ?? "nothing"} instead of reporting ` +
            `the ambiguity — this is the silent wrong answer the resolver exists to avoid`,
        );
      }
      // And the install surface must refuse it for the same reason.
      const closure = resolveClosure([alias], registry);
      if (!closure.error) {
        problems.push(`\`rata add ${alias}\` installed something despite ${alias} being ambiguous`);
      }
      continue;
    }

    unique++;
    if (resolved.name !== owners[0]) {
      problems.push(
        `"${alias}" should resolve to ${owners[0]} but resolveComponent gave ` +
          `${resolved.name ?? "nothing"}`,
      );
    }
    // The install surface must accept every name the lookup surface does.
    const closure = resolveClosure([alias], registry);
    if (closure.error) {
      problems.push(
        `\`rata add ${alias}\` fails ("${closure.error}") while \`rata props ${alias}\` ` +
          `resolves to ${owners[0]} — the two surfaces disagree about what names exist`,
      );
    } else if (!closure.resolved.has(owners[0])) {
      problems.push(`\`rata add ${alias}\` did not include ${owners[0]} in its closure`);
    }
  }

  if (problems.length > 0) {
    console.error("✖ alias resolution is not sound:\n");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `alias resolution is sound — ${unique} alias(es) resolve to one component and install, ` +
      `${ambiguous.length} are ambiguous and refuse to guess.`,
  );
  for (const line of ambiguous) console.log(`    ambiguous: ${line}`);
}

/**
 * The resolver's contract, against a registry small enough to reason about.
 * The ambiguous case is the one that regressed; the canonical-wins case is
 * what stops a fix for it breaking ordinary lookups.
 */
function selfTest() {
  const registry = {
    sheet: { alsoKnownAs: ["bottom-sheet", "drawer"] },
    "mobile-nav": { alsoKnownAs: ["drawer"] },
    panel: { alsoKnownAs: ["inspector"] },
    // A component whose own NAME is another's alias would be a bug, but the
    // resolver still has to prefer the canonical meaning if it ever happens.
    inspector: {},
  };

  const cases = [
    {
      name: "a canonical name resolves to itself, with no via",
      run: () => resolveComponent("sheet", registry),
      ok: (r) => r.name === "sheet" && r.via === undefined && !r.ambiguous,
    },
    {
      name: "a unique alias resolves and reports what it came through",
      run: () => resolveComponent("bottom-sheet", registry),
      ok: (r) => r.name === "sheet" && r.via === "bottom-sheet" && !r.ambiguous,
    },
    {
      name: "an alias naming two components reports BOTH and picks neither",
      run: () => resolveComponent("drawer", registry),
      ok: (r) =>
        r.name === undefined &&
        Array.isArray(r.ambiguous) &&
        r.ambiguous.length === 2 &&
        r.ambiguous.includes("sheet") &&
        r.ambiguous.includes("mobile-nav"),
    },
    {
      name: "the candidate list is ordered, so the message does not vary by key order",
      run: () => resolveComponent("drawer", registry),
      ok: (r) => r.ambiguous.join(",") === "mobile-nav,sheet",
    },
    {
      name: "a canonical name wins over another component's alias of it",
      run: () => resolveComponent("inspector", registry),
      ok: (r) => r.name === "inspector" && r.via === undefined,
    },
    {
      name: "an unknown name resolves to nothing at all",
      run: () => resolveComponent("card", registry),
      ok: (r) => r.name === undefined && r.entry === undefined && !r.ambiguous,
    },
  ];

  let failed = 0;
  for (const { name, run, ok } of cases) {
    let pass = false;
    let got;
    try {
      got = run();
      pass = ok(got);
    } catch (error) {
      got = `threw ${error.message}`;
    }
    console.log(`  ${pass ? "✓" : "✖"} ${name}`);
    if (!pass) {
      console.log(`      got ${JSON.stringify(got)}`);
      failed++;
    }
  }
  if (failed > 0) {
    console.error(`\n✖ the resolver's contract is broken: ${failed} case(s) wrong`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nthe resolver holds its contract: ${cases.length} cases.`);
}

if (process.argv.includes("--self-test")) selfTest();
else await main();
