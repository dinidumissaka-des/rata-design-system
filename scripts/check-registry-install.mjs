#!/usr/bin/env node
// Prove that `rata add <name>` emits code that resolves, for every component
// in the registry.
//
// The registry is a copy-paste distribution channel, and nothing was checking
// that what it copies is coherent. Two ways it can be wrong, both of which
// shipped silently:
//
//   1. A file the source imports is in no manifest in the install closure, so
//      the consumer gets a component with an import pointing at a file that
//      was never copied.
//   2. The file is copied, but to a different directory than the importing
//      one — manifests send components to `components/` and shared helpers to
//      `lib/`, while the source imports them as flat siblings.
//
// The first is a manifest bug and can only be fixed by editing the manifest.
// The second the installer now repairs by rewriting the specifier; this check
// asserts that the repair actually resolves, rather than trusting it.
import path from "node:path";
import { loadRegistry } from "../packages/cli/lib/index.mjs";
import { planInstall, applyRewrites } from "../packages/cli/lib/install-plan.mjs";

const registry = await loadRegistry();
const names = Object.keys(registry).sort();

let failed = 0;
let planned = 0;
let rewrites = 0;

for (const name of names) {
  const plan = await planInstall([name], registry);
  if (plan.error) {
    console.error(`✖ ${name}: ${plan.error}`);
    failed++;
    continue;
  }
  if (plan.problems.length) {
    for (const problem of plan.problems) console.error(`✖ ${problem}`);
    failed++;
    continue;
  }

  // Every emitted specifier must land on a file this install actually writes.
  const written = new Set(plan.files.map((f) => f.target));
  const unresolved = [];
  for (const file of plan.files) {
    // Every code file, not only the ones that needed a rewrite: a specifier
    // that was left alone still has to resolve, and checking only the
    // rewritten ones would pass a build where the rewrite never ran.
    if (typeof file.source !== "string" || !/\.tsx?$/.test(file.target)) continue;
    rewrites += file.rewrites.length;
    const emitted = applyRewrites(file.source, file.rewrites);
    for (const [, , , specifier] of emitted.matchAll(/(\bfrom\s*|\bimport\s*\(\s*)(["'])(\.\.?\/[^"']+)\2/g)) {
      const resolved = path
        .join(path.dirname(file.target), specifier)
        .replace(/\\/g, "/");
      const hit = [resolved, `${resolved}.ts`, `${resolved}.tsx`].some((c) => written.has(c));
      if (!hit) unresolved.push(`${file.target}: "${specifier}" resolves to nothing in the install`);
    }
  }
  if (unresolved.length) {
    for (const u of unresolved) console.error(`✖ ${name}: ${u}`);
    failed++;
    continue;
  }
  planned++;
}

if (failed) {
  console.error(`\n${failed} component(s) would install broken. Fix the manifest, then re-run.`);
  process.exit(1);
}

console.log(
  `registry install is coherent — ${planned} component(s) plan cleanly, ` +
    `${rewrites} relative import(s) repointed at the install layout.`
);
