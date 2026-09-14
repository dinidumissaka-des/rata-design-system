/**
 * Ink — one of this system's five accent options.
 *
 * Near-black. WARNING: this cannot produce a near-black accent. Chroma 4.5
 * is below the palette's floor of 48 and tone 7.0 is far below the fill
 * slot, so it is lifted to a saturated blue-violet at its own hue
 * (#4659A8). If this colour is meant as text or a page background rather
 * than an accent, it belongs in the neutral/fg tokens, not here.
 *
 * Only the accent is stated. Radius, type and motion all inherit from base, so
 * the five options differ in exactly one decision, and `npm run build`
 * re-measures every contrast promise in the system against each of them.
 */

import { defineTheme } from "@rata/tokens/theme";
import { baseTheme } from "@rata/tokens/theme/base";

export const inkTheme = defineTheme({
  name: "ink",
  extends: baseTheme,

  color: { accent: "#15151B", neutralStyle: "neutral", contrast: "standard" },
});
