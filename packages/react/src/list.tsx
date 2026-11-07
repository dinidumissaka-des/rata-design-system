import type { ReactNode } from "react";
import { cx } from "./cx.js";

/** Edge-to-edge on the page's own surface, or grouped on a rounded surface. */
export type ListAppearance = "plain" | "inset";

export interface ListProps {
  /** The rows: ListItem elements, in reading order. */
  children: ReactNode;
  /** Accessible name for the list, when no visible heading names it. */
  label?: string;
  /** Id of a visible element — usually the Heading above the list — that names it. */
  labelledBy?: string;
  /** Whether a rule is drawn between rows. */
  dividers?: boolean;
  /** Edge-to-edge on the page's own surface, or grouped on a rounded surface inside the gutter. */
  appearance?: ListAppearance;
  className?: string;
}

/**
 * A vertical stack of rows, each a ListItem.
 *
 * A `<ul role="list">`: the explicit role is load-bearing, because Safari
 * drops list semantics from a list styled `list-style: none` and VoiceOver
 * then stops announcing the count. No primitive and no keyboard model — each
 * interactive row is a link or a button in the normal tab order.
 *
 * The rows draw their own dividers; `dividers={false}` only tells them not to.
 */
export function List({
  children,
  label,
  labelledBy,
  dividers = true,
  appearance = "plain",
  className,
}: ListProps) {
  return (
    <ul
      role="list"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={cx(
        "rata-list",
        `rata-list--${appearance}`,
        !dividers && "rata-list--undivided",
        className
      )}
    >
      {children}
    </ul>
  );
}
