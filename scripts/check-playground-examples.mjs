#!/usr/bin/env node
// The playground's example demos are looked up by the contract's own `case`
// string: `EXAMPLES[contract.name]?.[item.case]`. So a key that does not match
// a real case is unreachable — and it fails SILENTLY, rendering "No live
// specimen for this case." on a card that looks otherwise finished. Nothing
// else catches it: the keys are plain strings, so `tsc` is happy, and the page
// still builds and renders.
//
// That is the same class of drift the contract cross-check exists for — two
// halves that must agree, with only one of them checked — so it gets the same
// treatment: the build fails.
//
// Renaming a usage case in a manifest is what usually breaks this, and the
// break is in a different file from the edit, which is exactly when a silent
// failure survives review.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "apps/playground/src/component-page.tsx";
const APP = "apps/playground/src/app.tsx";

const contracts = JSON.parse(
  await readFile(path.join(repoRoot, "docs/components/contracts.json"), "utf8")
);
const casesByName = new Map(
  contracts.map((c) => [c.name, new Set((c.usage ?? []).map((u) => u.case))])
);

const source = await readFile(path.join(repoRoot, SOURCE), "utf8");

/** The `{ … }` starting at `start`, balanced. Strings here contain no braces. */
function braceBlock(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error(`Unbalanced braces from index ${start} in ${SOURCE}`);
}

/** Top-level component keys of a `const <name> = { … }` map, with their bodies. */
function componentMap(name) {
  const declared = source.indexOf(`const ${name}`);
  if (declared === -1) throw new Error(`Could not find \`const ${name}\` in ${SOURCE}`);
  // Anchored on the assignment rather than the name, because the type
  // annotation in between contains `=>` — matching "up to the first =" stops
  // inside `() => ReactNode` and finds nothing.
  const assignment = /=\s*\{/.exec(source.slice(declared));
  if (assignment === null) throw new Error(`\`const ${name}\` is not an object literal`);
  const block = braceBlock(source, declared + assignment.index + assignment[0].length - 1);

  const found = new Map();
  // Two-space indent is the map's own nesting level, which is what
  // distinguishes a component key from a case key four spaces in.
  const entry = /\n {2}(?:"([^"]+)"|([A-Za-z0-9_$-]+)):\s*\{/g;
  let match;
  while ((match = entry.exec(block)) !== null) {
    const component = match[1] ?? match[2];
    found.set(component, braceBlock(block, entry.lastIndex - 1));
  }
  return found;
}

const problems = [];

// The brand-theme wiring: whatever attribute the generated stylesheets are
// scoped to must be the attribute the playground actually writes.
//
// This missed once and nothing noticed. The rename to Ratā searched for the
// literal string "data-ds-theme", and the playground set the attribute through
// `dataset.dsTheme` — a camelCase key that does not contain that string. So the
// stylesheets moved to [data-rata-theme] while the app went on writing
// data-ds-theme, and no brand theme applied at all. The switcher still looked
// alive, because each swatch carries the attribute itself.
//
// Read out of the built CSS rather than from a shared constant: the stylesheet
// is the thing that has to be satisfied, and a constant would just be a third
// copy of the name to keep in step.
{
  const themeCss = await readFile(
    path.join(repoRoot, "packages/themes/lime/dist/theme.css"),
    "utf8"
  );
  const scoped = /\[data-([a-z-]+)="lime"\]/.exec(themeCss);
  if (scoped === null) {
    problems.push(
      "Could not find a [data-*-theme=\"lime\"] scope in the built lime stylesheet — " +
        "has the theme build changed how it scopes?"
    );
  } else {
    const attribute = `data-${scoped[1]}`;
    // `dataset.fooBar` writes `data-foo-bar`.
    const appSource = await readFile(path.join(repoRoot, APP), "utf8");
    const written = [...appSource.matchAll(/dataset\.([A-Za-z0-9_$]+)\s*=/g)].map(
      (m) => `data-${m[1].replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
    );
    if (!written.includes(attribute)) {
      problems.push(
        `brand stylesheets are scoped to [${attribute}], but ${APP} never writes it — ` +
          `it sets ${written.length ? written.join(", ") : "nothing"}. The switcher will ` +
          `appear to work while no theme applies.`
      );
    }
  }
}

for (const [component, body] of componentMap("EXAMPLES")) {
  const cases = casesByName.get(component);
  if (cases === undefined) {
    problems.push(`EXAMPLES has "${component}", which is not a component in the registry`);
    continue;
  }
  for (const [, key] of body.matchAll(/\n {4}"([^"]+)":/g)) {
    if (!cases.has(key)) {
      problems.push(
        `EXAMPLES["${component}"]["${key}"] matches no usage case, so the card ` +
          `renders "No live specimen for this case."\n      ${component} has: ` +
          [...cases].map((c) => `"${c}"`).join(", ")
      );
    }
  }
}

for (const [component] of componentMap("INTERACTIVE")) {
  if (!casesByName.has(component)) {
    problems.push(`INTERACTIVE has "${component}", which is not a component in the registry`);
  }
}

if (problems.length) {
  console.error("✖ the playground disagrees with what it is documenting:\n");
  for (const problem of problems) console.error(`  - ${problem}\n`);
  process.exit(1);
}

console.log(
  "playground wiring is sound — every example key resolves to a usage case, " +
    "and the theme switcher writes the attribute the stylesheets are scoped to."
);
