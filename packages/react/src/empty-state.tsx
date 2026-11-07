import type { HTMLAttributes, ReactNode } from "react";
import { Icon } from "@rata/icons";
import type { LucideIcon } from "@rata/icons";
import { cx } from "./cx.js";

export type EmptyStateLive = "off" | "polite" | "assertive";

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "role" | "children"> {
  /** What is empty, said plainly. */
  title: string;
  /** One or two sentences on why it is empty or what the action will do. */
  description?: ReactNode;
  /** The one way out: a Button or a Link. */
  action?: ReactNode;
  /** A glyph marking the area as intentionally empty. Omit for none. */
  icon?: LucideIcon | false;
  /** Whether the empty state is announced when it appears. */
  live?: EmptyStateLive;
  /** Extra classes, for placement. */
  className?: string;
}

/** `live` maps onto a role, as Notice's does; `off` sets none. */
const LIVE_ROLE: Record<EmptyStateLive, "status" | "alert" | undefined> = {
  off: undefined,
  polite: "status",
  assertive: "alert",
};

/**
 * What a collection shows when it has nothing in it: why it is empty, and the
 * one thing to do about it.
 *
 * Empty is not an error: a failed request is a danger Notice in the same
 * place, never an empty state, so a failure cannot quietly tell the reader
 * they have no data.
 *
 * The title is a styled paragraph, not a heading — the section it sits in
 * already has one, and only the caller knows its level. The icon is always
 * `aria-hidden`; the title carries the meaning.
 *
 * `live` is silent by default, with Notice's reasoning: an empty state present
 * at page load is read in place, while one that appears because the reader
 * changed a search must be announced. That depends on how it arrived, not on
 * what it says, so the caller states it.
 *
 * No primitive: no interaction to own and no state to hold.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  live = "off",
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div {...rest} className={cx("rata-empty-state", className)} role={LIVE_ROLE[live]}>
      {icon && <Icon icon={icon} size="lg" className="rata-empty-state-icon" />}
      <p className="rata-empty-state-title">{title}</p>
      {description !== undefined && description !== null && description !== false && description !== "" && (
        <p className="rata-empty-state-description">{description}</p>
      )}
      {action !== undefined && action !== null && action !== false && (
        <div className="rata-empty-state-action">{action}</div>
      )}
    </div>
  );
}
