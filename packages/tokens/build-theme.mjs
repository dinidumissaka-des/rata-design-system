/**
 * @file build-theme.mjs
 * @input A brand theme module path (exporting one defineTheme() result)
 * @output A scoped CSS override file, after re-verifying every contrast promise
 * @position Brand-theme build; run by each package under packages/themes/*
 *
 * Builds a brand theme into CSS that overrides the base theme *only where it
 * actually differs*, scoped to [data-rata-theme="<name>"].
 *
 *   node build-theme.mjs ../themes/ember/src/emberTheme.mjs -o ../themes/ember/dist/theme.css
 *
 * THE POINT OF THIS SCRIPT is the verification, not the emit. usage.json's
 * contrast pairings are a promise about the *system*, not about one palette.
 * A brand that re-seeds the accent inherits that promise, so the promise has
 * to be re-measured against the brand's own resolved values — otherwise
 * "multi-brand theming" means "multi-brand contrast bugs".
 *
 * Run with --check to verify without writing.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import { contrastRatio } from "./src/theme/color.mjs";
import { resolveTheme } from "./src/theme/resolveTokens.mjs";
import { isDefinedTheme } from "./src/theme/defineTheme.mjs";
import { readContracts } from "./src/theme/readContracts.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const PREFIX = "rata";

const argv = process.argv.slice(2);
const CHECK_ONLY = argv.includes("--check");
const entry = argv.find((a) => !a.startsWith("-"));
const outIndex = argv.findIndex((a) => a === "-o" || a === "--out");
const outPath = outIndex === -1 ? null : argv[outIndex + 1];

if (!entry) {
  console.error("Usage: build-theme.mjs <theme-module> [-o <out.css>] [--check]");
  process.exit(2);
}

/** WCAG minimums, keyed by the level names usage.json uses. */
const LEVELS = { "AA-text": 4.5, "AA-large": 3, "AA-nontext": 3 };
const round = (n) => Math.round(n * 100) / 100;

// The promises a brand must hold live in src/contracts/system.json.
const usage = await readContracts({ root, repoRoot: path.resolve(root, "../..") });

// ── Load the brand theme and the base it is measured against ────────────────

const themeModule = await import(pathToFileURL(path.resolve(entry)).href);
const theme = Object.values(themeModule).find(isDefinedTheme);
if (!theme) {
  console.error(
    `build-theme: ${entry} exports no theme from defineTheme(). ` +
      `Check the module exports the theme itself, not a plain object.`,
  );
  process.exit(2);
}

const { baseTheme } = await import("./src/themes/base.mjs");

let brand;
let base;
try {
  brand = await resolveTheme({ root, theme });
  base = await resolveTheme({ root, theme: baseTheme });
} catch (error) {
  // An unresolvable reference is an authoring mistake, not a crash. The
  // message already names the token and the reference it wanted.
  console.error(`@rata/tokens: theme "${theme.name}" does not resolve\n`);
  console.error(`  • ${error.message}`);
  process.exit(1);
}

// ── Re-verify every promise usage.json makes, against THIS brand ────────────

const errors = [];

for (const pair of usage.pairings) {
  const min = LEVELS[pair.requires];
  for (const scheme of pair.themes ?? ["light", "dark"]) {
    const fg = brand.themeValues[scheme][pair.fg];
    const bg = brand.themeValues[scheme][pair.bg];
    if (!fg || !bg) continue;
    const ratio = round(contrastRatio(fg, bg));
    if (ratio < min) {
      errors.push(
        `${theme.name}: ${pair.fg} on ${pair.bg} is ${ratio}:1 in ${scheme}, ` +
          `below the ${min}:1 this system promises for "${pair.requires}".`,
      );
    }
  }
}

// A brand may legitimately *fix* a base known gap — that is an improvement,
// not a regression, so gaps are reported rather than failed.
const closedGaps = [];
for (const gap of usage.knownGaps) {
  const limit = LEVELS[gap.below];
  for (const scheme of gap.themes ?? ["light", "dark"]) {
    const fg = brand.themeValues[scheme][gap.fg];
    const bg = brand.themeValues[scheme][gap.bg];
    if (!fg || !bg) continue;
    const ratio = round(contrastRatio(fg, bg));
    if (ratio >= limit) {
      closedGaps.push(`${gap.fg} on ${gap.bg} (${scheme}) now ${ratio}:1`);
    }
  }
}

if (errors.length) {
  console.error(`@rata/tokens: ${theme.name} breaks ${errors.length} contrast promise(s)\n`);
  for (const e of errors) console.error(`  • ${e}`);
  console.error(
    `\nThe seed this theme uses cannot carry the base contract. Re-seed, ` +
      `raise \`contrast\` to 'high', or state the affected roles outright in \`tokens\`.`,
  );
  process.exit(1);
}

// ── Emit only what differs from base ────────────────────────────────────────

const baseLight = base.themeValues.light;
const baseDark = base.themeValues.dark;

const changedLight = brand.flatLight.filter((t) => baseLight[t.path] !== t.value);
const changedDark = brand.flatDark.filter((t) => baseDark[t.path] !== t.value);

const decl = (tokens) =>
  tokens.map((t) => `  --${PREFIX}-${t.name}: ${t.value};`).join("\n");

const scope = `[data-${PREFIX}-theme="${theme.name}"]`;

const css = [
  `/* Generated by @rata/tokens — do not edit by hand.`,
  ` * Brand theme "${theme.name}". Only tokens that differ from the base theme`,
  ` * are declared; everything else inherits, so this file stays small and a`,
  ` * base-theme fix reaches every brand without re-editing them.`,
  ` *`,
  ` * Load AFTER the base tokens.css, then scope with:`,
  ` *   <html data-${PREFIX}-theme="${theme.name}">`,
  ` */`,
  "",
  `${scope} {`,
  decl(changedLight),
  "}",
  "",
  `${scope}[data-theme="dark"] {`,
  decl(changedDark),
  "}",
  "",
].join("\n");

if (CHECK_ONLY) {
  console.log(
    `@rata/tokens: ${theme.name} holds all ${usage.pairings.length} contrast promises ` +
      `(${changedLight.length} light / ${changedDark.length} dark overrides).`,
  );
} else {
  const target = path.resolve(outPath ?? `dist/${theme.name}.css`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, css);
  console.log(
    `@rata/tokens: theme "${theme.name}" → ${path.relative(process.cwd(), target)} ` +
      `(${changedLight.length} light / ${changedDark.length} dark overrides, ` +
      `${usage.pairings.length} contrast promises re-verified)`,
  );
}

for (const g of closedGaps) {
  console.log(`  note: ${g} — this brand closes a base known gap.`);
}
