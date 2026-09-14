/**
 * @file defineTheme.mjs
 * @input A theme declaration — seeds, explicit tokens, an optional base theme
 * @output A frozen, resolved theme object { name, tokens, ... }
 * @position Theme entry point; consumed by build.mjs and theme packages
 *
 * The composition layer. A theme states a handful of *seeds* and the
 * expanders turn them into a coherent token set; anything the seeds get
 * wrong, the theme overrides outright in `tokens`.
 *
 * Ported from Meta's Astryx (MIT), adapted to this repo's dotted token paths.
 *
 * PRECEDENCE, lowest to highest — the order is the whole contract:
 *   0.  extends          the base theme's resolved tokens
 *   1.  color            expandColorScale
 *   1a. typography.scale expandTypeScale
 *   1b. radius           expandRadiusScale
 *   1c. motion           expandMotionScale
 *   1d. typography fonts font.family.*
 *   2.  tokens           explicit overrides — always win
 *
 * Scale configs REPLACE a base's rather than merging: they are inputs to a
 * generator, not values. Half-merging two ratios yields a scale neither
 * author asked for.
 *
 * SYNC: when this changes, update
 * - packages/tokens/src/theme/theme.test.mjs
 * - packages/tokens/THEME-ENGINE.md
 */

import { expandColorScale } from "./expandColorScale.mjs";
import { expandTypeScale } from "./expandTypeScale.mjs";
import { expandRadiusScale } from "./expandRadiusScale.mjs";
import { expandMotionScale } from "./expandMotionScale.mjs";

const THEME_BRAND = Symbol.for("@rata/tokens.definedTheme");

/** Is this a theme produced by defineTheme()? */
export function isDefinedTheme(value) {
  return (
    typeof value === "object" && value !== null && value[THEME_BRAND] === true
  );
}

function describeBadBase(value) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value !== "object") return `a ${typeof value}`;
  return "a plain object (not from defineTheme)";
}

/** Build a font-family stack from a family name and its fallbacks. */
function buildFontFamily(family, fallbacks) {
  const quoted =
    family && /[\s]/.test(family) && !/^['"]/.test(family)
      ? `'${family}'`
      : family;
  if (quoted && fallbacks) return `${quoted}, ${fallbacks}`;
  return quoted ?? fallbacks ?? undefined;
}

/**
 * @typedef {object} DefineThemeInput
 * @property {string} name                        Registry key; becomes the data-theme value.
 * @property {object} [extends]                   A theme from defineTheme() to start from.
 * @property {import('./expandColorScale.mjs').ColorScaleConfig} [color]
 * @property {{scale?: {base: number, ratio: number}, body?: object, heading?: object, code?: object}} [typography]
 * @property {import('./expandRadiusScale.mjs').RadiusScaleConfig} [radius]
 * @property {import('./expandMotionScale.mjs').MotionScaleConfig} [motion]
 * @property {Record<string, string | [string, string]>} [tokens] Explicit overrides.
 */

/**
 * Define a theme.
 * @param {DefineThemeInput} input
 * @returns {{name: string, tokens: Record<string, string | [string, string]>}}
 */
export function defineTheme(input) {
  if (!input || typeof input.name !== "string" || input.name.length === 0) {
    throw new Error("defineTheme: `name` is required and must be a string.");
  }

  /** @type {Record<string, string | [string, string]>} */
  const tokens = {};

  // ── 0. extends ────────────────────────────────────────────────────────────
  // A base that is not a theme is refused rather than ignored. Silently
  // inheriting nothing is what a mis-resolved import hands over, and the
  // theme then builds into a plausible-looking stylesheet missing everything
  // it was supposed to inherit.
  if ("extends" in input && !isDefinedTheme(input.extends)) {
    throw new Error(
      `defineTheme("${input.name}"): \`extends\` must be a theme from defineTheme(), ` +
        `got ${describeBadBase(input.extends)}.`,
    );
  }
  const base = input.extends;
  if (base) Object.assign(tokens, base.tokens);

  // ── 1. colour ─────────────────────────────────────────────────────────────
  if (input.color) Object.assign(tokens, expandColorScale(input.color));

  // ── 1a. type scale ────────────────────────────────────────────────────────
  const typo = input.typography;
  if (typo?.scale) {
    const headingWeights = {};
    for (const [level, w] of Object.entries(typo.heading?.weights ?? {})) {
      if (w) headingWeights[level] = w;
    }
    Object.assign(
      tokens,
      expandTypeScale({
        ...typo.scale,
        weights: Object.keys(headingWeights).length
          ? { heading: headingWeights }
          : undefined,
      }),
    );
  }

  // ── 1b/1c. radius and motion ──────────────────────────────────────────────
  if (input.radius) Object.assign(tokens, expandRadiusScale(input.radius));
  if (input.motion) Object.assign(tokens, expandMotionScale(input.motion));

  // ── 1d. font families ─────────────────────────────────────────────────────
  // Naming a family here does not load it. A named family with no font file
  // loads nothing and warns about nothing — the fallback silently becomes
  // the theme, which is why `fallbacks` is worth always supplying.
  if (typo) {
    const body = buildFontFamily(typo.body?.family, typo.body?.fallbacks);
    const heading =
      buildFontFamily(typo.heading?.family, typo.heading?.fallbacks) ?? body;
    const code = buildFontFamily(typo.code?.family, typo.code?.fallbacks);

    if (body) tokens["font.family.sans"] = body;
    if (heading) tokens["font.family.heading"] = heading;
    if (code) tokens["font.family.mono"] = code;
  }

  // ── 2. explicit tokens — always win ───────────────────────────────────────
  if (input.tokens) Object.assign(tokens, input.tokens);

  return Object.freeze({
    [THEME_BRAND]: true,
    name: input.name,
    tokens: Object.freeze(tokens),
  });
}
