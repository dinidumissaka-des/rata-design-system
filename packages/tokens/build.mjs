// Token build: resolves {references} in the JSON source, validates that every
// token is documented in src/contracts/, verifies the documented contrast
// pairings against the resolved values, and emits
//   dist/css/tokens.css      — CSS custom properties (:root + [data-theme="dark"]), annotated
//   dist/index.js|.d.ts      — typed token object + cssVar() helper, with usage in JSDoc
//   dist/tailwind/preset.cjs — Tailwind preset mapping theme keys to the CSS vars
//   dist/usage.json          — machine-readable usage docs + measured contrast
//   TOKENS.md                — the human/agent-facing reference (committed to the repo)
//
// Run with --check to fail instead of rewriting TOKENS.md when it is out of date.
import { mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { contrastRatio } from "./src/theme/color.mjs";
import { resolveTheme } from "./src/theme/resolveTokens.mjs";
import { readContracts } from "./src/theme/readContracts.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const PREFIX = "rata";
const CHECK_ONLY = process.argv.includes("--check");

const readJson = async (p) => JSON.parse(await readFile(path.join(root, p), "utf8"));

// Documentation is assembled from one contract per thing (src/contracts/*.json
// plus each component's registry manifest), not one catalogue file.
let usage;
try {
  usage = await readContracts({ root, repoRoot: path.resolve(root, "../..") });
} catch (error) {
  // A malformed contract set is an authoring mistake, not a crash — the
  // message already names the files involved.
  console.error("@rata/tokens: the token contracts do not load\n");
  console.error(`  • ${error.message}`);
  process.exit(1);
}

/** Name the contract an entry came from, so an error points at a file. */
const contractOf = (key) => usage.sources.get(key) ?? "a contract";

// The theme is code, not data: it declares a handful of seeds and the
// expanders in src/theme/ generate the rest. Everything scheme-dependent
// lives there as a [light, dark] tuple rather than in two parallel files —
// one place to read a role's full story. See src/themes/base.mjs.
const { baseTheme } = await import("./src/themes/base.mjs");
const themeName = baseTheme.name;

const {
  resolvedBase,
  resolvedLight,
  flatBase,
  flatLight,
  flatDark,
  variantPaths,
  flatVariantDark,
  themeValues,
} = await resolveTheme({ root, theme: baseTheme });

// Kept under its historical name: everything downstream (usage.json coverage,
// TOKENS.md sectioning, the emitted {light, dark} value pairs) means
// "scheme-dependent" when it says "semantic".
const semanticPaths = variantPaths;
const allPaths = new Set([...flatBase, ...flatLight].map((t) => t.path));

/* ------------------------------------------------------------------ *
 * Documentation coverage — every token must be documented, and every
 * documented token must exist. Both directions fail the build, so the
 * docs cannot silently drift from the token source.
 * ------------------------------------------------------------------ */

// Docs may be attached to a leaf token or to a group (the group's `scale`
// then describes the individual steps). Lookup walks up the path.
function docFor(dotted) {
  const parts = dotted.split(".");
  for (let i = parts.length; i > 0; i--) {
    const key = parts.slice(0, i).join(".");
    if (usage.tokens[key]) return { key, entry: usage.tokens[key], exact: i === parts.length };
  }
  return null;
}

const errors = [];

for (const key of Object.keys(usage.tokens)) {
  const existsAsLeaf = allPaths.has(key);
  const existsAsGroup = [...allPaths].some((p) => p.startsWith(`${key}.`));
  if (!existsAsLeaf && !existsAsGroup) {
    errors.push(`${contractOf(key)} documents "${key}", which is not a token or token group.`);
  }
}

// A token whose value changes with the scheme carries theme-dependent
// meaning, so each one needs its own entry — inheriting a group description
// is not specific enough to build from. Theme tokens that resolve the same in
// both schemes (the generated type, radius and duration steps) are ordinary
// scale members and may inherit their group's docs, as primitives do.
for (const token of flatLight) {
  const doc = docFor(token.path);
  if (variantPaths.has(token.path)) {
    if (!doc || !doc.exact) {
      errors.push(`Scheme-dependent token "${token.path}" has no entry of its own in any contract under src/contracts/.`);
    }
  } else if (!doc) {
    errors.push(`Generated token "${token.path}" is undocumented in src/contracts/.`);
  }
}

for (const token of flatBase) {
  if (!docFor(token.path)) errors.push(`Base token "${token.path}" is undocumented in src/contracts/.`);
}

// A literal "*/" anywhere in an entry's prose closes the JSDoc comment block
// this text gets embedded in early (see jsdoc() below) — everything after it
// gets parsed as TypeScript instead of skipped as a comment, which corrupts
// dist/index.d.ts in a way this build cannot see (it doesn't typecheck its
// own output) and a consumer only discovers via a baffling downstream tsc
// error. Catch it here instead.
for (const [name, entry] of Object.entries(usage.tokens)) {
  for (const field of Object.keys(entry)) {
    const value = entry[field];
    const strings =
      typeof value === "string"
        ? [value]
        : Array.isArray(value)
          ? value
          : typeof value === "object" && value !== null
            ? Object.values(value).flatMap((v) => (typeof v === "string" ? [v] : Object.values(v ?? {})))
            : [];
    for (const s of strings) {
      if (typeof s === "string" && s.includes("*/")) {
        errors.push(`${contractOf(name)}: entry "${name}" field "${field}" contains a literal "*/", which breaks the generated JSDoc comment.`);
      }
    }
  }
  for (const field of ["summary"]) {
    if (!entry[field]) errors.push(`${contractOf(name)}: entry "${name}" is missing "${field}".`);
  }
  for (const ref of Object.values(entry.instead ?? {})) {
    // "instead" values are prose that names one or more replacement tokens;
    // every dotted path mentioned must be real.
    for (const candidate of ref.match(/\b[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+\b/g) ?? []) {
      if (!allPaths.has(candidate) && !usage.tokens[candidate]) {
        errors.push(`${contractOf(name)}: entry "${name}" points at unknown token "${candidate}".`);
      }
    }
  }
  for (const ref of entry.pairsWith ?? []) {
    if (!allPaths.has(ref)) errors.push(`${contractOf(name)}: entry "${name}" pairsWith unknown token "${ref}".`);
  }

  // A `scale` block documents the steps of a real scale, so every key in it
  // must resolve to a real token. Without this, renaming a scale leaves its
  // documentation describing steps that no longer exist — which is how the
  // radius, font and type entries came to describe a scale the generator had
  // already replaced. Prose that is not a step belongs in `notes`.
  for (const step of Object.keys(entry.scale ?? {})) {
    if (!allPaths.has(`${name}.${step}`)) {
      errors.push(
        `${contractOf(name)}: entry "${name}" documents step "${step}", which is not a token ` +
          `("${name}.${step}" does not exist). If it is commentary rather than a step, move it to "notes".`,
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * Contrast — measured from the resolved values, not asserted by hand.
 * Documented pairings must meet their stated level in every theme they
 * claim; documented gaps must still be gaps. A palette change that
 * breaks a promise, or that quietly fixes a gap, fails the build.
 * ------------------------------------------------------------------ */

const LEVELS = { "AA-text": 4.5, "AA-large": 3, "AA-nontext": 3 };

// Contrast comes from src/theme/color.mjs now, not a private copy here.
//
// The copy this replaces read an 8-digit #RRGGBBAA by slicing off the first
// six characters, so a translucent colour measured as if it were opaque —
// a tinted background at 12% alpha scored identically to the solid hue it
// was mixed from, which is how a 1:1 pairing could pass as compliant.
// The shared implementation composites a translucent foreground over its
// background, and throws on a translucent *background* rather than guess at
// what sits behind it.
const contrast = contrastRatio;

const round = (n) => Math.round(n * 100) / 100;

const contrastReport = [];

for (const pair of usage.pairings) {
  const themes = pair.themes ?? ["light", "dark"];
  const min = LEVELS[pair.requires];
  if (min === undefined) errors.push(`Pairing ${pair.fg} on ${pair.bg} has unknown level "${pair.requires}".`);
  const measured = {};
  for (const theme of themes) {
    const fg = themeValues[theme][pair.fg];
    const bg = themeValues[theme][pair.bg];
    if (!fg || !bg) {
      errors.push(`Pairing ${pair.fg} on ${pair.bg} references a token missing from the ${theme} theme.`);
      continue;
    }
    const ratio = round(contrast(fg, bg));
    measured[theme] = ratio;
    if (min !== undefined && ratio < min) {
      errors.push(
        `Contrast promise broken: ${pair.fg} on ${pair.bg} is ${ratio}:1 in the ${theme} theme, ` +
          `below the ${min}:1 required by "${pair.requires}". Fix the tokens or move this to knownGaps.`
      );
    }
  }
  contrastReport.push({ ...pair, themes, measured });
}

const gapReport = [];

for (const gap of usage.knownGaps) {
  const themes = gap.themes ?? ["light", "dark"];
  const limit = LEVELS[gap.below];
  if (limit === undefined) errors.push(`knownGap ${gap.fg} on ${gap.bg} has unknown level "${gap.below}".`);
  const measured = {};
  for (const theme of themes) {
    const fg = themeValues[theme][gap.fg];
    const bg = themeValues[theme][gap.bg];
    if (!fg || !bg) {
      errors.push(`knownGap ${gap.fg} on ${gap.bg} references a token missing from the ${theme} theme.`);
      continue;
    }
    const ratio = round(contrast(fg, bg));
    measured[theme] = ratio;
    if (limit !== undefined && ratio >= limit) {
      errors.push(
        `Stale knownGap: ${gap.fg} on ${gap.bg} now measures ${ratio}:1 in the ${theme} theme, ` +
          `at or above ${limit}:1. The gap is fixed — promote it to pairings and delete the gap entry.`
      );
    }
  }
  gapReport.push({ ...gap, themes, measured });
}

for (const [name, recipe] of Object.entries(usage.recipes)) {
  for (const value of Object.values(recipe.tokens)) {
    for (const candidate of String(value).match(/\b[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+\b/g) ?? []) {
      if (!allPaths.has(candidate)) errors.push(`Recipe "${name}" names unknown token "${candidate}".`);
    }
  }
}

if (errors.length) {
  console.error(`@rata/tokens: ${errors.length} documentation error(s)\n`);
  for (const e of errors) console.error(`  • ${e}`);
  process.exit(1);
}

/* ------------------------------------------------------------------ *
 * Emit
 * ------------------------------------------------------------------ */

// Every leaf token keyed by its CSS variable name, with the layer it belongs to.
// Token segments contain "-" of their own (accent-role, on-accent), so a variable
// name cannot be parsed back into a token path — tools that need to classify a
// `var(--rata-…)` reference read this index instead of guessing by prefix.
const tokenIndex = Object.fromEntries(
  [...flatBase, ...flatLight].map((token) => [
    `${PREFIX}-${token.name}`,
    {
      path: token.path,
      layer: docFor(token.path)?.entry.layer ?? "base",
      value: semanticPaths.has(token.path)
        ? { light: themeValues.light[token.path], dark: themeValues.dark[token.path] }
        : token.value,
    },
  ])
);

// One-line annotation for a token: its own summary if documented directly,
// otherwise its group's description of that step on the scale. Tokens that
// only inherit a group summary (the palette ramps) are annotated once for the
// whole group rather than repeating the same line on every step.
function inlineDoc(token, seenGroups) {
  const doc = docFor(token.path);
  if (!doc) return null;
  if (doc.exact) return doc.entry.summary;
  const step = doc.entry.scale?.[token.leaf];
  if (step) return step;
  if (seenGroups.has(doc.key)) return null;
  seenGroups.add(doc.key);
  return doc.entry.summary;
}

const GROUP_TITLES = {
  color: "Color — palette primitives (do not use directly, except color.data) then theme roles",
  theme: "Theme — semantic color + elevation roles, the only tokens that differ between light and dark",
  space: "Spacing — every margin, padding, and gap",
  radius: "Corner radius",
  size: "Interactive control sizing",
  font: "Typography primitives (do not use directly — use type.*)",
  type: "Typography — the usable text scale",
  motion: "Motion",
  elevation: "Elevation (box-shadow scale)",
  ring: "Ring — inset validation/selection strokes",
  opacity: "Opacity — raw values behind the state scale",
  state: "Interaction-state opacities",
  focus: "Focus-ring geometry",
  border: "Border widths",
};

function cssBlock(selector, tokens, { groupHeaders }) {
  const lines = [`${selector} {`];
  const seenGroups = new Set();
  let currentGroup = null;
  for (const token of tokens) {
    const group = token.path.split(".")[0];
    if (groupHeaders && group !== currentGroup) {
      if (currentGroup !== null) lines.push("");
      lines.push(`  /* ${GROUP_TITLES[group] ?? group} */`);
      currentGroup = group;
    }
    const doc = inlineDoc(token, seenGroups);
    if (doc) lines.push(`  /* ${doc} */`);
    lines.push(`  --${PREFIX}-${token.name}: ${token.value};`);
  }
  lines.push("}");
  return lines.join("\n") + "\n";
}

const css = [
  [
    "/* Generated by @rata/tokens — do not edit by hand.",
    " * Edit src/primitives/*.json, src/semantics/*.json, src/semantics/theme/*.json,",
    " * or src/contracts/*.json and rebuild.",
    " *",
    " * Comments come from src/contracts/*.json. Full guidance, contrast data, and",
    " * component recipes live in packages/tokens/TOKENS.md.",
    " *",
    " * Palette tokens (--rata-color-neutral-*, --rata-color-accent-*, and the other",
    " * numbered ramps) are identical in both themes. Never use them in a",
    " * component — use the theme.* semantic tokens below them instead",
    " * (color.data.* is the one palette group meant for direct use, in charts).",
    " */",
  ].join("\n"),
  cssBlock(":root", [...flatBase, ...flatLight], { groupHeaders: true }),
  [
    "/* Dark theme — only the tokens whose value actually differs are re-declared.",
    " * Every token below has the same meaning as its :root counterpart; a token",
    " * absent here resolved identically in both schemes and needs no override. */",
    cssBlock('[data-theme="dark"]', flatVariantDark, { groupHeaders: false }),
  ].join("\n"),
].join("\n");

// TypeScript/JS output: semantic tokens overlay the base tree (light values as defaults).
const merged = structuredClone(resolvedBase);
(function deepMerge(target, from) {
  for (const [k, v] of Object.entries(from)) {
    if (typeof v === "object" && typeof target[k] === "object") deepMerge(target[k], v);
    else target[k] = v;
  }
})(merged, resolvedLight);

// JSDoc block for a token or group, so editors and coding agents see the usage
// rules on hover and in completions rather than having to find the docs.
function jsdoc(dotted, indent) {
  const doc = docFor(dotted);
  if (!doc || doc.key !== dotted) return "";
  const e = doc.entry;
  const lines = [e.summary];
  if (semanticPaths.has(dotted)) {
    lines.push("", `Light: \`${themeValues.light[dotted]}\` · Dark: \`${themeValues.dark[dotted]}\``);
  }
  if (e.use?.length) lines.push("", "Use for:", ...e.use.map((u) => `- ${u}`));
  if (e.scale) lines.push("", "Scale:", ...Object.entries(e.scale).map(([k, v]) => `- \`${k}\` — ${v}`));
  if (e.dont?.length) lines.push("", "Do not use for:", ...e.dont.map((d) => `- ${d}`));
  if (e.instead) lines.push("", "Use instead:", ...Object.entries(e.instead).map(([k, v]) => `- ${k} → \`${v}\``));
  if (e.pairsWith?.length) lines.push("", `Pairs with: ${e.pairsWith.map((p) => `\`${p}\``).join(", ")}`);
  if (e.notes?.length) lines.push("", ...e.notes.map((n) => `Note: ${n}`));
  if (e.example?.css) lines.push("", "```css", e.example.css, "```");
  return `${indent}/**\n${lines.map((l) => `${indent} *${l ? ` ${l}` : ""}`).join("\n")}\n${indent} */\n`;
}

function toType(node, dotted = "", indent = "  ") {
  if (typeof node === "string") return "string";
  const inner = Object.entries(node)
    .map(([k, v]) => {
      const childPath = dotted ? `${dotted}.${k}` : k;
      return `${jsdoc(childPath, indent)}${indent}${JSON.stringify(k)}: ${toType(v, childPath, indent + "  ")};`;
    })
    .join("\n");
  return `{\n${inner}\n${indent.slice(2)}}`;
}

const js = `// Generated by @rata/tokens — do not edit by hand.
export const tokens = ${JSON.stringify(merged, null, 2)};
export const cssVar = (tokenPath) => \`var(--${PREFIX}-\${tokenPath.replaceAll(".", "-")})\`;
export const usage = ${JSON.stringify(usage.tokens, null, 2)};
export const index = ${JSON.stringify(tokenIndex, null, 2)};
export const contrast = ${JSON.stringify({ pairings: contrastReport, knownGaps: gapReport }, null, 2)};
export const recipes = ${JSON.stringify(usage.recipes, null, 2)};
`;

const dts = `// Generated by @rata/tokens — do not edit by hand.

/**
 * Resolved token values, with the light theme's semantic values as defaults.
 *
 * Prefer \`cssVar()\` over these literals in component code: only the CSS
 * variables react to the active theme.
 */
export declare const tokens: ${toType(merged)};

/**
 * Returns the CSS variable reference for a dotted token path.
 *
 * \`\`\`ts
 * cssVar("theme.accent-role.bg"); // "var(--rata-theme-accent-role-bg)"
 * \`\`\`
 */
export declare const cssVar: (tokenPath: string) => string;

/** Usage documentation for every token, keyed by dotted path. */
export declare const usage: Record<string, {
  layer: "palette" | "semantic" | "base";
  summary: string;
  use?: string[];
  dont?: string[];
  instead?: Record<string, string>;
  pairsWith?: string[];
  scale?: Record<string, string>;
  notes?: string[];
  example?: { css?: string };
}>;

/** Every leaf token keyed by CSS variable name, with the layer it belongs to. */
export declare const index: Record<string, {
  path: string;
  layer: "palette" | "semantic" | "base";
  value: string | { light: string; dark: string };
}>;

/** Contrast ratios measured from the resolved token values at build time. */
export declare const contrast: {
  pairings: { fg: string; bg: string; requires: string; themes: string[]; measured: Record<string, number>; note?: string }[];
  knownGaps: { fg: string; bg: string; below: string; themes: string[]; measured: Record<string, number>; note?: string; workaround?: string }[];
};

/** Token-by-token specs for common components. */
export declare const recipes: Record<string, { summary: string; tokens: Record<string, string> }>;
`;

const tw = `// Generated by @rata/tokens — Tailwind preset (do not edit by hand).
// Only semantic tokens are exposed: the palette ramps are deliberately absent
// so utilities cannot bypass the theme. See packages/tokens/TOKENS.md.
const v = (name) => \`var(--${PREFIX}-\${name})\`;
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: v("theme-bg-canvas"),
        surface: v("theme-bg-surface"),
        subtle: v("theme-bg-subtle"),
        muted: v("theme-bg-muted"),
        foreground: v("theme-fg-primary"),
        secondary: v("theme-fg-secondary"),
        accent: {
          DEFAULT: v("theme-accent-role-bg"),
          fg: v("theme-accent-role-fg"),
          subtle: v("theme-accent-role-subtle"),
        },
        danger: {
          DEFAULT: v("theme-danger-role-bg"),
          fg: v("theme-danger-role-fg"),
          subtle: v("theme-danger-role-subtle"),
        },
        success: {
          DEFAULT: v("theme-success-role-bg"),
          fg: v("theme-success-role-fg"),
          subtle: v("theme-success-role-subtle"),
        },
        warning: {
          DEFAULT: v("theme-warning-role-bg"),
          fg: v("theme-warning-role-fg"),
          subtle: v("theme-warning-role-subtle"),
        },
        border: v("theme-border-default"),
      },
      boxShadow: {
        raised: v("theme-elevation-raised"),
        overlay: v("theme-elevation-overlay"),
        modal: v("theme-elevation-modal"),
      },
      borderRadius: {
        sm: v("radius-sm"),
        DEFAULT: v("radius-md"),
        lg: v("radius-lg"),
        xl: v("radius-xl"),
      },
      fontFamily: {
        sans: v("font-family-sans"),
        mono: v("font-family-mono"),
      },
    },
  },
};
`;

const usageJson = JSON.stringify(
  {
    $comment: "Generated by @rata/tokens — do not edit by hand. Source: src/contracts/*.json and registry/components/*.json.",
    rules: usage.rules,
    index: tokenIndex,
    tokens: Object.fromEntries(
      Object.entries(usage.tokens).map(([key, entry]) => [
        key,
        {
          ...entry,
          cssVar: allPaths.has(key) ? `var(--${PREFIX}-${key.replaceAll(".", "-")})` : undefined,
          value: semanticPaths.has(key)
            ? { light: themeValues.light[key], dark: themeValues.dark[key] }
            : allPaths.has(key)
              ? themeValues.light[key]
              : undefined,
        },
      ])
    ),
    contrast: { pairings: contrastReport, knownGaps: gapReport },
    recipes: usage.recipes,
  },
  null,
  2
);

/* ---- TOKENS.md -------------------------------------------------- */

const md = [];
const bullets = (items) => items.map((i) => `- ${i}`).join("\n");

md.push("<!-- Generated by @rata/tokens from src/contracts/*.json and registry/components/*.json — do not edit by hand. -->");
md.push("<!-- Regenerate with `npm run build -w @rata/tokens`. -->");
md.push("");
md.push("# Token usage reference");
md.push("");
md.push(
  "Every token in this system, what it is for, and what it is *not* for. " +
    "If you are building a component, find the token whose **Use for** list matches what you are styling — " +
    "there is exactly one right answer for each decision."
);
md.push("");
md.push("## Rules");
md.push("");
md.push(usage.rules.map((r, i) => `${i + 1}. ${r}`).join("\n"));
md.push("");
md.push("## Layers");
md.push("");
md.push("| Layer | Tokens | Use in components? |");
md.push("|---|---|---|");
md.push("| Palette | `color.neutral.*`, `color.accent.*`, `color.success.*`, `color.warning.*`, `color.danger.*`, `color.white`, `color.black` | **No** — identical in both themes, so they break dark mode |");
md.push("| Palette (direct-use) | `color.data.*` | **Yes, but only in data visualization** — series colors are picked directly, not routed through a role |");
md.push("| Semantic | `theme.bg.*`, `theme.fg.*`, `theme.border.*`, `theme.*-role.*`, `theme.focus-ring`, `theme.elevation.*` | **Yes** — the only color (and elevation) tokens a component may use, and the only ones that differ by theme |");
md.push("| Base scales | `space`, `radius`, `size`, `font`, `type`, `motion`, `elevation`, `ring`, `opacity`, `state`, `focus`, `border` | **Yes** — theme-independent by design |");
md.push("");
md.push("## Pick a token");
md.push("");
md.push("| I am styling… | Token |");
md.push("|---|---|");
for (const [what, token] of [
  ["The page background", "`theme.bg.canvas`"],
  ["A card, dialog, menu, or popover background", "`theme.bg.surface`"],
  ["A table header, zebra stripe, or quiet band", "`theme.bg.subtle`"],
  ["A progress track, skeleton, or inset well", "`theme.bg.muted`"],
  ["Body text, headings, meaningful icons", "`theme.fg.primary`"],
  ["Helper text, captions, metadata", "`theme.fg.secondary`"],
  ["Placeholders and decorative icons", "`theme.fg.muted`"],
  ["The label on a filled accent or danger control", "`theme.fg.on-accent`"],
  ["A divider or card outline", "`theme.border.default`"],
  ["An input or outlined-button border", "`theme.border.strong`"],
  ["The primary button / selected state", "`theme.accent-role.bg`"],
  ["A link or text-only action", "`theme.accent-role.fg`"],
  ["An informational banner background", "`theme.accent-role.subtle`"],
  ["A validation/selection outline on a control", "the role's `ring` — `theme.accent-role.ring`, etc."],
  ["A destructive button", "`theme.danger-role.bg`"],
  ["A validation error message", "`theme.danger-role.fg`"],
  ["An error banner background", "`theme.danger-role.subtle`"],
  ["A success or warning message", "the role's `subtle` background with its `fg` text — never its `bg`"],
  ["A status dot or non-text indicator", "the role's `bg`"],
  ["The keyboard focus ring", "`theme.focus-ring` with `focus.ring-width` / `focus.ring-offset`"],
  ["Hover or press feedback", "the `.rata-state-layer` class — not a color swap"],
  ["A raised card's shadow", "`theme.elevation.raised`"],
  ["A dropdown/menu/popover shadow", "`theme.elevation.overlay`"],
  ["A dialog/sheet shadow", "`theme.elevation.modal`"],
  ["Any margin, padding, or gap", "a `space.*` step"],
  ["A control's height", "a `size.control.*` step"],
  ["Body/heading/label text size and weight", "a `type.*` role"],
  ["A data-visualization series color", "`color.data.categorical.*` or a `color.data.<hue>` ramp"],
]) {
  md.push(`| ${what} | ${token} |`);
}
md.push("");

// Recipe values mix token paths with prose ("1px solid theme.border.default").
// Backtick the token paths and leave the prose alone.
function markTokens(text) {
  return String(text).replace(/\b[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+\b/g, (m) =>
    allPaths.has(m) ? `\`${m}\`` : m
  );
}

function renderToken(key, entry) {
  const out = [];
  const isToken = allPaths.has(key);
  out.push(`### \`${key}\``);
  out.push("");
  if (isToken) {
    if (semanticPaths.has(key)) {
      out.push(
        `\`var(--${PREFIX}-${key.replaceAll(".", "-")})\` · light \`${themeValues.light[key]}\` · dark \`${themeValues.dark[key]}\``
      );
    } else {
      out.push(`\`var(--${PREFIX}-${key.replaceAll(".", "-")})\` · \`${themeValues.light[key]}\``);
    }
    out.push("");
  }
  out.push(entry.summary);
  out.push("");
  if (entry.scale) {
    out.push("| Step | CSS variable | Value | Use for |");
    out.push("|---|---|---|---|");
    for (const [step, desc] of Object.entries(entry.scale)) {
      const full = `${key}.${step}`;
      const resolved = themeValues.light[full];
      const varName = allPaths.has(full) ? `\`var(--${PREFIX}-${full.replaceAll(".", "-")})\`` : "—";
      const value = allPaths.has(full) ? `\`${resolved}\`` : "—";
      // Scale descriptions lead with the value ("16px — the default…") so they read
      // on their own in the CSS comments and JSDoc; the table has a Value column
      // already, so drop the duplicated prefix here.
      const text = resolved && desc.startsWith(`${resolved} — `) ? desc.slice(resolved.length + 3) : desc;
      out.push(`| \`${step}\` | ${varName} | ${value} | ${text} |`);
    }
    out.push("");
  }
  if (entry.use?.length) {
    out.push("**Use for**");
    out.push("");
    out.push(bullets(entry.use));
    out.push("");
  }
  if (entry.dont?.length) {
    out.push("**Do not use for**");
    out.push("");
    out.push(bullets(entry.dont));
    out.push("");
  }
  if (entry.instead) {
    out.push("**Use instead**");
    out.push("");
    out.push("| Instead of reaching for this | Use |");
    out.push("|---|---|");
    for (const [what, token] of Object.entries(entry.instead)) out.push(`| ${what} | \`${token}\` |`);
    out.push("");
  }
  if (entry.pairsWith?.length) {
    out.push(`**Pairs with** ${entry.pairsWith.map((p) => `\`${p}\``).join(", ")}`);
    out.push("");
  }
  if (entry.notes?.length) {
    for (const n of entry.notes) out.push(`> ${n}`);
    out.push("");
  }
  if (entry.example?.css) {
    out.push("```css");
    out.push(entry.example.css);
    out.push("```");
    out.push("");
  }
  return out.join("\n");
}

const semanticEntries = Object.entries(usage.tokens).filter(([k]) => semanticPaths.has(k));
const paletteEntries = Object.entries(usage.tokens).filter(([, e]) => e.layer === "palette");
const baseEntries = Object.entries(usage.tokens).filter(([, e]) => e.layer === "base");

md.push("## Semantic tokens");
md.push("");
md.push("These are the only color and elevation tokens a component may use. Each one is the correct answer to exactly one styling question, and each is the only thing that differs between the light and dark theme.");
md.push("");
for (const [k, e] of semanticEntries) md.push(renderToken(k, e));

md.push("## Palette tokens (reference only)");
md.push("");
md.push("Raw ramps. Except `color.data.*`, they do not change between themes, so a component that uses one is broken in the other. They exist mainly as reference targets for the semantic tokens above.");
md.push("");
for (const [k, e] of paletteEntries) md.push(renderToken(k, e));

md.push("## Base scales");
md.push("");
md.push("Theme-independent scales for everything that is not a themed color.");
md.push("");
for (const [k, e] of baseEntries) md.push(renderToken(k, e));

md.push("## Verified contrast");
md.push("");
md.push(
  "Ratios are measured from the resolved token values every build. A pairing listed here is guaranteed to hold: " +
    "if a token change breaks one, the build fails."
);
md.push("");
md.push("`AA-text` needs 4.5:1 · `AA-large` and `AA-nontext` need 3:1.");
md.push("");
md.push("| Foreground | Background | Level | Light | Dark |");
md.push("|---|---|---|---|---|");
for (const p of contrastReport) {
  const cell = (t) => (p.measured[t] === undefined ? "n/a" : `${p.measured[t].toFixed(2)}:1`);
  md.push(`| \`${p.fg}\` | \`${p.bg}\` | ${p.requires} | ${cell("light")} | ${cell("dark")} |`);
}
md.push("");
md.push("### Known gaps — do not use these combinations");
md.push("");
md.push(
  "These combinations fall short of the stated level. They are verified every build too: if a token change closes one, " +
    "the build fails so the gap gets promoted to a guarantee instead of going stale."
);
md.push("");
md.push("| Foreground | Background | Falls short of | Light | Dark |");
md.push("|---|---|---|---|---|");
for (const g of gapReport) {
  const cell = (t) => (g.measured[t] === undefined ? "n/a" : `${g.measured[t].toFixed(2)}:1`);
  md.push(`| \`${g.fg}\` | \`${g.bg}\` | ${g.below} | ${cell("light")} | ${cell("dark")} |`);
}
md.push("");
for (const g of gapReport) {
  const why = g.note ? `${g.note} ` : "";
  md.push(`- **\`${g.fg}\` on \`${g.bg}\`** (${g.themes.join(", ")}) — ${why}${g.workaround ?? ""}`);
}
md.push("");

md.push("## Component recipes");
md.push("");
md.push("The exact token for every property of a common component. Build from these rather than choosing tokens one at a time.");
md.push("");
for (const [name, recipe] of Object.entries(usage.recipes)) {
  md.push(`### ${name}`);
  md.push("");
  md.push(recipe.summary);
  md.push("");
  md.push("| Property | Token |");
  md.push("|---|---|");
  for (const [prop, token] of Object.entries(recipe.tokens)) md.push(`| ${prop} | ${markTokens(token)} |`);
  md.push("");
}

const markdown = md.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

/* ---- Write ------------------------------------------------------- */

const mdPath = path.join(root, "TOKENS.md");

if (CHECK_ONLY) {
  const existing = await readFile(mdPath, "utf8").catch(() => null);
  if (existing !== markdown) {
    console.error(
      "@rata/tokens: TOKENS.md is out of date with the contracts in src/contracts/.\n" +
        "Run `npm run build -w @rata/tokens` and commit the result."
    );
    process.exit(1);
  }
  console.log("@rata/tokens: TOKENS.md is up to date.");
  process.exit(0);
}

await rm(path.join(root, "dist"), { recursive: true, force: true });
await mkdir(path.join(root, "dist/css"), { recursive: true });
await mkdir(path.join(root, "dist/tailwind"), { recursive: true });
await writeFile(path.join(root, "dist/css/tokens.css"), css);
await writeFile(path.join(root, "dist/index.js"), js);
await writeFile(path.join(root, "dist/index.d.ts"), dts);
await writeFile(path.join(root, "dist/tailwind/preset.cjs"), tw);
await writeFile(path.join(root, "dist/usage.json"), usageJson);
await writeFile(mdPath, markdown);

console.log(
  `@rata/tokens built: theme "${themeName}" — ${flatBase.length} base + ` +
    `${flatLight.length} generated (${variantPaths.size} scheme-dependent), ` +
    `${Object.keys(usage.tokens).length} documented entries, ` +
    `${contrastReport.length} verified pairings, ${gapReport.length} known gaps, ` +
    `${Object.keys(usage.recipes).length} recipes`
);
