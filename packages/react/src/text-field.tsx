import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import type { FieldStatus } from "@rata/primitives";
import { Field } from "./field.js";
import { cx } from "./cx.js";

/** The name this status had while TextField was the only thing that had one. */
export type TextFieldStatus = FieldStatus;

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
 * Built on `Field`, which owns the label, the required marker, the helper
 * text, the message and the `data-status` this stylesheet selects on for its
 * ring. What is left here is the one thing that is genuinely a text field: the
 * box. That split is why `Select` and `TextArea` cost a stylesheet each rather
 * than a stylesheet plus a copy of the wiring.
 *
 * The flat API is deliberate and survives the rebuild — `<TextField
 * label="Email" />` is still one element with one prop. A component whose
 * commonest use got more verbose to serve an abstraction would be a bad trade,
 * so `Field` is what this is made OF, not something a caller has to assemble.
 *
 * Every association is still the primitive's: it derives the description and
 * message ids from the field's own id, so `htmlFor` and `aria-describedby` are
 * never hand-wired and cannot drift apart. It also decides the description
 * *order* — the persistent hint before the status message, so a constraint is
 * heard before a failure.
 *
 * `disabled` emits `aria-disabled` plus `readOnly`, never the native
 * attribute: that is the input's analogue of the button's click guard, and it
 * keeps the field in the tab order and the accessibility tree. Note the
 * consequence the contract calls out — a readOnly field still submits its
 * value.
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
  return (
    <Field
      className={cx("rata-text-field", className)}
      label={label}
      labelHidden={labelHidden}
      id={id}
      status={status}
      description={description}
      message={message}
      disabled={disabled}
      required={required}
      aria-describedby={describedBy}
    >
      {(control) => (
        <input
          ref={ref}
          {...rest}
          {...control}
          className={cx("rata-text-field-input", `rata-text-field-input--${size}`)}
        />
      )}
    </Field>
  );
});
