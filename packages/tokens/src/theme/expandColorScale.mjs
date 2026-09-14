/**
 * @file expandColorScale.mjs
 * @input Color scale config { accent?, neutralStyle?, contrast? }
 * @output Token overrides for the theme-derivable colour roles
 * @position Theme utility; consumed by defineTheme.mjs
 *
 * Generates the semantic colour layer from an accent seed using HCT. Only
 * roles that *meaningfully derive* from an accent are produced here; status
 * colours (success / warning / danger), the categorical data ramps, rings and
 * elevation are deliberately left alone, exactly as Astryx leaves them — they
 * are convention-bound, not brand-derived, so a theme states them outright.
 *
 * Ported from Meta's Astryx (MIT), adapted to this repo's dotted token paths
 * and its `theme.*` semantic role names. Astryx's tone assignments are
 * reproduced as-is, because the tone numbers *are* the accessibility
 * argument — see below.
 *
 * WCAG guarantees, verified every build by usage.json's pairings:
 * - Text tones clear 4.5:1 against their surfaces by tone spacing alone. HCT
 *   tone is CIE L*, which pins relative luminance regardless of hue and
 *   chroma, so the fixed assignments hold for *any* accent a brand seeds
 *   (WCAG 1.4.3). That is the whole reason to generate rather than hand-pick:
 *   a new brand colour cannot silently break contrast.
 * - theme.border.strong outlines form controls, so it is a non-text boundary
 *   under WCAG 1.4.11 and is tone-walked until it reaches 3:1.
 * - theme.border.default is a decorative hairline and is NOT held to 3:1.
 *
 * SYNC: when this changes, update
 * - packages/tokens/src/theme/theme.test.mjs
 * - packages/tokens/THEME-ENGINE.md
 */

import { contrastRatio, hexWithAlpha } from "./color.mjs";
import { hexToHct, hctToHex, tonalPalette } from "./hct.mjs";

/** How much of the seed's hue bleeds into the greys. */
const NEUTRAL_CHROMA = { warm: 7, cool: 5, neutral: 3 };
const NEUTRAL_VARIANT_CHROMA = { warm: 10, cool: 8, neutral: 6 };

/**
 * Hue source for accent-less configs. Only the *hue* reaches the output: the
 * accent roles stay ungenerated so they keep whatever the theme states.
 */
const DEFAULT_ACCENT_SEED = "#0064E0";

/** WCAG 1.4.11 minimum for non-text UI boundaries. */
const NON_TEXT_MIN_CONTRAST = 3;

/**
 * The raw accent ramp's shape, read off the ramp this repo shipped by hand
 * (Tailwind's blue) and kept as the rule rather than the output: tone falls
 * 96.6 → 16.2 across the eleven steps, while chroma rises to a peak just past
 * the middle and drops again at both ends. That curve is what makes a ramp
 * read as one family instead of eleven tints, and it holds for any hue.
 *
 * Chroma is scaled by `seed chroma / 80.1` — 80.1 being step 600's chroma in
 * the reference ramp, the step the seed itself anchors. Scaling rather than
 * clamping is what keeps the curve's *shape*: a `min()` against each step
 * flattens the peak at 700 and quietly turns the ramp into a different ramp,
 * which is exactly what it did before this was changed. A muted brand gets a
 * proportionally muted ramp; a more saturated one is pushed past sRGB and
 * gamut-mapped by hctToHex, which is the right failure mode.
 *
 * `hueShift` is the third part of the curve and the easy one to miss: the
 * hand-tuned ramp does not hold one hue, it drifts about 30 degrees cooler at
 * the light end and a few degrees warmer at 700. Pinning every step to the
 * seed's hue instead produced light tints visibly off from the ramp it
 * replaced, so the drift is reproduced as a per-step offset. The seed's hue is
 * step 600's, which is why that step's offset is zero — the ramp is anchored
 * on the colour the brand actually named.
 *
 * WHY GENERATE THIS AT ALL: a ramp named `accent` that ignores the accent is
 * indefensible — it made the Colors page show blue under a red brand. Tone is
 * CIE L*, so a generated ramp keeps each step's lightness regardless of hue,
 * which is the same argument the semantic layer rests on.
 */
/**
 * The chroma floor the accent palette is built at. A seed below it does not
 * carry enough colour to derive a scale from, so it is lifted to this before
 * either the roles or the ramp are generated — which is why a near-black seed
 * yields a saturated accent at its hue rather than a near-black one.
 */
const PALETTE_MIN_CHROMA = 48;

/** Step 600's chroma in the reference ramp — the seed's own anchor point. */
const ACCENT_RAMP_REFERENCE_CHROMA = 80.1;

const ACCENT_RAMP_SHAPE = [
  { step: "50", tone: 96.6, chroma: 5.2, hueShift: -30.1 },
  { step: "100", tone: 92.2, chroma: 11.4, hueShift: -28.1 },
  { step: "200", tone: 86.5, chroma: 20.2, hueShift: -27.8 },
  { step: "300", tone: 78.0, chroma: 32.8, hueShift: -26.9 },
  { step: "400", tone: 66.7, chroma: 48.9, hueShift: -18.7 },
  { step: "500", tone: 55.6, chroma: 66.8, hueShift: -7.6 },
  { step: "600", tone: 46.1, chroma: 80.1, hueShift: 0 },
  { step: "700", tone: 39.0, chroma: 83.1, hueShift: 3.4 },
  { step: "800", tone: 31.9, chroma: 69.3, hueShift: 3.2 },
  { step: "900", tone: 27.1, chroma: 51.6, hueShift: 0 },
  { step: "950", tone: 16.2, chroma: 32.7, hueShift: -1.3 },
];

/**
 * The raw neutral ramp's shape, read off the ramp this repo shipped by hand
 * (Tailwind's slate) on the same principle as ACCENT_RAMP_SHAPE: the curve is
 * the rule, the hue is the variable.
 *
 * Chroma is scaled by `neutralStyle`'s own chroma over 5 — 5 being `cool`, the
 * style the hand-listed ramp was drawn at — so `cool` reproduces it and warm or
 * neutral move the whole ramp's greyness together with the semantic neutrals
 * rather than independently of them. That coupling is the point: the greys in
 * theme.bg.* and the greys in color.neutral.* came from one decision, so they
 * should not be able to disagree.
 *
 * WHY GENERATE THIS: exactly the reason color.accent.* is generated. A neutral
 * ramp that ignored the seed left a green-accented system carrying blue-grey
 * raw neutrals, while its own semantic greys re-toned correctly — the two
 * halves of the same palette disagreeing about the brand.
 */
const NEUTRAL_RAMP_REFERENCE_CHROMA = 5;

const NEUTRAL_RAMP_SHAPE = [
  { step: "50", tone: 98.2, chroma: 1.2, hueShift: -13.1 },
  { step: "100", tone: 96.3, chroma: 2.5, hueShift: -12.9 },
  { step: "200", tone: 91.8, chroma: 4.6, hueShift: -5.2 },
  { step: "300", tone: 84.9, chroma: 7.1, hueShift: -7.2 },
  { step: "400", tone: 66.5, chroma: 12.6, hueShift: -2.0 },
  { step: "500", tone: 48.3, chroma: 14.5, hueShift: 0 },
  { step: "600", tone: 35.7, chroma: 13.3, hueShift: 0.5 },
  { step: "700", tone: 27.1, chroma: 13.8, hueShift: 1.8 },
  { step: "800", tone: 16.4, chroma: 13.1, hueShift: 6.0 },
  { step: "900", tone: 8.0, chroma: 14.5, hueShift: 14.6 },
  { step: "950", tone: 1.9, chroma: 9.0, hueShift: 14.4 },
];

/**
 * The raw `color.neutral.*` ramp for a seed hue at a given neutral chroma.
 *
 * Scheme-independent, like the accent ramp: one ramp per brand, identical in
 * light and dark, which is what the palette layer promises.
 */
function neutralRamp(seedHue, neutralChroma) {
  const scale = neutralChroma / NEUTRAL_RAMP_REFERENCE_CHROMA;
  const ramp = {};
  for (const { step, tone, chroma, hueShift } of NEUTRAL_RAMP_SHAPE) {
    ramp[`color.neutral.${step}`] = hctToHex({
      hue: ((seedHue + hueShift) % 360 + 360) % 360,
      chroma: chroma * scale,
      tone,
    });
  }
  return ramp;
}

/**
 * The raw `color.accent.*` ramp for a seed.
 *
 * Chroma is floored at PALETTE_MIN_CHROMA first, for the same reason the
 * accent roles floor it: below that a seed carries too little colour to build
 * a ramp from, and the two layers have to agree. Without the floor a near-black
 * seed (#15151B, chroma 4.5) produced a grey ramp sitting beside a blue-violet
 * role fill — same seed, same hue, two different answers.
 *
 * Scheme-independent by design: one ramp per brand, identical in light and
 * dark, which is what the palette layer promises and what lets a component
 * that (wrongly) reaches for a palette token at least stay consistent. With a
 * per-scheme accent pair the light seed wins — the raw ramp is the brand's
 * palette, and a brand has one.
 */
function accentRamp(seedHue, seedChroma) {
  const effective = Math.max(seedChroma, PALETTE_MIN_CHROMA);
  const ramp = {};
  for (const { step, tone, chroma, hueShift } of ACCENT_RAMP_SHAPE) {
    ramp[`color.accent.${step}`] = hctToHex({
      // Hue is circular, so the offset is taken modulo 360 rather than clamped.
      hue: ((seedHue + hueShift) % 360 + 360) % 360,
      chroma: chroma * (effective / ACCENT_RAMP_REFERENCE_CHROMA),
      tone,
    });
  }
  return ramp;
}

/**
 * Walk tone in `step` increments from `startTone` until the colour reaches
 * `minRatio` against `background`.
 *
 * Needed for tokens whose preferred tone isn't guaranteed by spacing alone.
 * Because tone is CIE L*, each step moves luminance monotonically, so this
 * always terminates — at worst at black or white, which is 21:1 against
 * anything mid-range.
 */
export function ensureContrastTone(
  hue,
  chroma,
  startTone,
  step,
  background,
  minRatio,
) {
  let tone = startTone;
  let hex = hctToHex({ hue, chroma, tone });
  while (
    contrastRatio(hex, background) < minRatio &&
    tone + step >= 0 &&
    tone + step <= 100
  ) {
    tone += step;
    hex = hctToHex({ hue, chroma, tone });
  }
  return hex;
}

/**
 * @typedef {object} ColorScaleConfig
 * @property {string | [light: string, dark: string]} [accent]
 *   Seed accent. A tuple seeds each scheme from its own colour; a string
 *   seeds both identically. Omit to re-tone only the neutrals.
 * @property {'warm'|'cool'|'neutral'} [neutralStyle] Grey temperature. Default 'cool'.
 * @property {'standard'|'high'} [contrast] 'high' widens the text/surface tone gap.
 */

/**
 * Expand a colour config into token overrides, as `[light, dark]` tuples.
 * @param {ColorScaleConfig} config
 * @returns {Record<string, string | [string, string]>}
 */
export function expandColorScale(config) {
  const { accent, neutralStyle = "cool", contrast = "standard" } = config;

  // Normalise to per-scheme seeds. A string (or absent) accent uses one seed
  // for both halves, which keeps single-seed output identical to Astryx's.
  const [lightAccent, darkAccent] = Array.isArray(accent)
    ? accent
    : [accent, accent];

  const lightSeed = hexToHct(lightAccent ?? DEFAULT_ACCENT_SEED);
  const sameSeed = darkAccent === lightAccent;
  const darkSeed = sameSeed
    ? lightSeed
    : hexToHct(darkAccent ?? DEFAULT_ACCENT_SEED);

  const nc = NEUTRAL_CHROMA[neutralStyle] ?? 5;
  const nvc = NEUTRAL_VARIANT_CHROMA[neutralStyle] ?? 8;

  // *L palettes feed the light half of each pair, *D the dark half. With a
  // single seed the D palettes alias the L ones.
  const PL = tonalPalette(lightSeed.hue, Math.max(lightSeed.chroma, PALETTE_MIN_CHROMA));
  const NL = tonalPalette(lightSeed.hue, nc);
  const NVL = tonalPalette(lightSeed.hue, nvc);
  const PD = sameSeed
    ? PL
    : tonalPalette(darkSeed.hue, Math.max(darkSeed.chroma, PALETTE_MIN_CHROMA));
  const ND = sameSeed ? NL : tonalPalette(darkSeed.hue, nc);
  const NVD = sameSeed ? NVL : tonalPalette(darkSeed.hue, nvc);

  const isHigh = contrast === "high";

  const textPrimaryL = isHigh ? 0 : 10;
  const textPrimaryD = isHigh ? 99 : 90;
  const textSecondaryL = isHigh ? 20 : 30;
  const textSecondaryD = isHigh ? 80 : 70;

  // High contrast doubles the decorative hairline's alpha so structural
  // boundaries stay perceivable for people who opted in.
  const borderAlpha = isHigh ? 0.2 : 0.1;

  // The modal scrim. Stronger in the dark scheme for a reason that is easy to
  // miss: at the same alpha a dark scrim over an already-dark canvas barely
  // separates the two, so the modal stops reading as raised. High contrast
  // takes both up, on the same logic as borderAlpha above — the boundary
  // between "in the dialog" and "not in the dialog" is structural.
  const scrimAlpha = isHigh ? [0.7, 0.85] : [0.5, 0.7];

  // Emphasized borders outline form controls — a 1.4.11 boundary. High
  // contrast starts mid-scale (guaranteeing a stronger result); standard
  // starts at 70/30 and walks only as far as it must.
  const borderStrong = [
    ensureContrastTone(
      lightSeed.hue,
      nvc,
      isHigh ? 50 : 70,
      -1,
      NL[99],
      NON_TEXT_MIN_CONTRAST,
    ),
    ensureContrastTone(
      darkSeed.hue,
      nvc,
      isHigh ? 50 : 30,
      1,
      ND[10],
      NON_TEXT_MIN_CONTRAST,
    ),
  ];

  const accentRoleBg = [PL[40], PD[80]];
  const accentRoleFg = [PL[40], PD[80]];

  return {
    // ── Accent roles — only with a seed. Without one these are omitted so
    // the theme's own values stand: defaulting the seed instead would
    // silently re-accent every neutral-only brand.
    ...(accent != null
      ? {
          ...accentRamp(lightSeed.hue, lightSeed.chroma),
          "theme.accent-role.bg": accentRoleBg,
          "theme.accent-role.fg": accentRoleFg,
          // A tint, not a fill — and opaque, deliberately. Astryx makes the
          // equivalent token an alpha overlay so it composes over any
          // surface. This system asserts *measured* contrast for the text
          // that sits on it, and a translucent background has no measurable
          // ratio until you know what is behind it. An opaque tonal stop
          // trades that composability for a number the build can enforce.
          "theme.accent-role.subtle": [PL[90], PD[20]],
          "theme.fg.on-accent": [PL[100], PD[20]],
          "theme.tertiary-role.fg": accentRoleFg,
          // Focus is the accent at a mid tone: it must read as a boundary
          // against both canvas and surface, which usage.json asserts at
          // AA-nontext in both schemes.
          "theme.focus-ring": [PL[50], PD[70]],
        }
      : null),

    // The raw neutral ramp, generated for the same reason the accent ramp is,
    // and unconditionally for the same reason the semantic neutrals below are:
    // an accent-less config still re-tones its greys, from the default hue.
    ...neutralRamp(lightSeed.hue, nc),

    // ── Backgrounds. Surface is the *lifted* tone (99/10) and canvas the
    // tinted page behind it (95/5) — cards float rather than merge, which
    // is what makes elevation legible without a border.
    "theme.bg.surface": [NL[99], ND[10]],
    "theme.bg.canvas": [NL[95], ND[5]],
    // A quiet band inside a surface takes the canvas tone.
    // 97/15, not 95/10 — those were bg.canvas and bg.surface exactly, so this
    // step resolved to a duplicate of a neighbour in BOTH schemes and could
    // not do the job its contract describes. One step below surface in each:
    // slightly darker in light, slightly lighter in dark, which is the
    // direction bg.muted already goes.
    "theme.bg.subtle": [NL[97], ND[15]],
    // The most recessed step — tracks, wells, skeletons.
    "theme.bg.muted": [NL[90], ND[20]],

    // ── Text
    "theme.fg.primary": [NL[textPrimaryL], ND[textPrimaryD]],
    "theme.fg.secondary": [NVL[textSecondaryL], NVD[textSecondaryD]],
    // Astryx puts its equivalent (text-disabled) at tone 60/40, which is
    // deliberately sub-AA — disabled text is exempt under WCAG 1.4.3. This
    // system's muted role is documented for *placeholders*, which are not
    // exempt and must stay readable, so it sits a step stronger at 40/60.
    "theme.fg.muted": [NVL[40], NVD[60]],

    // ── Secondary role (outlined controls) tracks the surface ladder.
    "theme.secondary-role.bg": [NL[99], ND[10]],
    "theme.secondary-role.fg": [NL[textPrimaryL], ND[textPrimaryD]],
    "theme.secondary-role.border": borderStrong,

    // ── Borders
    "theme.border.default": [
      hexWithAlpha(NL[10], borderAlpha),
      hexWithAlpha(ND[95], borderAlpha),
    ],
    "theme.border.strong": borderStrong,

    // Tone 10 rather than 0: pure black is hue-less, and taking the neutral's
    // own tone means `ink` and `pine` dim with their own neutrals instead of
    // every brand sharing one grey. The same tone the light hairline uses.
    "theme.scrim": [
      hexWithAlpha(NL[10], scrimAlpha[0]),
      hexWithAlpha(ND[10], scrimAlpha[1]),
    ],
  };
}
