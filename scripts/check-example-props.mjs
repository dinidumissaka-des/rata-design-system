/**
 * Do the contracts' worked examples use props that exist?
 *
 * This is the one failure CLAUDE.md opens with — `<Button kind="primary">`
 * instead of `variant` — and the examples were the one place nothing checked
 * for it. The build already fails if a manifest DOCUMENTS a prop that no
 * longer exists, and `vibe` lints the examples for token discipline, but a
 * JSX attribute inside `usage[].example` was never compared against the
 * component's real API.
 *
 * Three were wrong when this was written, all the same mistake — `items` for
 * a prop that is called something else:
 *
 *   sheet.md      <SegmentedControl items={…}>   it takes `options`
 *   sheet.md      <RadioGroup items={…}>         it takes children
 *   top-nav.md    <SideNav items={…}>            it takes `sections`
 *
 * These matter more than an ordinary typo. The contract page is what an agent
 * is pointed at INSTEAD of guessing, so a wrong prop there does not just fail
 * to help — it actively teaches the wrong name, with the authority of
 * generated documentation.
 *
 * WHY THERE IS AN ALLOWLIST. Every component spreads the DOM attributes of
 * the element it renders, so `className`, `onClick` and `href` are all valid
 * without appearing in its own props. The allowlist is generous on purpose:
 * this check is worth having only if its findings are all real, so it is
 * tuned to miss some bad attributes rather than to flag good ones.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { loadRegistry, getComponentProps } from "../packages/cli/lib/index.mjs";

const root = path.resolve(import.meta.dirname, "..");

/**
 * Attributes any component may take because it spreads its element's props.
 * Not exhaustive, and deliberately so — see the note above.
 */
const DOM_ATTRIBUTES = new Set(
  `className style id key ref title role tabIndex type name value defaultValue
   placeholder disabled checked defaultChecked required readOnly autoComplete
   autoFocus href target rel src alt width height hidden htmlFor form action
   method min max step pattern rows cols multiple selected open colSpan rowSpan
   scope children
   onClick onChange onInput onSubmit onKeyDown onKeyUp onFocus onBlur
   onMouseDown onMouseUp onMouseEnter onMouseLeave onPointerDown`.split(/\s+/),
);

const kebab = (pascal) => pascal.replace(/(?<!^)(?=[A-Z])/g, "-").toLowerCase();

/** Every `<Tag attr=` pair in a snippet, as [tag, attribute] entries. */
export function jsxAttributes(snippet) {
  const out = [];
  for (const tag of snippet.matchAll(/<([A-Z]\w*)((?:\s+[^<>]*?)?)\/?>/gs)) {
    for (const attr of tag[2].matchAll(/(?:^|\s)([a-zA-Z][a-zA-Z0-9-]*)\s*=/g)) {
      out.push([tag[1], attr[1]]);
    }
  }
  return out;
}

export function unknownAttributes(snippet, propsByComponent) {
  const problems = [];
  for (const [tag, attr] of jsxAttributes(snippet)) {
    const name = kebab(tag);
    const known = propsByComponent.get(name);
    // A tag this system does not own — `<RecordDetail>`, `<Wordmark>` — is the
    // caller's own component and none of this check's business.
    if (known === undefined) continue;
    if (attr.startsWith("aria-") || attr.startsWith("data-")) continue;
    if (known.has(attr) || DOM_ATTRIBUTES.has(attr)) continue;
    problems.push({ tag, attr, name, known: [...known].sort() });
  }
  return problems;
}

async function main() {
  const registry = await loadRegistry();

  // The same parser the docs derive from, so this can never disagree with the
  // page it is checking.
  const propsByComponent = new Map();
  for (const name of Object.keys(registry)) {
    const parsed = await getComponentProps(name, registry);
    if (!parsed.implemented || !parsed.props) continue;
    propsByComponent.set(name, new Set(parsed.props.map((p) => p.name)));
  }

  const problems = [];
  for (const [name, entry] of Object.entries(registry).sort()) {
    for (const usage of entry.usage ?? []) {
      for (const found of unknownAttributes(usage.example ?? "", propsByComponent)) {
        problems.push(
          `${name}.json "${usage.case}": <${found.tag} ${found.attr}=…> — ` +
            `${found.name} has no "${found.attr}" prop. It takes: ${found.known.join(", ")}`,
        );
      }
    }
  }

  if (problems.length > 0) {
    console.error("✖ a contract example uses a prop that does not exist:\n");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(
      "\nThese pages are what an agent reads INSTEAD of guessing, so a wrong " +
        "prop here teaches the wrong name with the authority of generated docs.",
    );
    process.exitCode = 1;
    return;
  }

  const examples = Object.values(registry).reduce((n, e) => n + (e.usage?.length ?? 0), 0);
  console.log(
    `every prop in every contract example exists — ${examples} examples across ` +
      `${propsByComponent.size} components with a parsed API.`,
  );
}

/** Positives that must be caught, and the negatives that make it usable. */
function selfTest() {
  const props = new Map([
    ["button", new Set(["variant", "size", "iconOnly", "loading", "disabled"])],
    ["segmented-control", new Set(["options", "value", "onValueChange", "label"])],
    ["side-nav", new Set(["sections", "label"])],
  ]);

  const cases = [
    {
      name: "the canonical wrong prop — kind for variant",
      snippet: '<Button kind="primary">Save</Button>',
      expect: ["kind"],
    },
    {
      name: "items where the component takes options",
      snippet: "<SegmentedControl label=\"P\" items={[]} />",
      expect: ["items"],
    },
    {
      name: "items where the component takes sections",
      snippet: "<SideNav label=\"Invoices\" items={pages} />",
      expect: ["items"],
    },
    {
      name: "a real prop passes",
      snippet: '<Button variant="secondary" size="sm">Save</Button>',
      expect: [],
    },
    {
      name: "a DOM attribute passes, because every component spreads them",
      snippet: '<Button className="x" onClick={go} aria-label="Save" data-id="1" />',
      expect: [],
    },
    {
      name: "a component this system does not own is left alone",
      snippet: "<RecordDetail record={r} anything={1} />",
      expect: [],
    },
    {
      name: "attributes are read across a multi-line tag",
      snippet: '<Button\n  variant="primary"\n  kind="x"\n>\n  Save\n</Button>',
      expect: ["kind"],
    },
    {
      name: "a nested tag's attributes are read too",
      snippet: "<SideNav sections={s}>\n  <Button kind=\"y\" />\n</SideNav>",
      expect: ["kind"],
    },
  ];

  let failed = 0;
  for (const { name, snippet, expect } of cases) {
    const got = unknownAttributes(snippet, props).map((p) => p.attr);
    const ok = got.length === expect.length && got.every((v, i) => v === expect[i]);
    console.log(`  ${ok ? "✓" : "✖"} ${name}`);
    if (!ok) {
      console.log(`      expected [${expect}], got [${got}]`);
      failed++;
    }
  }
  if (failed > 0) {
    console.error(`\n✖ the example scanner is not discriminating: ${failed} case(s) wrong`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nthe scanner bites: ${cases.length} cases, positives and negatives both.`);
}

if (process.argv.includes("--self-test")) selfTest();
else await main();
