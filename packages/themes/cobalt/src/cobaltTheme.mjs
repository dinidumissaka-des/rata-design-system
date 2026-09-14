/**
 * Cobalt — one of this system's five accent options.
 *
 * Vivid blue. Chroma 99.8, the most saturated of the five; tone 44.8 keeps
 * the fill close to the seed.
 *
 * Only the accent is stated. Radius, type and motion all inherit from base, so
 * the five options differ in exactly one decision, and `npm run build`
 * re-measures every contrast promise in the system against each of them.
 */

import { defineTheme } from "@rata/tokens/theme";
import { baseTheme } from "@rata/tokens/theme/base";

export const cobaltTheme = defineTheme({
  name: "cobalt",
  extends: baseTheme,

  color: { accent: "#3854FF", neutralStyle: "cool", contrast: "standard" },
});
