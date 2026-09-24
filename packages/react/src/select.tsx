import { forwardRef } from "react";
import type { SelectHTMLAttributes, ReactNode } from "react";
import type { FieldStatus } from "@rata/primitives";
import { Icon, ChevronDown } from "@rata/icons";
import { Field } from "./field.js";
import { cx } from "./cx.js";

export type SelectSize = "sm" | "md" | "lg";

export interface SelectOption {
  value: string;
  /**
   * A string, not a ReactNode — unlike every other option type in this system.
   * An `<option>` holds text and nothing else, so a ReactNode here would be
   * flattened or would crash on a fragment. The type says what the element
   * can actually hold.
   */
  label: string;
  /** Stays in the list and is announced as unavailable, rather than removed. */
  disabled?: boolean;
}

export interface SelectOptionGroup {
  label: string;
  options: SelectOption[];
}

export interface SelectProps
  extends Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    "disabled" | "required" | "id" | "size" | "value" | "defaultValue" | "onChange" | "multiple"
  > {
  /** The control's label. Always required — `labelHidden` hides it, nothing removes it. */
  label: ReactNode;
  /** The choices, in the order they are read. */
  options: Array<SelectOption | SelectOptionGroup>;
  /** Shown while nothing is chosen, as an option that cannot be chosen. */
  placeholder?: string;
  /** Controls the chosen option from outside. */
  value?: string;
  /** The starting choice when the component owns the state. */
  defaultValue?: string;
  /** Fires with the chosen value when it changes. */
  onValueChange?: (value: string) => void;
  /** Control height and inline padding. Text size does not change with it. */
  size?: SelectSize;
  /** Takes the label off screen while leaving it in the accessibility tree. */
  labelHidden?: boolean;
  /** Stable id for the control. Defaults to a generated one. */
  id?: string;
  /** Validation lifecycle. Drives `aria-invalid`, `aria-busy`, and the ring. */
  status?: FieldStatus;
  /** Persistent helper text under the control. */
  description?: ReactNode;
  /** Status-dependent message under the control. */
  message?: ReactNode;
  /** Marks the control required to assistive technology and in the label. */
  required?: boolean;
  /** Marks the whole control unavailable. */
  disabled?: boolean;
  /** Class for the wrapper. The control itself is styled by the system. */
  className?: string;
}

const isGroup = (o: SelectOption | SelectOptionGroup): o is SelectOptionGroup =>
  Array.isArray((o as SelectOptionGroup).options);

/** One `<option>`, or one `<optgroup>` of them. Nothing here is styleable. */
function renderOption(option: SelectOption) {
  return (
    <option key={option.value} value={option.value} disabled={option.disabled}>
      {option.label}
    </option>
  );
}

/**
 * A labelled control for choosing one option from a list.
 *
 * A NATIVE `<select>`, not a listbox built out of divs. What the platform
 * gives away here is enormous and expensive to rebuild: the picker a phone
 * shows instead of a dropdown, the full keyboard model including typeahead,
 * the behaviour when the list outgrows the viewport, and an accessibility
 * implementation that is correct by construction rather than by our testing.
 *
 * The price is that OPTIONS CANNOT BE STYLED — no icon, no second line, no
 * colour, because the operating system draws them. A design that needs more
 * than a string has outgrown this component, and the answer is the listbox
 * version, which is a separate entry with its own primitive and does not exist
 * yet. Faking it with punctuation inside a label is the failure this note is
 * here to prevent.
 *
 * `disabled` uses the NATIVE attribute here, which is this system's one
 * documented departure from the aria-disabled rule: a select has no `readOnly`
 * to fall back on, so the alternative is a control that looks unavailable and
 * is not. That is also why the control bag's `readOnly` is dropped below —
 * it means nothing on this element.
 *
 * Field's `children` returns a ReactNode rather than a bare control, so the
 * positioned wrapper the chevron needs goes inside it. Nothing about the
 * label, helper text or message is written here.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    options,
    placeholder,
    value,
    defaultValue,
    onValueChange,
    size = "md",
    labelHidden,
    id,
    status = "idle",
    description,
    message,
    required,
    disabled,
    className,
    "aria-describedby": describedBy,
    ...rest
  },
  ref
) {
  return (
    <Field
      className={cx("rata-select", className)}
      label={label}
      labelHidden={labelHidden}
      id={id}
      status={status}
      description={description}
      message={message}
      required={required}
      disabled={disabled}
      aria-describedby={describedBy}
    >
      {/* readOnly means nothing on a select, so it is dropped and the native
          `disabled` attribute does the blocking — see the note above. */}
      {({ readOnly: _readOnly, ...control }) => (
        <span className="rata-select-well">
          <select
            ref={ref}
            {...rest}
            {...control}
            disabled={disabled}
            value={value}
            defaultValue={defaultValue ?? (placeholder !== undefined ? "" : undefined)}
            onChange={(event) => onValueChange?.(event.currentTarget.value)}
            className={cx("rata-select-control", `rata-select-control--${size}`)}
          >
            {/* Disabled and empty: it can be shown and cannot be chosen, so
                `required` validation treats it as unanswered rather than as a
                value the reader picked. */}
            {placeholder !== undefined && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) =>
              isGroup(option) ? (
                <optgroup key={option.label} label={option.label}>
                  {option.options.map(renderOption)}
                </optgroup>
              ) : (
                renderOption(option)
              )
            )}
          </select>

          {/* Decorative: the control already announces itself as a chooser. */}
          <Icon icon={ChevronDown} className="rata-select-chevron" aria-hidden="true" />
        </span>
      )}
    </Field>
  );
});
