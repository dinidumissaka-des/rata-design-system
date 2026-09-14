import { createElement } from "react";
import type { LucideIcon } from "lucide-react";

export type IconSize = "text" | "xs" | "sm" | "md" | "lg";

export interface IconProps {
  /** The Lucide component to render, passed as a value so the set stays tree-shakeable. */
  icon: LucideIcon;
  /** Which step of the `size.icon.*` scale to draw at. Defaults to following the surrounding text. */
  size?: IconSize;
  /** Accessible name, for an icon that carries meaning nothing else conveys. */
  label?: string;
  className?: string;
}

/**
 * A Lucide glyph, sized from the icon scale and coloured by the text it sits in.
 *
 * Two things this wrapper exists to get right, neither of which a bare Lucide
 * component does:
 *
 * 1. **Size comes from a token, and follows the text by default.** Lucide
 *    writes width/height as SVG presentation attributes and defaults to 24px.
 *    CSS properties beat presentation attributes, so `.rata-icon--<size>`
 *    overrides it — which keeps the number in `size.icon.*` instead of being
 *    read out of a CSS variable in JS. The default step is `size.icon.text`
 *    (1.15em), so an icon tracks whatever font-size it lands in; the fixed px
 *    steps are for a glyph with no text to inherit from.
 * 2. **The a11y default is the safe one.** An icon is decorative unless told
 *    otherwise, so with no `label` it is `aria-hidden`. That is the common case
 *    (an icon inside a button that already has an `aria-label`, or one beside a
 *    visible text label), and getting it right requires no thought. `label`
 *    opts into `role="img"` for the rarer case where the glyph is the only
 *    thing communicating something. Same switch `Spinner` uses, for the same
 *    reason.
 */
export function Icon({ icon, size = "text", label, className }: IconProps) {
  return createElement(icon, {
    className: ["rata-icon", `rata-icon--${size}`, className].filter(Boolean).join(" "),
    // Lucide's own `size` prop would write a fresh width/height attribute and
    // fight the class. The class is the single source, so this is pinned off.
    role: label ? "img" : undefined,
    "aria-label": label,
    "aria-hidden": label ? undefined : true,
    // Lucide strokes with currentColor already; stated so a future default
    // change upstream cannot silently detach an icon from its label's colour.
    stroke: "currentColor",
  });
}
