import { useCallback, useMemo, useRef, useState, Children, isValidElement } from "react";
import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import { getToggleButtonGroupProps } from "@rata/primitives";
import type { ButtonGroupOrientation, ToggleButtonGroupSelectionMode } from "@rata/primitives";
import { cx } from "./cx.js";
import { ToggleButtonGroupContext } from "./toggle-button-group-context.js";
import type { ToggleButtonSize } from "./toggle-button.js";

export type { ToggleButtonGroupSelectionMode };

export type ToggleButtonGroupValue = string | string[] | null;

export interface ToggleButtonGroupProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "role" | "onChange" | "defaultValue"> {
  /** The current selection: a value in single mode, a list in multiple mode. */
  value?: ToggleButtonGroupValue;
  /** Starting selection for an uncontrolled group. Conflicts with `value`. */
  defaultValue?: ToggleButtonGroupValue;
  /** Called with the selection the group should move to. */
  onValueChange?: (value: ToggleButtonGroupValue) => void;
  /** Whether this group holds one answer or any number of independent states. */
  selectionMode?: ToggleButtonGroupSelectionMode;
  /** Single mode only: whether clicking the selected option clears the selection. */
  deselectable?: boolean;
  /** Accessible name for the group. Required unless `labelledBy` names an existing element. */
  label?: string;
  /** Id of a visible element that already names this group. */
  labelledBy?: string;
  orientation?: ButtonGroupOrientation;
  /** Control height for every option. Set here, never per option. */
  size?: ToggleButtonSize;
  /** Joins the options into one continuous bar. Defaults to true. */
  attached?: boolean;
  /** Blocks activation for every option while keeping them focusable. */
  disabled?: boolean;
}

/** What the group needs to know about each option before it renders. */
interface ItemSpec {
  value: string;
  disabled: boolean;
}

/**
 * Read each option's `value` (and whether it is individually disabled) from
 * the children, in DOM order.
 *
 * The primitive needs the full list *before* the first render, because the
 * roving tabindex is derived from it — registering on mount instead would put
 * the tab stop in the wrong place on first paint. That means reading child
 * props, which only sees direct children: an option wrapped in another element
 * is invisible here, which is why the contract's examples all show options as
 * immediate children.
 */
function readItems(children: ReactNode): ItemSpec[] {
  const items: ItemSpec[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = (child as ReactElement<{ value?: unknown; disabled?: boolean }>).props;
    if (typeof props.value !== "string") return;
    items.push({ value: props.value, disabled: props.disabled === true });
  });
  return items;
}

export function ToggleButtonGroup({
  value,
  defaultValue,
  onValueChange,
  selectionMode = "single",
  deselectable,
  label,
  labelledBy,
  orientation = "horizontal",
  size = "md",
  attached = true,
  disabled,
  className,
  children,
  ...rest
}: ToggleButtonGroupProps) {
  // Controlled is the honest default, as with ToggleButton: a group's selection
  // is usually the setting rather than a view of it. `defaultValue` is the
  // uncontrolled escape hatch, and the contract makes passing both a conflict
  // rather than a precedence rule to memorize, so `value` simply wins.
  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState<ToggleButtonGroupValue>(
    defaultValue ?? (selectionMode === "single" ? null : [])
  );
  const current = isControlled ? value : uncontrolled;

  const items = readItems(children);
  // Keyed on the joined lists rather than the arrays, which are rebuilt every
  // render and would defeat the memo.
  const valueKey = items.map((item) => item.value).join("\u0000");
  const disabledKey = items.filter((item) => item.disabled).map((item) => item.value).join("\u0000");
  const values = useMemo(() => valueKey.split("\u0000").filter(Boolean), [valueKey]);
  // A disabled group disables every option, and it has to reach the primitive
  // rather than only the items: the primitive's activation guard is driven by
  // `disabledValues`, so without this a disabled group would still report a
  // new selection on click. Arrow keys keep moving focus either way, which is
  // what keeps the options discoverable while unavailable.
  const disabledValues = useMemo(
    () => (disabled ? valueKey.split("\u0000").filter(Boolean) : disabledKey.split("\u0000").filter(Boolean)),
    [disabled, valueKey, disabledKey]
  );

  // The primitive reports which value should take focus; moving focus is ours.
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const registerItem = useCallback((itemValue: string, element: HTMLButtonElement | null) => {
    if (element) nodes.current.set(itemValue, element);
    else nodes.current.delete(itemValue);
  }, []);

  const group = getToggleButtonGroupProps({
    values,
    value: current,
    selectionMode,
    deselectable,
    disabledValues,
    orientation,
    label,
    labelledBy,
    onValueChange: (next) => {
      if (!isControlled) setUncontrolled(next);
      onValueChange?.(next);
    },
    onFocusValue: (itemValue) => nodes.current.get(itemValue)?.focus(),
  });

  const context = useMemo(
    () => ({
      getItemProps: group.item,
      size,
      groupDisabled: disabled === true,
      registerItem,
    }),
    [group.item, size, disabled, registerItem]
  );

  return (
    <ToggleButtonGroupContext.Provider value={context}>
      <div
        {...rest}
        {...group.root}
        className={cx(
          "rata-toggle-button-group",
          attached && "rata-toggle-button-group--attached",
          className
        )}
      >
        {children}
      </div>
    </ToggleButtonGroupContext.Provider>
  );
}
