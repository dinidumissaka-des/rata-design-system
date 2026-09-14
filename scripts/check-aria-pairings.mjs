#!/usr/bin/env node
// Find ARIA attributes paired with a role that does not support them.
//
// This exists because that bug shipped: MenuItem set `aria-checked` alongside
// `role="menuitem"`, which ARIA allows only on `menuitemradio` and
// `menuitemcheckbox`. An unsupported attribute may simply be dropped, and the
// selected row of a view switcher would then be distinguished by colour alone.
// Nothing else catches it — it typechecks, it renders, and the attribute is
// right there in the markup looking correct.
//
// IT SELF-TESTS, and that is not decoration. The first version of this sweep
// used a regex to find JSX tags, which fails on attribute values containing
// `=>` — it reported zero findings on a file with three planted bugs. A
// detector that cannot bite is worse than no detector, because it certifies
// the thing it failed to read. `--self-test` plants known bugs and fails if
// any goes unfound.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Attribute → roles that do NOT support it. Deliberately narrow. */
const FORBIDDEN = {
  "aria-checked": [
    "menuitem", "button", "link", "tab", "img", "status", "alert",
    "dialog", "search", "navigation", "banner", "group", "separator",
  ],
  "aria-selected": ["menuitem", "menuitemradio", "button", "link", "checkbox", "switch", "radio"],
  "aria-pressed": ["menuitem", "link", "checkbox", "switch", "radio", "searchbox"],
  "aria-expanded": ["img", "separator", "status", "alert"],
};

const CURRENT_VALUES = new Set(["page", "step", "location", "date", "time", "true", "false"]);

/**
 * Elements whose implicit role prohibits naming, so an `aria-label` on them is
 * discarded. `div`/`span` are `generic` and `p` is `paragraph`.
 *
 * NOT `ul`/`ol`/`li`: those are `list`/`listitem`, which do support a name —
 * an earlier version of this check flagged SideNav's labelled list wrongly.
 */
const NAME_PROHIBITED = new Set(["div", "span", "p", "strong", "em", "small"]);

/**
 * Every JSX opening tag as [name, attributeText].
 *
 * Walked rather than matched, tracking brace and quote depth, because an
 * attribute value can contain `>` — `onClick={() => x}` being the ordinary
 * case that breaks a regex.
 */
function* tags(source) {
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] !== "<") continue;
    const opening = /^<([a-zA-Z][\w.]*)/.exec(source.slice(i));
    if (opening === null) continue;

    let j = i + opening[0].length;
    let depth = 0;
    let quote = null;
    for (; j < source.length; j += 1) {
      const c = source[j];
      if (quote !== null) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'" || c === "`") {
        quote = c;
      } else if (c === "{") {
        depth += 1;
      } else if (c === "}") {
        depth -= 1;
      } else if (c === ">" && depth === 0) {
        break;
      }
    }
    yield [opening[1], source.slice(i + opening[0].length, j)];
    i = j;
  }
}

export function sweepSource(source, name) {
  const problems = [];
  for (const [tag, attrs] of tags(source)) {
    const role = /role=\{?["']([a-z]+)["']/.exec(attrs);

    if (role !== null) {
      for (const [attr, badRoles] of Object.entries(FORBIDDEN)) {
        if (new RegExp(`\\b${attr}=`).test(attrs) && badRoles.includes(role[1])) {
          problems.push(`${name}: <${tag} role="${role[1]}"> carries ${attr}, which that role does not support`);
        }
      }
      continue;
    }

    // A role attribute that is present but not a literal — `role={decorative
    // ? undefined : "img"}`, which both Avatar and Spinner use — cannot be
    // read statically, so neither rule can be applied honestly. Skipped
    // rather than guessed: those two were the checker's first false
    // positives, and a checker that cries wolf gets switched off.
    if (/\brole=/.test(attrs)) continue;

    if (NAME_PROHIBITED.has(tag)) {
      for (const attr of ["aria-label", "aria-labelledby"]) {
        if (new RegExp(`\\b${attr}=`).test(attrs)) {
          problems.push(`${name}: <${tag}> has ${attr} but no role to carry it — the name is discarded`);
        }
      }
    }
  }

  for (const m of source.matchAll(/aria-current=\{?["']([a-z]+)["']/g)) {
    if (!CURRENT_VALUES.has(m[1])) {
      problems.push(`${name}: aria-current="${m[1]}" is not one of ${[...CURRENT_VALUES].join(", ")}`);
    }
  }
  return problems;
}

const PLANTED = [
  {
    name: "role that cannot be checked",
    source: `<button role="menuitem" aria-checked={true} onClick={() => pick("a")}>x</button>`,
  },
  { name: "attribute behind an arrow function", source: `<div role="img" onClick={() => a > b} aria-expanded={false} />` },
  { name: "invalid aria-current token", source: `<a href="/" aria-current="active">y</a>` },
  { name: "name on an element that cannot carry one", source: `<span aria-label="Hello" />` },
];

/** Shapes that are correct and must never be flagged. */
const LEGITIMATE = [
  {
    name: "a labelled list, which does support a name",
    source: `<ul aria-labelledby={labelId}><li><a href="/" aria-current="page">x</a></li></ul>`,
  },
  {
    name: "a conditional role, which cannot be read statically",
    source: `<span role={decorative ? undefined : "img"} aria-label={decorative ? undefined : name} />`,
  },
];

async function selfTest() {
  let failed = 0;
  for (const planted of PLANTED) {
    if (sweepSource(planted.source, "planted").length === 0) {
      console.error(`✖ self-test: missed "${planted.name}"`);
      failed += 1;
    }
  }
  // And it must not cry wolf over shapes that are correct.
  for (const legitimate of LEGITIMATE) {
    const cried = sweepSource(legitimate.source, "planted");
    if (cried.length > 0) {
      console.error(`✖ self-test: flagged ${legitimate.name} — ${cried[0]}`);
      failed += 1;
    }
  }
  if (failed) {
    console.error(`\n${failed} self-test failure(s) — the checker cannot be trusted until these pass.`);
    process.exit(1);
  }
  console.log(
    `aria-pairings self-test passed — ${PLANTED.length} planted bugs caught, ` +
      `${LEGITIMATE.length} correct shapes left alone.`
  );
}

async function sources() {
  const found = [];
  for (const dir of ["packages/react/src", "packages/icons/src"]) {
    for (const entry of await readdir(path.join(repoRoot, dir))) {
      if (entry.endsWith(".tsx") && !entry.includes(".test.")) found.push(path.join(dir, entry));
    }
  }
  return found.sort();
}

if (process.argv.includes("--self-test")) {
  await selfTest();
} else {
  const problems = [];
  for (const file of await sources()) {
    problems.push(...sweepSource(await readFile(path.join(repoRoot, file), "utf8"), file));
  }
  if (problems.length) {
    console.error("✖ ARIA attributes paired with roles that do not support them:\n");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`ARIA pairings are valid across ${(await sources()).length} component source(s).`);
}
