/**
 * Pine — one of this system's five accent options.
 *
 * Deep green. Tone 45.6, which sits almost exactly on the tone-40 fill
 * slot, so the generated fill stays close to the seed.
 *
 * Only the accent is stated. Radius, type and motion all inherit from base, so
 * the five options differ in exactly one decision, and `npm run build`
 * re-measures every contrast promise in the system against each of them.
 */

import { defineTheme } from "@rata/tokens/theme";
import { baseTheme } from "@rata/tokens/theme/base";

export const pineTheme = defineTheme({
  name: "pine",
  extends: baseTheme,

  color: { accent: "#1F7A5B", neutralStyle: "cool", contrast: "standard" },
});
