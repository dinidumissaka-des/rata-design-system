/**
 * Does each component declare the components it actually uses?
 *
 * `dependencies` in a registry manifest is what the docs page prints as
 * "Depends on" and what a consumer reads before running `rata add`. Nothing
 * was checking it, and two components had drifted: `menu` imported
 * `@rata/icons` without declaring `icon` — alone among eleven importers — and
 * `notice` composed `.rata-state-layer` while declaring only `icon`.
 *
 * WHY THE EXISTING CHECKS MISS THIS. `check-registry-install.mjs` verifies
 * that every RELATIVE import resolves to a file the install writes. Both of
 * these are invisible to it: `@rata/icons` is a bare package specifier rather
 * than a relative one, and a composed CSS class is not an import at all.
 *
 * ONLY THE UNDECLARED DIRECTION IS AN ERROR. "Declares something it does not
 * reference" has legitimate cases — `menu` declares `menu-item` because the
 * rows belong inside it, which is a real relationship that no import
 * expresses. Undeclared is the direction with a consequence: a consumer
 * installs a component whose dependency nothing told them about.
 *
 * Run with --self-test to check the detector still bites. It is here because
 * the first version of this scan reported `button` as needing `icon`, on the
 * strength of `rata-icon-button` — which is Button's own class.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

/** Block, line and JSX comments. A component named in prose is not used. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/**
 * Which components this source actually reaches for.
 *
 * The class matcher allows a BEM-style `--modifier` suffix but not a further
 * `-word`, which is the distinction that separates `.rata-state-layer--flush`
 * (the state layer, modified) from `.rata-icon-button` (Button's own class,
 * nothing to do with Icon). Getting that wrong in either direction is how
 * this scan is useless: too loose and it cries wolf, too tight and it misses
 * every component that only ever uses the modifier form.
 */
export function detectUsed(source, componentNames) {
  const code = stripComments(source);
  const used = new Set();

  for (const match of code.matchAll(/from\s+"\.\/([a-z0-9-]+)\.js"/g)) {
    if (componentNames.has(match[1])) used.add(match[1]);
  }
  if (/from\s+"@rata\/icons"/.test(code)) used.add("icon");

  for (const name of componentNames) {
    const cls = new RegExp(`\\brata-${name}(?:--[\\w-]+)?(?![\\w-])`);
    if (cls.test(code)) used.add(name);
  }
  return used;
}

async function readIfPresent(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

async function main() {
  const dir = path.join(root, "registry/components");
  const manifests = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const registry = new Map();
  for (const file of manifests) {
    const data = JSON.parse(await readFile(path.join(dir, file), "utf8"));
    registry.set(data.name, data);
  }
  const names = new Set(registry.keys());

  const problems = [];
  for (const [name, data] of [...registry].sort()) {
    const sources = (
      await Promise.all([
        readIfPresent(path.join(root, `packages/react/src/${name}.tsx`)),
        readIfPresent(path.join(root, `packages/css/src/${name}.css`)),
      ])
    ).filter((s) => s !== null);
    if (sources.length === 0) continue;

    const declared = new Set(data.dependencies ?? []);
    const used = detectUsed(sources.join("\n"), names);
    used.delete(name);

    for (const dep of [...used].sort()) {
      if (!declared.has(dep)) {
        problems.push(
          `${name}: uses ${dep} but does not declare it — add it to ` +
            `registry/components/${name}.json "dependencies", or stop using it`,
        );
      }
    }
  }

  if (problems.length > 0) {
    console.error("✖ a component uses something it does not declare:\n");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `every component declares what it uses — ${registry.size} manifests checked, ` +
      `imports and composed classes both.`,
  );
}

/**
 * Three cases that must be caught and three that must not. The negatives are
 * the point: two of them are mistakes this detector actually made.
 */
async function selfTest() {
  const names = new Set([
    "icon",
    "state-layer",
    "button",
    "segmented-control",
    "toggle-button",
    "toggle-button-group",
  ]);

  const cases = [
    { name: "a bare @rata/icons import", source: 'import { Icon } from "@rata/icons";', expect: ["icon"] },
    {
      name: "a composed state layer",
      source: 'className="rata-thing rata-state-layer"',
      expect: ["state-layer"],
    },
    {
      name: "the state layer in modifier form only",
      source: 'className="rata-thing rata-state-layer--flush"',
      expect: ["state-layer"],
    },
    {
      name: "a component's own hyphenated class (rata-icon-button is Button's)",
      source: 'iconOnly && "rata-icon-button",',
      expect: [],
    },
    {
      name: "another component named in a comment",
      source: "/* .rata-segmented-control is that component now. */",
      expect: [],
    },
    {
      name: "a longer class that merely starts with a shorter name",
      source: ".rata-toggle-button-group { display: flex; }",
      expect: ["toggle-button-group"],
    },
  ];

  let failed = 0;
  for (const { name, source, expect } of cases) {
    const got = [...detectUsed(source, names)].sort();
    const want = [...expect].sort();
    const ok = got.length === want.length && got.every((v, i) => v === want[i]);
    console.log(`  ${ok ? "✓" : "✖"} ${name}`);
    if (!ok) {
      console.log(`      expected [${want}], got [${got}]`);
      failed++;
    }
  }
  if (failed > 0) {
    console.error(`\n✖ the dependency detector is not discriminating: ${failed} case(s) wrong`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nthe detector bites: ${cases.length} cases, positives and negatives both.`);
}

if (process.argv.includes("--self-test")) await selfTest();
else await main();
