import { forwardRef, useCallback, useState } from "react";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { getToggleButtonProps } from "@rata/primitives";
import { cx } from "./cx.js";
import { useToggleButtonGroup } from "./toggle-button-group-context.js";
import { Spinner } from "./spinner.js";

export type ToggleButtonVariant = "secondary" | "tertiary";
export type ToggleButtonSize = "sm" | "md" | "lg";

export interface ToggleButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled" | "onChange"> {
  /** Whether the toggle is currently on. Makes the component controlled. */
  pressed?: boolean;
  /** Starting state for an uncontrolled toggle. Conflicts with `pressed`. */
  defaultPressed?: boolean;
  /** Called with the state the toggle should move to, not the one it is in. */
  onPressedChange?: (pressed: boolean, event: MouseEvent<HTMLButtonElement>) => void;
  /** How loud the toggle is in its off state. */
  variant?: ToggleButtonVariant;
  size?: ToggleButtonSize;
  disabled?: boolean;
  /** Shows a spinner and blocks activation while preserving focus. */
  loading?: boolean;
  /** Square icon-only toggle; pass the icon as children and set aria-label. */
  iconOnly?: boolean;
}

export const ToggleButton = forwardRef<HTMLButtonElement, ToggleButtonProps>(
  function ToggleButton(
    {
      pressed,
      defaultPressed,
      onPressedChange,
      variant = "secondary",
      size = "md",
      disabled,
      loading,
      iconOnly,
      className,
      children,
      type,
      ...rest
    },
    ref
  ) {
    // Controlled is the honest default — a toggle almost always reflects state
    // that lives somewhere else. `defaultPressed` is the uncontrolled escape
    // hatch; the contract makes passing both a conflict rather than a
    // precedence rule to memorize, so `pressed` simply wins.
    const isControlled = pressed !== undefined;
    const [uncontrolled, setUncontrolled] = useState(defaultPressed ?? false);
    const current = isControlled ? pressed : uncontrolled;

    // Inside a ToggleButtonGroup this toggle is an *option*: the group holds
    // the value and decides which ARIA pattern applies, so the item's own
    // pressed state is not the source of truth and must not be consulted.
    // Membership needs a `value` too — a toggle with none is a plain toggle
    // that merely happens to sit inside a group, and the group's primitive
    // never saw it, so borrowing the group's selection here would style it
    // against a value nobody registered.
    const group = useToggleButtonGroup();
    const inGroup = group !== null && typeof rest.value === "string";
    const groupItem = inGroup ? group.getItemProps(rest.value as string) : null;

    const handlePressedChange = useCallback(
      (next: boolean, event: { preventDefault(): void }) => {
        if (!isControlled) setUncontrolled(next);
        onPressedChange?.(next, event as MouseEvent<HTMLButtonElement>);
      },
      [isControlled, onPressedChange]
    );

    const behavior = getToggleButtonProps({
      pressed: current,
      // A group can disable the whole question; an option can also disable
      // itself. Either is enough.
      disabled: disabled || group?.groupDisabled,
      loading,
      onPressedChange: handlePressedChange,
    });

    // The group owns height, because a bar of options at two heights is ragged.
    const appliedSize = inGroup ? group.size : size;

    return (
      <button
        ref={(node) => {
          if (inGroup) group.registerItem(rest.value as string, node);
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        {...rest}
        type={type ?? behavior.type}
        // In a group these come from the group's primitive: `role`/`aria-checked`
        // for a single-select radio, `aria-pressed` for a multi-select toggle,
        // plus the roving tabindex. Standalone, they come from this toggle's own
        // behavior. Either way they are written after `rest`, so a caller cannot
        // pass a prop that quietly replaces the accessibility contract.
        role={groupItem?.role}
        aria-checked={groupItem?.["aria-checked"]}
        aria-pressed={groupItem ? groupItem["aria-pressed"] : behavior["aria-pressed"]}
        tabIndex={groupItem?.tabIndex}
        aria-disabled={groupItem?.["aria-disabled"] ?? behavior["aria-disabled"]}
        aria-busy={behavior["aria-busy"]}
        data-loading={behavior["data-loading"]}
        onClick={
          (groupItem?.onClick ?? behavior.onClick) as (
            event: MouseEvent<HTMLButtonElement>
          ) => void
        }
        className={cx(
          "rata-toggle-button",
          "rata-state-layer",
          `rata-toggle-button--${variant}`,
          `rata-toggle-button--${appliedSize}`,
          iconOnly && "rata-toggle-button--icon-only",
          className
        )}
      >
        {loading && <Spinner />}
        {children as ReactNode}
      </button>
    );
  }
);
