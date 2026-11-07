import type { KeyboardEvent, MouseEvent } from "react";
import { getButtonProps } from "@rata/primitives";
import { Icon, X } from "@rata/icons";
import type { LucideIcon } from "@rata/icons";
import { cx } from "./cx.js";

export interface ChipProps {
  /** The value, as text. */
  children: string;
  /** Called when the reader removes the value — by pressing the button, or by Backspace or Delete while it has focus. */
  onRemove: () => void;
  /** The remove button's full accessible name. */
  removeLabel?: string;
  /** A glyph before the text that says what kind of value it is. */
  icon?: LucideIcon;
  /** Blocks removal while keeping the button focusable and announced. */
  disabled?: boolean;
  className?: string;
}

/**
 * A value the reader has added, shown with a control to remove it.
 *
 * The chip is a `<span>` and is not focusable; its one tab stop is the remove
 * button, whose name is the whole phrase — "Remove Ada Lovelace" — so focusing
 * it says both what the value is and what will happen.
 *
 * No primitive of its own: the button's activation and its aria-disabled
 * guard are `getButtonProps`, Button's. Backspace and Delete on the focused
 * button remove too, through the same guard.
 *
 * Focus after removal is the caller's: the focused button is about to leave
 * the DOM, and only something holding every chip knows where focus goes next.
 */
export function Chip({
  children,
  onRemove,
  removeLabel = `Remove ${children}`,
  icon,
  disabled = false,
  className,
}: ChipProps) {
  const behavior = getButtonProps({ disabled, onActivate: () => onRemove() });

  return (
    <span
      className={cx("rata-chip", disabled && "rata-chip--disabled", className)}
      title={children}
    >
      {icon && <Icon icon={icon} />}
      <span className="rata-chip-text">{children}</span>
      <button
        type={behavior.type}
        aria-label={removeLabel}
        aria-disabled={behavior["aria-disabled"]}
        onClick={behavior.onClick as (event: MouseEvent<HTMLButtonElement>) => void}
        onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
          if (event.key !== "Backspace" && event.key !== "Delete") return;
          // Prevented either way: Backspace on a focused button must not
          // navigate back in an older browser, disabled or not.
          event.preventDefault();
          if (!disabled) onRemove();
        }}
        className="rata-chip-remove rata-state-layer rata-state-layer--flush"
      >
        <Icon icon={X} size="sm" />
      </button>
    </span>
  );
}
