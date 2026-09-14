/**
 * @file hct.mjs
 * @input Hex colour string (#RRGGBB)
 * @output HCT (Hue, Chroma, Tone) representation and tonal palettes
 * @position Theme utility; consumed by expandColorScale.mjs
 *
 * Minimal HCT colour space. Ported from Meta's Astryx (MIT), which in turn
 * ported it from Google's material-color-utilities (Apache-2.0). Zero
 * dependencies — all the matrix and Lab math is inline.
 *
 * HCT combines:
 * - Hue   from CIELab (perceptually uniform hue)
 * - Chroma approximated via CIELab C*ab (colourfulness)
 * - Tone  from L* (CIE Lightness, 0 = black, 100 = white)
 *
 * WHY THIS MATTERS HERE: tone is CIE L*, which fixes relative luminance
 * independent of hue and chroma. So a token placed at a given tone holds its
 * WCAG contrast against a surface at another tone *for any accent colour a
 * theme seeds*. That is the property that lets expandColorScale.mjs promise
 * >= 4.5:1 text without re-measuring per brand — the tone assignments carry
 * the guarantee, not the specific hexes.
 */

import { parseHex, formatHex } from "./color.mjs";

/** @typedef {{hue: number, chroma: number, tone: number}} HCT */

// ── sRGB <-> linear RGB ─────────────────────────────────────────────────────

function srgbToLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c) {
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(Math.min(255, Math.max(0, s * 255)));
}

// ── linear RGB <-> XYZ (D65) ────────────────────────────────────────────────

function linearRgbToXyz(r, g, b) {
  return [
    0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  ];
}

function xyzToLinearRgb(x, y, z) {
  return [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ];
}

// ── XYZ <-> L*a*b* ──────────────────────────────────────────────────────────

const D65_WHITE = [0.95047, 1.0, 1.08883];

function labF(t) {
  const delta = 6 / 29;
  return t > delta * delta * delta
    ? Math.cbrt(t)
    : t / (3 * delta * delta) + 4 / 29;
}

function labFInv(t) {
  const delta = 6 / 29;
  return t > delta ? t * t * t : 3 * delta * delta * (t - 4 / 29);
}

function xyzToLab(x, y, z) {
  const fx = labF(x / D65_WHITE[0]);
  const fy = labF(y / D65_WHITE[1]);
  const fz = labF(z / D65_WHITE[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labToXyz(L, a, b) {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  return [
    labFInv(fx) * D65_WHITE[0],
    labFInv(fy) * D65_WHITE[1],
    labFInv(fz) * D65_WHITE[2],
  ];
}

function toneToY(tone) {
  return labFInv((tone + 16) / 116);
}

// ── hex <-> HCT ─────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const parsed = parseHex(hex);
  return parsed === null ? [0, 0, 0] : [parsed.r, parsed.g, parsed.b];
}

/**
 * Convert a hex colour to HCT.
 * Hue 0–360, chroma 0–~120, tone 0–100.
 * @param {string} hex
 * @returns {HCT}
 */
export function hexToHct(hex) {
  const [r, g, b] = hexToRgb(hex);
  const [x, y, z] = linearRgbToXyz(
    srgbToLinear(r),
    srgbToLinear(g),
    srgbToLinear(b),
  );
  const [L, a, bLab] = xyzToLab(x, y, z);

  let hue = (Math.atan2(bLab, a) * 180) / Math.PI;
  if (hue < 0) hue += 360;

  return {
    hue,
    chroma: Math.sqrt(a * a + bLab * bLab),
    tone: Math.max(0, Math.min(100, L)),
  };
}

function toneToGray(tone) {
  const y = toneToY(tone);
  return linearToSrgb(y);
}

/**
 * Try to realise one HCT triple as sRGB. Returns null when the requested
 * chroma is outside the sRGB gamut at this hue and tone — the binary search
 * in hctToHex uses that null as its "too colourful" signal.
 */
function hctComponentToHex(hue, chroma, tone) {
  const hueRad = (hue * Math.PI) / 180;
  const a = Math.cos(hueRad) * chroma;
  const b = Math.sin(hueRad) * chroma;

  const [x, y, z] = labToXyz(tone, a, b);
  const [lr, lg, lb] = xyzToLinearRgb(x, y, z);

  const r = linearToSrgb(lr);
  const g = linearToSrgb(lg);
  const bVal = linearToSrgb(lb);

  // Round-tripping through the 0–255 quantisation tells us whether the
  // clamp above actually changed the colour: if it did, this chroma is out
  // of gamut at this tone, however plausible the resulting bytes look.
  const tolerance = 0.02;
  if (
    Math.abs(srgbToLinear(r) - lr) > tolerance ||
    Math.abs(srgbToLinear(g) - lg) > tolerance ||
    Math.abs(srgbToLinear(bVal) - lb) > tolerance
  ) {
    return null;
  }

  if (r < 0 || r > 255 || g < 0 || g > 255 || bVal < 0 || bVal > 255) {
    return null;
  }

  return formatHex(r, g, bVal);
}

/**
 * Convert HCT to hex, gamut-mapping by chroma reduction: tone and hue are
 * preserved exactly (tone is the contrast guarantee, so it must not move),
 * and chroma is binary-searched down until the colour fits in sRGB.
 * @param {HCT} hct
 * @returns {string}
 */
export function hctToHex({ hue, chroma, tone }) {
  if (tone <= 0) return "#000000";
  if (tone >= 100) return "#FFFFFF";
  if (chroma < 0.5) {
    const gray = toneToGray(tone);
    return formatHex(gray, gray, gray);
  }

  let lo = 0;
  let hi = chroma;
  let bestHex = "#000000";

  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    const candidate = hctComponentToHex(hue, mid, tone);
    if (candidate !== null) {
      bestHex = candidate;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return bestHex;
}

/**
 * The tone stops a tonal palette is generated at.
 *
 * 15 and 97 exist for one reason: `theme.bg.subtle` had nowhere to sit. It is
 * documented as "one step of emphasis below a surface", and the stops either
 * side of surface were 95 and 99 in light and 5 and 20 in dark — so it was
 * given 95 and 10, which are exactly `bg.canvas` and `bg.surface`. Four named
 * background steps resolved to three distinct values in each scheme, and a
 * component wanting a recessed fill had to share a token with whatever it was
 * sitting on.
 *
 * Adding a stop changes nothing that exists: a palette is a lookup keyed by
 * tone, so the values already referenced are untouched.
 */
const PALETTE_TONES = [0, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 95, 97, 99, 100];

/**
 * Generate a tonal palette — one hex per standard tone stop, at a fixed
 * hue and chroma.
 * @param {number} hue
 * @param {number} chroma
 * @returns {Record<number, string>}
 */
export function tonalPalette(hue, chroma) {
  const result = {};
  for (const tone of PALETTE_TONES) {
    result[tone] = hctToHex({ hue, chroma, tone });
  }
  return result;
}
