/**
 * Lime — one of this system's five accent options.
 *
 * Bright lime. Tone 85.1 — far above the tone-40 fill slot, so the FILL
 * comes out a dark green (#1D6D00) and the seed itself surfaces as the
 * subtle tint instead. Expect the light lime on backgrounds, not on
 * buttons.
 *
 * Only the accent is stated. Radius, type and motion all inherit from base, so
 * the five options differ in exactly one decision, and `npm run build`
 * re-measures every contrast promise in the system against each of them.
 */

import { defineTheme } from "@rata/tokens/theme";
import { baseTheme } from "@rata/tokens/theme/base";

export const limeTheme = defineTheme({
  name: "lime",
  extends: baseTheme,

  color: { accent: "#9FE870", neutralStyle: "cool", contrast: "standard" },
});
