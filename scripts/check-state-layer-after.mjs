#!/usr/bin/env node
// Find components that compose `.rata-state-layer` and also style `::after`.
//
// The state layer OWNS `::after` — that is where it draws the hover and press
// tint, parked at `opacity: 0` until one of them happens. An element has only
// one `::after`, so a second rule targeting it on the same element does not
// get a pseudo-element of its own: the declarations merge, and the layer's
// zero opacity is inherited by whatever the component was trying to draw. The
// result is an indicator that is simply not there.
//
// This shipped in Tabs. The selected tab's marker was invisible, and the CSS
// looked correct in isolation — which is the point of the check.
//
// IT HAS TO READ BOTH HALVES, which is why it is a script and not a vibe rule.
// The composition lives in the React file (`className="rata-tabs-tab
// rata-state-layer"`) and the offending rule lives in the stylesheet
// (`.rata-tabs-tab[aria-selected="true"]::after`). Neither file is wrong on
// its own, and a linter looking at either one alone — which is what a vibe
// rule does — cannot see the collision at all. The first version of this was
// a vibe rule and could never have fired.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Classes that appear alongside `rata-state-layer` in a className. */
export function composedClasses(source) {
  const found = new Set();
  // className="a b c" and cx("a", cond && "b") both put the names in string
  // literals near each other; a literal containing the layer is the signal.
  for (const m of source.matchAll(/["'`]([^"'`]*rata-state-layer[^"'`]*)["'`]/g)) {
    for (const cls of m[1].split(/\s+/)) {
      if (cls.startsWith("rata-") && !cls.startsWith("rata-state-layer")) found.add(cls);
    }
  }
  // `cx("rata-tabs-tab", "rata-state-layer")` — separate literals in one call.
  for (const call of source.matchAll(/cx\(([\s\S]*?)\)|className=\{cx\(([\s\S]*?)\)\}/g)) {
    const body = call[1] ?? call[2] ?? "";
    if (!body.includes("rata-state-layer")) continue;
    for (const lit of body.matchAll(/["'`]([A-Za-z0-9_ -]*)["'`]/g)) {
      for (const cls of lit[1].split(/\s+/)) {
        if (cls.startsWith("rata-") && !cls.startsWith("rata-state-layer")) found.add(cls);
      }
    }
  }
  return found;
}

/** `::after` rules in a stylesheet, as [selector, line]. */
export function afterRules(css) {
  const rules = [];
  for (const m of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim().split("\n").pop().trim();
    if (!selector || selector.startsWith("@") || !/::after\b/.test(selector)) continue;
    rules.push([selector, css.slice(0, m.index).split("\n").length]);
  }
  return rules;
}

export function collisions(reactSource, css, cssName) {
  const composed = composedClasses(reactSource);
  const problems = [];
  for (const [selector, line] of afterRules(css)) {
    // The layer's own rules, and a host opting out of its bleed, both name it.
    if (/\.rata-state-layer/.test(selector)) continue;
    for (const cls of composed) {
      if (selector.includes(`.${cls}`)) {
        problems.push(
          `${cssName}:${line} — \`${selector}\` styles ::after on .${cls}, which composes ` +
            `.rata-state-layer in the React source. The layer already owns that ` +
            `pseudo-element at opacity 0, so the two merge and this will not be visible. ` +
            `Use ::before.`
        );
        break;
      }
    }
  }
  return problems;
}

const PLANTED = {
  react: `<button className={cx("rata-thing", "rata-state-layer")} />`,
  css: `.rata-thing[aria-selected="true"]::after { content: ""; background: red; }`,
};
const LEGITIMATE = {
  react: `<button className="rata-thing rata-state-layer rata-state-layer--flush" />`,
  css: `.rata-thing[aria-selected="true"]::before { content: ""; }
.rata-thing.rata-state-layer::after { inset: 0; }`,
};

async function selfTest() {
  let failed = 0;
  if (collisions(PLANTED.react, PLANTED.css, "planted.css").length === 0) {
    console.error("✖ self-test: missed a planted ::after collision");
    failed += 1;
  }
  const cried = collisions(LEGITIMATE.react, LEGITIMATE.css, "planted.css");
  if (cried.length > 0) {
    console.error(`✖ self-test: flagged correct code — ${cried[0]}`);
    failed += 1;
  }
  if (failed) {
    console.error("\nThe checker cannot be trusted until these pass.");
    process.exit(1);
  }
  console.log("state-layer/::after self-test passed — collision caught, correct code left alone.");
}

if (process.argv.includes("--self-test")) {
  await selfTest();
} else {
  const problems = [];
  const cssDir = "packages/css/src";
  for (const entry of await readdir(path.join(repoRoot, cssDir))) {
    if (!entry.endsWith(".css")) continue;
    const name = entry.replace(/\.css$/, "");
    for (const dir of ["packages/react/src", "packages/icons/src"]) {
      const reactPath = path.join(repoRoot, dir, `${name}.tsx`);
      let reactSource;
      try {
        reactSource = await readFile(reactPath, "utf8");
      } catch {
        continue;
      }
      problems.push(
        ...collisions(reactSource, await readFile(path.join(repoRoot, cssDir, entry), "utf8"), `${cssDir}/${entry}`)
      );
    }
  }
  if (problems.length) {
    console.error("✖ ::after collides with the state layer:\n");
    for (const p of problems) console.error(`  - ${p}\n`);
    process.exit(1);
  }
  console.log("no ::after collides with .rata-state-layer.");
}
