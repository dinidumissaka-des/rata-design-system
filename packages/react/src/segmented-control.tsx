import { useEffect, useRef, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { getSegmentedControlProps } from "@rata/primitives";
import { Icon } from "@rata/icons";
import type { LucideIcon } from "@rata/icons";
import { cx } from "./cx.js";

export type SegmentedControlSize = "sm" | "md";

export interface SegmentedControlOption {
  value: string;
  label: ReactNode;
  /** Unavailable, but still focusable and announced — activation is guarded. */
  disabled?: boolean;
  icon?: LucideIcon;
}

export interface SegmentedControlProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "role" | "onChange"> {
  /** The options, in the order they are read. */
  options: SegmentedControlOption[];
  /** The current answer. Makes the component controlled. */
  value?: string;
  /** Starting answer for an uncontrolled control. Defaults to the first option. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Accessible name. Required unless `labelledBy` names an element. */
  label?: string;
  labelledBy?: string;
  size?: SegmentedControlSize;
  /** Fills its container instead of hugging its options. */
  fullWidth?: boolean;
  className?: string;
}

/**
 * A segmented control: one answer out of a few, in one enclosed bar.
 *
 * WHICH OF THREE, because they look alike and this is the question worth
 * answering before reaching for any of them:
 *
 *   SegmentedControl    A question with a short, fixed set of answers, where
 *                       showing them all is the point. Single, always filled,
 *                       cannot be cleared. A radiogroup.
 *   ToggleButtonGroup   The same ARIA pattern with a wider API — multiple
 *                       selection, deselection, vertical orientation, the
 *                       toggle-button variants. Reach for it when you need
 *                       any of those; this component deliberately cannot
 *                       express them.
 *   Tabs                A different pattern. Tabs reveal a region: each tab
 *                       names a panel and each panel names its tab. If the
 *                       thing being chosen is which content is shown rather
 *                       than what gets submitted, it is tabs — and `Tabs`
 *                       can be drawn to look exactly like this.
 *
 * The narrower API is the feature rather than a limitation. A segmented
 * control has one shape — single selection, always filled, never empty — and
 * an API that cannot express a cleared one cannot produce one by accident.
 *
 * WHAT THIS WRAPPER OWNS: moving focus. The primitive reports which option
 * should hold it; focusing is a DOM act, so it happens here, gated so that
 * mounting never steals focus.
 */
export function SegmentedControl({
  options,
  value,
  defaultValue,
  onValueChange,
  label,
  labelledBy,
  size = "md",
  fullWidth,
  className,
  ...rest
}: SegmentedControlProps) {
  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = isControlled ? value : uncontrolled;

  const [focusedValue, setFocusedValue] = useState<string | null>(null);
  const optionsRef = useRef(new Map<string, HTMLButtonElement | null>());
  /** Only move focus in response to a key, never on first paint. */
  const shouldFocus = useRef(false);

  const control = getSegmentedControlProps({
    options: options.map(({ value: v, disabled }) => ({ value: v, disabled })),
    value: current,
    focusedValue,
    label,
    labelledBy,
    onValueChange: (next) => {
      if (!isControlled) setUncontrolled(next);
      onValueChange?.(next);
    },
    onFocusValue: (next) => {
      shouldFocus.current = true;
      setFocusedValue(next);
    },
  });

  useEffect(() => {
    if (!shouldFocus.current || focusedValue === null) return;
    shouldFocus.current = false;
    optionsRef.current.get(focusedValue)?.focus();
  }, [focusedValue]);

  return (
    <div
      {...rest}
      {...control.root}
      className={cx(
        "rata-segmented-control",
        `rata-segmented-control--${size}`,
        fullWidth && "rata-segmented-control--full",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          {...control.option(option.value)}
          className="rata-segmented-control-option rata-state-layer rata-state-layer--flush"
          ref={(node) => {
            optionsRef.current.set(option.value, node);
          }}
        >
          {option.icon && <Icon icon={option.icon} />}
          {option.label}
        </button>
      ))}
    </div>
  );
}
