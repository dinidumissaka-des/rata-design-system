import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx.js";

export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** The badge's text. */
  children: ReactNode;
  /** Which role's tone the badge wears. */
  variant?: BadgeVariant;
  /** Renders a status dot before the text. */
  dot?: boolean;
}

/**
 * A small inline label for a status, a count, or a category.
 *
 * Every variant pairs a role's *subtle* tint with that role's foreground, never
 * the saturated `bg` — those are non-text indicator tones, and white on
 * success-role.bg is a recorded contrast gap. The text is what carries the
 * meaning, so it has to be readable.
 *
 * The dot is `aria-hidden` and takes `currentColor`: it repeats what the text
 * already says, so it can never disagree with it, and a screen reader loses
 * nothing by skipping it. That is also why a dot with no text is documented as
 * a mistake — it would be colour-only information.
 */
export function Badge({ children, variant = "neutral", dot, className, ...rest }: BadgeProps) {
  return (
    <span {...rest} className={cx("rata-badge", `rata-badge--${variant}`, className)}>
      {dot && <span className="rata-badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
