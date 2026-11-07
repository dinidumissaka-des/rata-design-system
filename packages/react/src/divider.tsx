import type { HTMLAttributes } from "react";
import { cx } from "./cx.js";

export type DividerOrientation = "horizontal" | "vertical";

export interface DividerProps
  extends Omit<HTMLAttributes<HTMLElement>, "children" | "role" | "aria-orientation" | "aria-hidden"> {
  /** Which way the rule runs. */
  orientation?: DividerOrientation;
  /** Hides the rule from assistive tech when it marks no real change of topic. */
  decorative?: boolean;
  /** Extra classes, for placement. */
  className?: string;
}

/**
 * A rule marking a change of topic within a page, or a separation between
 * groups in a toolbar.
 *
 * Horizontal is an `<hr>`, a thematic break announced as a separator.
 * Vertical is a `div` with `role="separator"` and `aria-orientation`, because
 * an `<hr>` is horizontal by definition and would announce the wrong
 * orientation. `decorative` adds `aria-hidden` (and `role="none"` on the
 * `<hr>`) for a line that marks no real change of topic.
 *
 * No primitive: a non-focusable separator has no interaction to own. No
 * margin either — the stack or row it sits in owns the space either side.
 */
export function Divider({
  orientation = "horizontal",
  decorative = false,
  className,
  ...rest
}: DividerProps) {
  const classes = cx("rata-divider", `rata-divider--${orientation}`, className);

  if (orientation === "vertical") {
    return (
      <div
        {...rest}
        className={classes}
        role="separator"
        aria-orientation="vertical"
        aria-hidden={decorative ? true : undefined}
      />
    );
  }

  return (
    <hr
      {...rest}
      className={classes}
      role={decorative ? "none" : undefined}
      aria-hidden={decorative ? true : undefined}
    />
  );
}
