import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { getTextFieldProps } from "@rata/primitives";
import type { TextFieldStatus } from "@rata/primitives";
import { cx } from "./cx.js";

export type { TextFieldStatus };

export type TextFieldSize = "sm" | "md" | "lg";

export interface TextFieldProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    // `size` is deliberately shadowed: the native attribute is a visible width
    // in *characters*, a legacy of pre-CSS layout, and this system sizes a
    // field's box with `size` exactly as Button does. Width here is the form's
    // job, set through `className` — see that prop's contract.
    "disabled" | "required" | "id" | "size"
  > {
  /** The field's label. Always required — `labelHidden` hides it, nothing removes it. */
  label: ReactNode;
  /** Takes the label off screen while leaving it in the accessibility tree. */
  labelHidden?: boolean;
  /** Stable id for the input. Defaults to a generated one. */
  id?: string;
  /** Control height and inline padding. Text size does not change with it. */
  size?: TextFieldSize;
  /** Validation lifecycle. Drives `aria-invalid`, `aria-busy`, and the ring. */
  status?: TextFieldStatus;
  /** Persistent helper text under the input. */
  description?: ReactNode;
  /** Status-dependent message under the input: the error, confirmation, or in-flight note. */
  message?: ReactNode;
  /** Blocks editing while keeping the field focusable, readable and announced. */
  disabled?: boolean;
  /** Marks the field required to assistive technology and in the label. */
  required?: boolean;
  /** Class for the wrapper. The input itself is styled by the system. */
  className?: string;
}

/**
 * A labelled single-line input.
 *
 * The primitive owns every association: it derives the description and message
 * ids from the field's own id, so `htmlFor` and `aria-describedby` are never
 * hand-wired here and cannot drift apart. It also decides the description
 * *order* — the persistent hint before the status message, so a constraint is
 * heard before a failure.
 *
 * `labelHidden` is the only concession to a field without a visible label, and
 * it concedes the pixels rather than the name: the label element is still
 * rendered and still bound by `for`, so nothing about the accessible name
 * changes. The alternative people reach for — dropping the label and letting
 * `placeholder` stand in — loses the name on the first keystroke.
 *
 * `disabled` emits `aria-disabled` plus `readOnly`, never the native attribute:
 * that is the input's analogue of the button's click guard, and it keeps the
 * field in the tab order and the accessibility tree. Note the consequence the
 * contract calls out — a readOnly field still submits its value.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    label,
    labelHidden,
    id,
    size = "md",
    status = "idle",
    description,
    message,
    disabled,
    required,
    className,
    "aria-describedby": describedBy,
    ...rest
  },
  ref
) {
  const generated = useId();
  const fieldId = id ?? generated;

  const field = getTextFieldProps({
    id: fieldId,
    status,
    disabled,
    required,
    hasDescription: description !== undefined && description !== "",
    hasMessage: message !== undefined && message !== "",
    describedBy,
  });

  return (
    <div className={cx("rata-text-field", className)} {...field.root}>
      <label
        className={cx("rata-text-field-label", labelHidden && "rata-visually-hidden")}
        {...field.label}
      >
        {label}
        {/* aria-hidden: aria-required already announces the requirement, and
            reading the marker too would say it twice. */}
        {required && (
          <span className="rata-text-field-required" aria-hidden="true">
            {" *"}
          </span>
        )}
      </label>

      <input
        ref={ref}
        {...rest}
        {...field.input}
        className={cx("rata-text-field-input", `rata-text-field-input--${size}`)}
      />

      {description !== undefined && description !== "" && (
        <p className="rata-text-field-description" {...field.description}>
          {description}
        </p>
      )}

      {/* Rendered whenever there is one, but only joins the description chain
          while the status is not idle — the primitive decides that, so a
          message left behind after a reset stops being announced without
          disappearing from the page. */}
      {message !== undefined && message !== "" && (
        <p className="rata-text-field-message" {...field.message}>
          {message}
        </p>
      )}
    </div>
  );
});
