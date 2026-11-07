import { useId } from "react";
import type { HTMLAttributes } from "react";
import { cx } from "./cx.js";

/** Attributes the bar sets itself, from its own props. */
type ProgressOwnedAttribute =
  | "children"
  | "role"
  | "aria-valuenow"
  | "aria-valuemin"
  | "aria-valuemax"
  | "aria-valuetext"
  | "aria-labelledby";

export interface ProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, ProgressOwnedAttribute> {
  /** What is in progress, shown above the bar. */
  label: string;
  /** How much is done, from 0 to `max`. */
  value: number;
  /** The value that means done. */
  max?: number;
  /** The value in the reader's own units, shown beside the label and announced instead of a percentage. */
  valueText?: string;
  /** Extra classes, for placement and width. */
  className?: string;
}

/**
 * A labelled bar showing how much of a task with a known end is done.
 *
 * Determinate only: an unknown end is Spinner's job, so `value` is required
 * and the bar means something every time it is on screen. A `div` with
 * `role="progressbar"` rather than `<progress>`, so the fill can transition
 * and `valueText` can say "3 of 7 files" instead of a percentage.
 *
 * The visible label is the accessible name, through `aria-labelledby`, so
 * sighted and screen-reader users are told the same thing. `value` is
 * clamped to `0`–`max`, so an overshoot never announces 104 percent.
 *
 * Not a live region: a reader who navigates to it hears the current value.
 * Completion is the caller's to announce, because only the caller knows what
 * "done" means. No primitive: it holds no state and takes no input.
 */
export function Progress({
  label,
  value,
  max = 100,
  valueText,
  className,
  ...rest
}: ProgressProps) {
  const labelId = `${useId()}-label`;
  const total = Number.isFinite(max) && max > 0 ? max : 0;
  const now = total === 0 ? 0 : Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), total);
  const percent = total === 0 ? 0 : (now / total) * 100;

  return (
    <div
      {...rest}
      className={cx("rata-progress", className)}
      role="progressbar"
      aria-labelledby={labelId}
      aria-valuenow={now}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuetext={valueText}
    >
      <div className="rata-progress-header">
        <span id={labelId} className="rata-progress-label">
          {label}
        </span>
        {valueText !== undefined && valueText !== "" && (
          <span className="rata-progress-value">{valueText}</span>
        )}
      </div>
      <div className="rata-progress-track">
        <div className="rata-progress-fill" style={{ inlineSize: `${percent}%` }} />
      </div>
    </div>
  );
}
