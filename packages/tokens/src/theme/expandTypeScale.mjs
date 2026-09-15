/**
 * @file expandTypeScale.mjs
 * @input Type scale config { base, ratio, weights? }
 * @output Token overrides for raw size steps and semantic text roles
 * @position Theme utility; consumed by defineTheme.mjs
 *
 * Computes a whole typography set from a base size and a ratio, as a
 * geometric progression: size = base × ratio^step.
 *
 * Two layers, same as Astryx:
 *   Layer 1  raw size steps      font.size.4xs … font.size.5xl   (its --font-size-*)
 *   Layer 2  semantic roles      type.<role>.{size,weight,line-height}  (its --text-*)
 *
 * Layer 1 lands on `font.size.*`, replacing the hand-listed step names that
 * scale carried before. The generator owns sizing now; `primitives/font.json`
 * keeps only what a ratio cannot produce — family, weight, letter-spacing.
 *
 * Ported from Meta's Astryx (MIT). Step tables, the tiered leading targets,
 * and the 4px snapping are reproduced exactly. Two adaptations:
 *  - emits this repo's dotted token paths;
 *  - Layer 2 sizes resolve to literals via `{font.size.*}` refs rather than
 *    staying as CSS `var()` chains. This repo resolves every reference at
 *    build time so `usage.json` can *measure* the value it documents — a
 *    var() chain cannot be measured. THEME-ENGINE.md covers the trade.
 *
 * SYNC: when this changes, update
 * - packages/tokens/src/theme/theme.test.mjs
 * - packages/tokens/THEME-ENGINE.md
 */

/** Step → raw size token name. Matches Astryx's 12-step table exactly. */
const STEP_TO_SIZE = {
  "-5": "4xs",
  "-4": "3xs",
  "-3": "2xs",
  "-2": "xs",
  "-1": "sm",
  0: "base",
  1: "lg",
  2: "xl",
  3: "2xl",
  4: "3xl",
  5: "4xl",
  6: "5xl",
};

/** Heading level → step. h4 sits at the body step; h1 three above it. */
const HEADING_STEPS = { 1: 3, 2: 2, 3: 1, 4: 0, 5: -1, 6: -2 };

/** Text role → step. display-* continue the progression above h1. */
const TEXT_STEPS = {
  body: 0,
  // Three steps above body, not one. This role's own contract calls it "for
  // lead paragraphs", and one step above body was 17px against 14px — close
  // enough that a lead paragraph did not read as one. Steps 2 and 3 carried
  // no text role at all, so the progression jumped from lg straight to
  // display-3 at 3xl and there was nothing to set prose at in between.
  large: 3,
  label: 0,
  code: 0,
  supporting: -1,
  "display-1": 6,
  "display-2": 5,
  "display-3": 4,
};

const DEFAULT_HEADING_WEIGHTS = {
  1: "{font.weight.semibold}",
  2: "{font.weight.semibold}",
  3: "{font.weight.semibold}",
  4: "{font.weight.semibold}",
  5: "{font.weight.semibold}",
  6: "{font.weight.semibold}",
};

const DEFAULT_TEXT_WEIGHTS = {
  body: "{font.weight.regular}",
  // Regular, not semibold. A lead paragraph is still a paragraph, and at the
  // size this role now sits at a semibold one reads as a heading that forgot
  // to be one — the same reason every display role is regular.
  large: "{font.weight.regular}",
  label: "{font.weight.medium}",
  code: "{font.weight.regular}",
  supporting: "{font.weight.regular}",
  "display-1": "{font.weight.regular}",
  "display-2": "{font.weight.regular}",
  "display-3": "{font.weight.regular}",
};

/** Geometric step, rounded to whole px. */
function computeSize(base, ratio, step) {
  return Math.round(base * Math.pow(ratio, step));
}

/** px → rem against a 16px root. */
function pxToRem(px) {
  return `${Math.round((px / 16) * 10000) / 10000}rem`;
}

/**
 * Tiered target leading. Small text needs proportionally more room to
 * breathe than display text, which looks slack at the same ratio.
 *   < 20px  → 1.5   body and small UI
 *   20–31px → 1.4   medium headings
 *   >= 32px → 1.25  display
 */
function targetLeadingRatio(fontSize) {
  return fontSize < 20 ? 1.5 : fontSize < 32 ? 1.4 : 1.25;
}

/**
 * Unitless leading, snapped so the computed px lands on a 4px grid, with a
 * floor of fontSize + 4px so nothing ever sets solid or overlapping.
 */
function computeLeading(fontSize) {
  const target = targetLeadingRatio(fontSize);
  const snapped = Math.max(
    Math.round((fontSize * target) / 4) * 4,
    Math.ceil((fontSize + 4) / 4) * 4,
  );
  return Math.round((snapped / fontSize) * 10000) / 10000;
}

/**
 * @typedef {object} TypeScaleConfig
 * @property {number} base   Body size in px.
 * @property {number} ratio  Step between sizes. 1.125 dense · 1.2 default · 1.333 dramatic.
 * @property {{heading?: Record<number, string>, text?: Record<string, string>}} [weights]
 */

/**
 * Expand a type scale config into token overrides.
 * @param {TypeScaleConfig} config
 * @returns {Record<string, string>}
 */
export function expandTypeScale(config) {
  const { base, ratio, weights } = config;
  const tokens = {};

  const headingWeights = { ...DEFAULT_HEADING_WEIGHTS, ...weights?.heading };
  const textWeights = { ...DEFAULT_TEXT_WEIGHTS, ...weights?.text };

  // ── Layer 1: raw size steps ───────────────────────────────────────────────
  for (let step = -5; step <= 6; step++) {
    tokens[`font.size.${STEP_TO_SIZE[step]}`] = pxToRem(
      computeSize(base, ratio, step),
    );
  }

  // ── Layer 2: semantic roles ───────────────────────────────────────────────
  for (const [level, step] of Object.entries(HEADING_STEPS)) {
    const size = computeSize(base, ratio, step);
    tokens[`type.heading-${level}.size`] = `{font.size.${STEP_TO_SIZE[step]}}`;
    tokens[`type.heading-${level}.weight`] = headingWeights[level];
    tokens[`type.heading-${level}.line-height`] = `${computeLeading(size)}`;
  }

  for (const [role, step] of Object.entries(TEXT_STEPS)) {
    const size = computeSize(base, ratio, step);
    tokens[`type.${role}.size`] = `{font.size.${STEP_TO_SIZE[step]}}`;
    tokens[`type.${role}.weight`] = textWeights[role];
    tokens[`type.${role}.line-height`] = `${computeLeading(size)}`;
  }

  return tokens;
}
