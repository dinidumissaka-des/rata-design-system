/**
 * Ember — a warm, high-contrast brand.
 *
 * The whole brand is four lines of seed. Everything else — every surface,
 * text, border and focus tone, in both colour schemes — is generated from
 * them, and `npm run build` re-measures all of this system's contrast
 * promises against these values before it will emit a stylesheet.
 *
 * Note what is NOT here: no palette, no per-token hexes, no dark-mode file.
 * Re-seeding is the whole edit.
 */

import { defineTheme } from "@rata/tokens/theme";
import { baseTheme } from "@rata/tokens/theme/base";

export const emberTheme = defineTheme({
  name: "ember",
  extends: baseTheme,

  // A burnt orange, with greys warmed to match and the text/surface gap
  // widened — this brand ships into bright warehouse and workshop settings
  // where screens are read at arm's length under poor light.
  color: { accent: "#B7410E", neutralStyle: "warm", contrast: "high" },

  // Softer corners than base, from the same step table.
  radius: { base: 4, multiplier: 1.5, steps: { inner: 2, element: 3, container: 4, chat: 7, page: 8 } },
});
