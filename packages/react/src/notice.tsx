import type { HTMLAttributes, ReactNode } from "react";
import { Icon, Info, CircleCheck, TriangleAlert, CircleX, X } from "@rata/icons";
import type { LucideIcon } from "@rata/icons";
import { cx } from "./cx.js";

export type NoticeVariant = "info" | "success" | "warning" | "danger";
export type NoticeLive = "off" | "polite" | "assertive";

export interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "role"> {
  /** The message. */
  children: ReactNode;
  /** Which kind of message this is. */
  variant?: NoticeVariant;
  /** Whether assistive technology is told about this notice when it appears. */
  live?: NoticeLive;
  /** A short first line above the message. */
  title?: ReactNode;
  /** Overrides the icon the variant chooses, or removes it. */
  icon?: LucideIcon | false;
  /** Buttons or links for what to do about the message. */
  actions?: ReactNode;
  /** Called when the reader closes the notice. Its presence is what renders the close button. */
  onDismiss?: () => void;
  /** Accessible name for the close button. */
  dismissLabel?: string;
}

/**
 * The glyph each variant carries when none is passed.
 *
 * These are the pairings `@rata/icons` already documents for the status roles,
 * so a notice and anything else reporting the same severity draw the same
 * shape. Lucide's canonical names — the `AlertTriangle` / `XCircle` spellings
 * are deprecated aliases that compile today and break on a major.
 */
const VARIANT_ICON: Record<NoticeVariant, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleX,
};

/** `live` maps onto a role rather than an `aria-live` attribute; `off` sets neither. */
const LIVE_ROLE: Record<NoticeLive, "status" | "alert" | undefined> = {
  off: undefined,
  polite: "status",
  assertive: "alert",
};

/**
 * An inline banner carrying an informational, success, warning or error message.
 *
 * **When it announces is a prop, not a consequence of the variant.** A live
 * region announces *changes*, so a notice already on the page at load is
 * either read out of context during load or not at all, while one that appears
 * because the reader pressed something must be read — their attention is on
 * the button. That distinction is about when the notice arrived, not what it
 * says: a validation summary rendered at load and an error that appears after
 * a failed save are the same variant with opposite needs. Deriving it from
 * `variant` would get one of them wrong every time, so `live` is explicit and
 * silent by default.
 *
 * A live region must also already exist in the document before its content
 * arrives, which `live` cannot arrange for itself — if the notice is mounted
 * at the same moment its text appears, some screen readers miss it. Keep the
 * notice mounted and change its children, or put the region on a wrapper you
 * always render. The contract's usage cases show both.
 *
 * The icon is on by default because colour is the only thing separating the
 * four variants, which makes it the 1.4.1 redundancy rather than decoration —
 * and `aria-hidden` for the same reason: it repeats the severity the text
 * already carries, so it can never disagree with it.
 *
 * Dismissal is not owned here. `onDismiss` renders the control and reports the
 * press; the notice does not hide itself, because it cannot know what should
 * fill the space, and it cannot move focus, because it cannot know where the
 * reader's place was. Both are the caller's, and the contract says so.
 */
export function Notice({
  children,
  variant = "info",
  live = "off",
  title,
  icon,
  actions,
  onDismiss,
  dismissLabel = "Dismiss",
  className,
  ...rest
}: NoticeProps) {
  const glyph = icon === false ? null : (icon ?? VARIANT_ICON[variant]);

  return (
    <div
      {...rest}
      className={cx("rata-notice", `rata-notice--${variant}`, className)}
      role={LIVE_ROLE[live]}
    >
      {glyph && <Icon icon={glyph} className="rata-notice-icon" />}

      <div className="rata-notice-content">
        {/* A paragraph, never an <h*>: a notice cannot know the heading level
            it sits under, and a wrong one breaks heading navigation. */}
        {title !== undefined && title !== "" && <p className="rata-notice-title">{title}</p>}
        <p className="rata-notice-message">{children}</p>
        {actions !== undefined && actions !== false && actions !== null && (
          <div className="rata-notice-actions">{actions}</div>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          /* --flush because this control has no border of its own: the state
             layer bleeds by a border-width everywhere else in the system. */
          className="rata-notice-dismiss rata-state-layer rata-state-layer--flush"
          aria-label={dismissLabel}
          onClick={onDismiss}
        >
          <Icon icon={X} />
        </button>
      )}
    </div>
  );
}
