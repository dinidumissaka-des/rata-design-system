import { Children, isValidElement, useCallback, useId, useMemo, useRef, useState } from "react";
import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import { getRadioGroupProps } from "@rata/primitives";
import type { ButtonGroupOrientation } from "@rata/primitives";
import { cx } from "./cx.js";
import { RadioGroupContext } from "./radio-group-context.js";

export interface RadioGroupProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "role" | "onChange" | "defaultValue"> {
  /** Accessible name for the group — the question these radios answer. */
  label?: string;
  /** Id of a visible element that already names this group. */
  labelledBy?: string;
  /** The chosen value, or null for nothing chosen yet. */
  value?: string | null;
  /** Starting choice for an uncontrolled group. Conflicts with `value`. */
  defaultValue?: string | null;
  /** Called with the value the group should move to. */
  onValueChange?: (value: string) => void;
  /** Shared form field name. Defaults to a generated one. */
  name?: string;
  orientation?: ButtonGroupOrientation;
  /** Blocks the whole question while keeping every option focusable. */
  disabled?: boolean;
  /** Marks the group as requiring an answer. */
  required?: boolean;
}

/**
 * A set of radios holding one answer.
 *
 * The value lives here, never on an item: a radio's meaning is "one of these",
 * and a value on the option would let two claim to be checked — the state this
 * control exists to make impossible.
 *
 * Options are read from the children in DOM order, because the primitive needs
 * the full list before the first render to derive the roving tab stop.
 * Registering on mount instead would put the tab stop in the wrong place on the
 * first paint. That means direct children only, which is how the contract's
 * examples are written.
 */
export function RadioGroup({
  label,
  labelledBy,
  value,
  defaultValue,
  onValueChange,
  name,
  orientation = "vertical",
  disabled,
  required,
  className,
  children,
  ...rest
}: RadioGroupProps) {
  const generatedName = useId();
  // The visible label is associated by id rather than duplicated into
  // aria-label. Setting both meant the group's name was announced twice: once
  // as the span in the reading order, then again on entering the radiogroup.
  const labelId = `${generatedName}-label`;
  const describedByLabel = labelledBy ?? (label ? labelId : undefined);
  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState<string | null>(defaultValue ?? null);
  const current = isControlled ? value : uncontrolled;

  const specs: { value: string; disabled: boolean }[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = (child as ReactElement<{ value?: unknown; disabled?: boolean }>).props;
    if (typeof props.value !== "string") return;
    specs.push({ value: props.value, disabled: props.disabled === true });
  });

  const valueKey = specs.map((s) => s.value).join("\u0000");
  const disabledKey = specs.filter((s) => s.disabled).map((s) => s.value).join("\u0000");
  const values = useMemo(() => valueKey.split("\u0000").filter(Boolean), [valueKey]);
  const disabledValues = useMemo(
    () => disabledKey.split("\u0000").filter(Boolean),
    [disabledKey]
  );

  const nodes = useRef(new Map<string, HTMLInputElement>());
  const registerItem = useCallback((itemValue: string, element: HTMLInputElement | null) => {
    if (element) nodes.current.set(itemValue, element);
    else nodes.current.delete(itemValue);
  }, []);

  const group = getRadioGroupProps({
    values,
    value: current,
    disabledValues,
    disabled,
    orientation,
    name: name ?? generatedName,
    // Only reaches aria-label when there is no element to point at, which is
    // the case a caller creates by passing neither.
    label: describedByLabel ? undefined : label,
    labelledBy: describedByLabel,
    required,
    onValueChange: (next) => {
      if (!isControlled) setUncontrolled(next);
      onValueChange?.(next);
    },
    onFocusValue: (itemValue) => nodes.current.get(itemValue)?.focus(),
  });

  const context = useMemo(
    () => ({ getItemProps: group.item, registerItem }),
    [group.item, registerItem]
  );

  return (
    <RadioGroupContext.Provider value={context}>
      <div className={cx("rata-radio-group", className)}>
        {label && !labelledBy && (
          <span className="rata-radio-group-label" id={labelId}>
            {label}
          </span>
        )}
        <div {...rest} {...group.root} className="rata-radio-group-options">
          {children}
        </div>
      </div>
    </RadioGroupContext.Provider>
  );
}
