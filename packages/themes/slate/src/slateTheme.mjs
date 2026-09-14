/**
 * Slate — a quiet, dense brand for data-heavy screens.
 *
 * Demonstrates the two seeds a brand most often wants to move that are not
 * colour: a tighter type ratio (more rows on screen) and a snappier motion
 * budget (less waiting in a tool someone uses all day).
 *
 * The accent is a [light, dark] pair rather than one hex — each scheme
 * derives its palettes from its own seed, so the dark scheme gets a colour
 * chosen for a dark canvas instead of a lightened version of the light one.
 */

import { defineTheme } from "@rata/tokens/theme";
import { baseTheme } from "@rata/tokens/theme/base";

export const slateTheme = defineTheme({
  name: "slate",
  extends: baseTheme,

  color: { accent: ["#334155", "#7DA2CE"], neutralStyle: "neutral", contrast: "standard" },

  // 1.125 is the dense end of the ratio range: headings stay close to body
  // size, which suits tables and dashboards where hierarchy comes from
  // weight and spacing rather than size.
  typography: { scale: { base: 14, ratio: 1.125 } },

  // Squarer than base.
  radius: { base: 4, multiplier: 0.5, steps: { inner: 2, element: 3, container: 4, chat: 7, page: 8 } },

  // Snappier than base on every band, which is the point of stating it at all.
  // Base's own tempo came down (its medium band was too slow for entrances),
  // so this came down with it — at the old 250 the medium band would have been
  // *slower* than base and the brand would have stopped demonstrating what its
  // docstring above claims.
  motion: { fast: 100, medium: 170, slow: 600, ratio: 0.75 },
});
