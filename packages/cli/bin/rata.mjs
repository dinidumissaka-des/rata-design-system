#!/usr/bin/env node
// rata CLI — v0: resolves components from the local monorepo registry.
// Later: fetch manifests over HTTPS from the hosted registry, with license
// auth (`rata login`) gating pro-tier components.
//
// `list` / `add` are the copy-paste distribution tool for consumer repos.
// `props` / `tokens` / `pages` are the agent-lookup surface described in
// agent-workflow.md's Layer 1 — the thing that makes checking cheaper than
// guessing, aliased at the repo root as `npm run ui -- <subcommand>`.
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import {
  repoRoot,
  loadRegistry,
  sortedEntries,
  getComponentProps,
  getTokens,
  getPages,
  getExamples,
} from "../lib/index.mjs";
import { getComponentContract } from "../lib/contract.mjs";
import { planInstall, applyRewrites } from "../lib/install-plan.mjs";

function usage() {
  console.log(`rata — design system CLI

Distribution:
  rata list                 List every component and its status
  rata add <name...>        Copy component source (and dependencies) into ./rata
    --dir <path>          Target directory (default: ./rata)

Agent lookup (also \`npm run ui -- <subcommand>\` from the repo root):
  rata props <name>          Props for one component, read straight from source
    --example              Include a real usage snippet from apps/
  rata contract <name>        Full contract: what each prop is FOR, when not to
                            reach for it, and the use cases — the written half,
                            cross-checked against source every build
  rata tokens [filter]        Flat --rata-* token reference; filter is a substring match
  rata pages                  Page shells already in this repo (find the precedent)

  --dense                  Compact, token-efficient output for any of the above
`);
}

async function list(dense) {
  const registry = await loadRegistry();
  const entries = sortedEntries(registry);
  // Measured, not a constant: `toggle-button-group` is 19 characters and a
  // fixed 16-wide column shunts every row after it out of alignment. The
  // registry decides how wide the name column is.
  const nameWidth = Math.max(...entries.map((entry) => entry.name.length), 16);

  for (const entry of entries) {
    if (dense) {
      console.log(entry.name);
      continue;
    }
    const css = entry.status?.css?.state ?? "tbd";
    const react = entry.status?.react?.state ?? "tbd";
    console.log(
      `${entry.name.padEnd(nameWidth)} ${entry.family.padEnd(12)} css:${css.padEnd(12)} react:${react.padEnd(12)} [${entry.tier ?? "free"}]`
    );
  }
}

async function add(names, targetDir) {
  const registry = await loadRegistry();

  const plan = await planInstall(names, registry);
  if (plan.error) {
    console.error(plan.error);
    process.exitCode = 1;
    return;
  }
  // A problem here means the manifest is wrong, not the copy: some file the
  // source imports is not in the install at all. Writing the files anyway
  // would leave the consumer with code that cannot compile and no clue why.
  if (plan.problems.length) {
    console.error("Cannot install — the registry is inconsistent:\n");
    for (const problem of plan.problems) console.error(`  ${problem}`);
    process.exitCode = 1;
    return;
  }

  let copied = 0;
  let rewritten = 0;
  for (const name of plan.resolved) {
    if (!registry[name].files?.length) {
      console.warn(
        `- ${name}: no files yet (status: ${registry[name].status?.react?.state ?? "tbd"}), skipped`
      );
    }
  }
  for (const file of plan.files) {
    const to = path.join(targetDir, file.target);
    await mkdir(path.dirname(to), { recursive: true });
    if (file.rewrites.length) {
      // The install layout is not the source layout, so sibling imports have
      // to be repointed at where each file actually lands.
      await writeFile(to, applyRewrites(file.source, file.rewrites));
      rewritten += file.rewrites.length;
    } else if (typeof file.source === "string" && /\.tsx?$/.test(file.target)) {
      await writeFile(to, file.source);
    } else {
      await copyFile(path.join(repoRoot, file.source), to);
    }
    console.log(`+ ${path.relative(process.cwd(), to)}`);
    copied++;
  }
  console.log(`\nAdded ${plan.resolved.size} component(s), ${copied} file(s).`);
  if (rewritten) {
    console.log(`Repointed ${rewritten} relative import(s) at the install layout.`);
  }
  console.log(`Remember to import @rata/tokens/css (or copy tokens.css) once at your app root.`);
}

async function props(name, { dense, example }) {
  if (!name) {
    console.error("Usage: rata props <name> [--example]");
    process.exitCode = 1;
    return;
  }
  const registry = await loadRegistry();
  const result = await getComponentProps(name, registry);

  if (result.error) {
    console.error(result.error);
    process.exitCode = 1;
    return;
  }
  if (!result.implemented) {
    console.log(dense ? `${name}: ${result.note}` : `${result.title ?? name}\n\n${result.note}`);
    return;
  }

  if (dense) {
    for (const prop of result.props) {
      const def = prop.default !== undefined ? ` = ${prop.default}` : "";
      console.log(`${prop.name}${prop.optional ? "?" : ""}: ${prop.type}${def}`);
    }
    if (example && result.example) console.log(result.example);
    return;
  }

  console.log(`${result.title} (${result.importPath})`);
  if (result.extends) console.log(`extends: ${result.extends}`);
  console.log("");
  for (const prop of result.props) {
    const def = prop.default !== undefined ? `  default: ${prop.default}` : "";
    console.log(`  ${prop.name}${prop.optional ? "?" : ""}: ${prop.type}${def}`);
    if (prop.description) console.log(`    — ${prop.description}`);
  }
  if (example) {
    console.log(`\nExample (real usage, from apps/):`);
    console.log(result.example ? `  ${result.example.split("\n").join("\n  ")}` : "  (none found in apps/)");
  }
}

async function contractCmd(name, dense) {
  if (!name) {
    console.error("Usage: rata contract <name>");
    process.exitCode = 1;
    return;
  }
  const registry = await loadRegistry();
  const contract = await getComponentContract(name, registry);

  if (contract.issues?.length && !contract.title) {
    console.error(contract.issues.join("\n"));
    process.exitCode = 1;
    return;
  }

  console.log(`${contract.title} (${contract.name}) — ${contract.mode}`);
  if (contract.mode === "spec") {
    console.log("Not implemented yet. This is the approved intent, not something you can import.");
  }
  if (contract.mode === "css-only") {
    console.log("CSS-only — a class composed onto other components, with no props API.");
  }
  console.log("");

  if (contract.behavior && !dense) {
    if (contract.behavior.summary) console.log(`Behavior: ${contract.behavior.summary}\n`);
    for (const d of contract.behavior.decisions ?? []) console.log(`  · ${d.decision}\n      ${d.why}`);
    if (contract.behavior.decisions?.length) console.log("");
  }

  for (const prop of contract.props) {
    const def = prop.default !== undefined && prop.default !== null ? ` = ${prop.default}` : "";
    console.log(`  ${prop.name}${prop.optional ? "?" : ""}: ${prop.type}${def}`);
    if (prop.summary) console.log(`    ${prop.summary}`);
    if (dense) continue;
    for (const item of prop.use) console.log(`    use    ${item}`);
    for (const item of prop.dont) console.log(`    don't  ${item}`);
    if (prop.conflicts.length) console.log(`    with   conflicts with ${prop.conflicts.join(", ")}`);
    if (prop.a11y) console.log(`    a11y   ${prop.a11y}`);
    console.log("");
  }

  if (contract.usage.length && !dense) {
    console.log("Use cases:");
    for (const item of contract.usage) {
      console.log(`  ${item.case}${item.when ? ` — ${item.when}` : ""}`);
      if (item.example) console.log(item.example.split("\n").map((l) => `      ${l}`).join("\n"));
      if (item.notes) console.log(`      note: ${item.notes}`);
      console.log("");
    }
  }

  if (contract.issues.length) {
    console.error("Contract disagrees with source:");
    for (const issue of contract.issues) console.error(`  ✗ ${issue}`);
    process.exitCode = 1;
  }

  console.log(`Full page: docs/components/${contract.name}.md`);
}

async function tokensCmd(filter, dense) {
  const tokens = await getTokens();
  if (!tokens) {
    console.error("Tokens haven't been built yet — run `npm run build -w @rata/tokens` (or `npm run build`) first.");
    process.exitCode = 1;
    return;
  }
  const keys = Object.keys(tokens)
    .filter((key) => !filter || key.includes(filter))
    .sort();
  for (const key of keys) {
    console.log(dense ? `--rata-${key}` : `--rata-${key}: ${tokens[key]}`);
  }
}

async function pagesCmd(dense) {
  const pages = await getPages();
  if (!pages.length) {
    console.log("No page entry-points found under apps/*/src.");
    return;
  }
  for (const page of pages) {
    console.log(dense ? page.path : `${page.path}\n  shell: ${page.shell}`);
  }
}

const [, , command, ...rest] = process.argv;
const dense = rest.includes("--dense");
const example = rest.includes("--example");
const dirFlag = rest.indexOf("--dir");
const targetDir =
  dirFlag !== -1 ? path.resolve(rest[dirFlag + 1] ?? "rata") : path.resolve("rata");
const positional = rest.filter(
  (arg, i) => !arg.startsWith("--") && (dirFlag === -1 || i !== dirFlag + 1)
);

if (command === "list") await list(dense);
else if (command === "add" && positional.length) await add(positional, targetDir);
else if (command === "props") await props(positional[0], { dense, example });
else if (command === "contract") await contractCmd(positional[0], dense);
else if (command === "tokens") await tokensCmd(positional[0], dense);
else if (command === "pages") await pagesCmd(dense);
else usage();
