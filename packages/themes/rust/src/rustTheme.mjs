/**
 * Rust — one of this system's five accent options.
 *
 * Burnt orange-red, with greys warmed to match. Tone 43.3, so the fill
 * tracks the seed closely. Sits near the danger role — a primary and a
 * destructive button read alike under it.
 *
 * Only the accent is stated. Radius, type and motion all inherit from base, so
 * the five options differ in exactly one decision, and `npm run build`
 * re-measures every contrast promise in the system against each of them.
 */

import { defineTheme } from "@rata/tokens/theme";
import { baseTheme } from "@rata/tokens/theme/base";

export const rustTheme = defineTheme({
  name: "rust",
  extends: baseTheme,

  color: { accent: "#C22D05", neutralStyle: "warm", contrast: "standard" },
});
