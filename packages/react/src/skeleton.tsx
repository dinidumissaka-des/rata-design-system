import type { HTMLAttributes } from "react";
import { cx } from "./cx.js";

export type SkeletonShape = "text" | "block" | "circle";

export interface SkeletonProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children" | "aria-hidden"> {
  /** What kind of content it stands in for. */
  shape?: SkeletonShape;
  /** How many lines a `text` skeleton stands in for. */
  lines?: number;
  /** Extra classes, for the size of a `block` or `circle` and its placement. */
  className?: string;
}

/**
 * A placeholder in the shape of content that is about to load, so the layout
 * does not jump when it arrives.
 *
 * Always `aria-hidden`: the region that is loading — not the skeleton —
 * carries `aria-busy` and holds the one announcement of what is loading, so a
 * page of skeleton rows does not say "loading" once per row.
 *
 * `text` sizes itself from the type scale, one bar per line, so it is right
 * by construction. `block` and `circle` take the size of whatever they
 * replace from the caller's layout, through `className`; there is no width or
 * height prop, because that would invite bare pixel values. `lines` applies
 * to `text` only.
 *
 * No primitive: it holds no state and takes no input.
 */
export function Skeleton({ shape = "text", lines = 1, className, ...rest }: SkeletonProps) {
  const count = shape === "text" ? Math.max(1, Math.floor(lines)) : 0;

  return (
    <span
      {...rest}
      className={cx("rata-skeleton", `rata-skeleton--${shape}`, className)}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="rata-skeleton-line" />
      ))}
    </span>
  );
}
