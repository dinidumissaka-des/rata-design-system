import { forwardRef, useId, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { getSwitchProps } from "@rata/primitives";
import { cx } from "./cx.js";
import { keepCheckedness } from "./keep-checkedness.js";

export interface SwitchProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "disabled" | "id" | "checked" | "defaultChecked" | "onChange" | "type" | "role"
  > {
  /** The setting's label. Always required — `labelHidden` hides it, nothing removes it. */
  label: ReactNode;
  /** Takes the label off screen while leaving it in the accessibility tree. */
  labelHidden?: boolean;
  /** Whether the setting is on. Makes the component controlled. */
  checked?: boolean;
  /** Starting state for an uncontrolled switch. Conflicts with `checked`. */
  defaultChecked?: boolean;
  /** Called with the state the setting should move to. */
  onCheckedChange?: (checked: boolean, event: { preventDefault(): void }) => void;
  /** Helper text under the label. */
  description?: ReactNode;
  /** Stable id for the input. Defaults to a generated one. */
  id?: string;
  /** Blocks the change while keeping the switch focusable and readable. */
  disabled?: boolean;
  className?: string;
}

/**
 * An on/off setting that takes effect the moment it moves.
 *
 * That sentence is the whole API decision. A Checkbox is a value you are about
 * to submit; a Switch has already done the thing. A switch sitting beside a
 * Save button promises something it does not do, which is why the contract
 * documents that arrangement as a mistake rather than a style choice.
 *
 * Built like Checkbox and Radio: a native input laid over the drawn control at
 * zero opacity, so it keeps the tab order, the semantics and the form
 * participation while the visual is paint. The `role="switch"` on that input is
 * the only thing that changes how it is announced — "Notifications, on" rather
 * than "Notifications, checked".
 *
 * There is no indeterminate state, deliberately: a setting is on or off, and a
 * parent summarising children that disagree is a Checkbox.
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  {
    label,
    labelHidden,
    checked,
    defaultChecked,
    onCheckedChange,
    description,
    id,
    disabled,
    className,
    "aria-describedby": describedBy,
    ...rest
  },
  ref
) {
  const generated = useId();
  const fieldId = id ?? generated;

  const isControlled = checked !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultChecked ?? false);
  const current = isControlled ? checked : uncontrolled;

  const field = getSwitchProps({
    id: fieldId,
    checked: current,
    disabled,
    hasDescription: description !== undefined && description !== "",
    describedBy,
    onCheckedChange: (next, event) => {
      if (!isControlled) setUncontrolled(next);
      onCheckedChange?.(next, event);
    },
  });

  return (
    <div
      className={cx("rata-switch", className)}
      data-label-hidden={labelHidden ? "" : undefined}
      {...field.root}
    >
      <span className="rata-switch-control">
        <input
          {...rest}
          {...field.input}
          onClick={(event) => {
            field.input.onClick(event);
            // Blocked activation leaves the native checkedness inverted; see
            // keep-checkedness.ts for why the repair has to be deferred.
            if (disabled) keepCheckedness(event.currentTarget, current);
          }}
          className="rata-switch-input"
          ref={ref}
        />
        {/* Paint only: the input beside it carries every semantic. */}
        <span className="rata-switch-track" aria-hidden="true">
          <span className="rata-switch-thumb" />
        </span>
      </span>

      <span className="rata-switch-text">
        <label
          className={cx("rata-switch-label", labelHidden && "rata-visually-hidden")}
          {...field.label}
        >
          {label}
        </label>
        {description !== undefined && description !== "" && (
          <span className="rata-switch-description" {...field.description}>
            {description}
          </span>
        )}
      </span>
    </div>
  );
});
