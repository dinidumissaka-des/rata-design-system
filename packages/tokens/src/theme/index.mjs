/**
 * @file index.mjs
 * @output The theme-authoring surface — what a brand theme imports
 * @position Public entry for @rata/tokens/theme
 *
 * A brand theme should need `defineTheme` and nothing else. The expanders and
 * colour maths are exported for tooling and tests, not because a theme is
 * expected to call them: passing seeds to defineTheme is the supported way to
 * reach them, and it is the only way that keeps the contrast guarantees
 * attached to the result.
 */

export { defineTheme, isDefinedTheme } from "./defineTheme.mjs";

export { expandColorScale, ensureContrastTone } from "./expandColorScale.mjs";
export { expandTypeScale } from "./expandTypeScale.mjs";
export { expandRadiusScale, DEFAULT_RADIUS_STEPS } from "./expandRadiusScale.mjs";
export { expandMotionScale } from "./expandMotionScale.mjs";

export { hexToHct, hctToHex, tonalPalette } from "./hct.mjs";
export { contrastRatio, parseHex, formatHex, hexWithAlpha } from "./color.mjs";
