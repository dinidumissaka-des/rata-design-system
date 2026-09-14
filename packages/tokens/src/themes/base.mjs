/**
 * @file base.mjs
 * @input Nothing — this is the root theme declaration
 * @output The default DS theme, consumed by build.mjs and extended by brands
 * @position Theme source of truth; every other theme extends this one
 *
 * The default theme. Four seeds and a short list of things a seed cannot
 * know generate the whole semantic layer.
 *
 * WHAT IS GENERATED (do not hand-write these — see THEME-ENGINE.md):
 *   color      → theme.bg.*, theme.fg.*, theme.border.*, theme.accent-role.*,
 *                theme.secondary-role.*, theme.tertiary-role.fg, theme.focus-ring,
 *                color.accent.* (the raw ramp too — step 600 is the seed)
 *   typography → font.size.*, type.<role>.{size,weight,line-height}
 *   radius     → radius.*
 *   motion     → motion.duration.*
 *
 * WHAT IS STATED BELOW, and why it has to be:
 *   status roles     Convention-bound, not brand-derived. Green means success
 *                    whatever the accent is, so deriving them from the accent
 *                    would be actively wrong. Astryx draws the same line.
 *   rings/elevation  Effects, not palette positions.
 *   control/label    Roles this system has that Astryx's scale doesn't emit.
 */

import { defineTheme } from "../theme/defineTheme.mjs";

export const baseTheme = defineTheme({
  name: "base",

  // ── Seeds ─────────────────────────────────────────────────────────────────

  /**
   * Accent seed. Every neutral, surface, text and border tone derives from
   * this hue. Change it and the whole theme re-tones coherently — with the
   * WCAG guarantees intact, which is the point of seeding rather than
   * picking. `cool` keeps a slight blue cast in the greys.
   */
  color: { accent: "#1F7A5B", neutralStyle: "cool", contrast: "standard" },

  /**
   * base 14 / ratio 1.2 — the dense end of the range, which suits the
   * data-heavy internal tooling this system targets.
   */
  typography: {
    scale: { base: 14, ratio: 1.2 },
    body: {
      family: "Google Sans",
      fallbacks:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    },
    code: {
      family: "Google Sans Code",
      fallbacks: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    },
  },

  /**
   * base 4 × the step table below. The steps are one notch softer than
   * Astryx's 1/2/3/7/7 — this system's surfaces read rounder by design.
   */
  radius: {
    base: 4,
    multiplier: 1,
    steps: { inner: 2, element: 3, container: 4, chat: 7, page: 8 },
  },

  /**
   * Tempo. Astryx's own numbers were 175/410/975, and the medium band was too
   * slow for what this system uses it for: a menu took 410ms to appear and a
   * dialog 545ms, both of which read as the interface lagging rather than as
   * anything deliberate. The bands keep their meanings — fast for hover,
   * medium for entrance/exit, slow for continuous animation — and only the
   * tempo moved, so no role had to be remapped to a band it does not belong
   * to. `ratio` is the spread within a band, not the speed, so it stays.
   */
  motion: { fast: 130, medium: 210, slow: 700, ratio: 0.75 },

  // ── Stated outright ───────────────────────────────────────────────────────

  tokens: {
    // Status roles. The saturated `bg` is a non-text indicator; text goes on
    // `subtle` with the role's `fg`. usage.json holds that line with measured
    // contrast, and records the two combinations that cannot carry text.
    // Each role owns the colour of the label that sits on its filled `bg`.
    // theme.fg.on-accent cannot serve here: it is a contrast computation
    // against the *accent*, and in the dark scheme the accent inverts to a
    // light fill with dark text while these fills stay dark — so reusing it
    // put dark text on a dark red button. Astryx draws the same per-role
    // distinction (--color-on-success / -warning / -error).
    "theme.success-role.bg": "{color.success.600}",
    "theme.success-role.fg": ["{color.success.800}", "{color.success.400}"],
    "theme.success-role.subtle": ["{color.success.50}", "{color.success.950}"],
    "theme.success-role.on": "{color.white}",
    "theme.success-role.ring": "{ring.success}",

    "theme.warning-role.bg": "{color.warning.500}",
    "theme.warning-role.fg": ["{color.warning.800}", "{color.warning.400}"],
    "theme.warning-role.subtle": ["{color.warning.50}", "{color.warning.950}"],
    // The lightest of the three fills — it takes dark text, not white.
    "theme.warning-role.on": "{color.neutral.900}",
    "theme.warning-role.ring": "{ring.warning}",

    "theme.danger-role.bg": "{color.danger.600}",
    "theme.danger-role.fg": ["{color.danger.700}", "{color.danger.400}"],
    "theme.danger-role.subtle": ["{color.danger.50}", "{color.danger.950}"],
    "theme.danger-role.on": "{color.white}",
    "theme.danger-role.ring": "{ring.danger}",

    "theme.accent-role.ring": "{ring.accent}",

    // Elevation is the one non-colour family that still branches by scheme:
    // a light-mode shadow opacity barely registers against a dark canvas.
    "theme.elevation.raised": ["{elevation.low}", "{elevation.low-strong}"],
    "theme.elevation.overlay": ["{elevation.med}", "{elevation.med-strong}"],
    "theme.elevation.modal": ["{elevation.high}", "{elevation.high-strong}"],

    // Control text. The generated scale has no notion of "text sized to sit
    // inside a size.control.* box", so the three control sizes map onto the
    // generated steps explicitly.
    "type.control.size.sm": "{font.size.sm}",
    "type.control.size.md": "{font.size.base}",
    "type.control.size.lg": "{font.size.lg}",
    "type.control.line-height.sm": "1.4286",
    "type.control.line-height.md": "1.4286",
    "type.control.line-height.lg": "1.3333",
    "type.control.weight": "{font.weight.semibold}",

    // The label role's uppercase treatment — tracking and transform are not
    // things a type ratio can produce.
    "type.label.letter-spacing": "{font.letter-spacing.wide}",
    "type.label.text-transform": "uppercase",

    // Single-heading alias. Most surfaces in this repo want "a heading",
    // not a level; h3 is that size. Levelled tokens stay available.
    "type.heading.size": "{type.heading-3.size}",
    "type.heading.weight": "{type.heading-3.weight}",
    "type.heading.line-height": "{type.heading-3.line-height}",

    // Display tracking, from the letter-spacing primitives.
    "type.tracking.display-1": "{font.letter-spacing.tightest}",
    "type.tracking.display-2": "{font.letter-spacing.tighter}",
    "type.tracking.display-3": "{font.letter-spacing.tight}",
    "type.tracking.signal-1": "{font.letter-spacing.wider}",
    "type.tracking.signal-2": "{font.letter-spacing.wide}",
  },
});
