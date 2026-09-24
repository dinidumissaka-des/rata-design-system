import { forwardRef } from "react";
import type { TextareaHTMLAttributes, ReactNode } from "react";
import type { FieldStatus } from "@rata/primitives";
import { Field } from "./field.js";
import { cx } from "./cx.js";

/**
 * Whether the reader may drag the control taller. Horizontal is deliberately
 * absent: a control dragged wider than its column overflows whatever contains
 * it, and no form anticipates that.
 */
export type TextareaResize = "vertical" | "none";

export interface TextareaProps
  extends Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "disabled" | "required" | "id" | "rows"
  > {
  /** The control's label. Always required — `labelHidden` hides it, nothing removes it. */
  label: ReactNode;
  /** How many lines of text the control shows before it scrolls. */
  rows?: number;
  /** Whether the reader may drag the control taller. */
  resize?: TextareaResize;
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
  /** Blocks editing while keeping the control focusable, readable and announced. */
  disabled?: boolean;
  /** Class for the wrapper. The control itself is styled by the system. */
  className?: string;
}

/**
 * A labelled multi-line text input.
 *
 * A separate component rather than a `multiline` prop on `TextField`, because
 * the elements differ in ways a caller has to know about: `TextField` is typed
 * to `HTMLInputElement` and forwards its ref as one, so a boolean that swapped
 * the element would invalidate half its props at runtime while still
 * compiling — and Enter inserts a newline here where it submits there.
 *
 * It has no primitive of its own and no a11y wiring: `Field` supplies every id
 * and ARIA attribute, which is what this component exists to demonstrate as
 * much as to provide. What is left is the box.
 *
 * `rows` is the height, and there is no `size` — a multi-line control's height
 * is how many lines it shows, so offering both would be two props for one
 * measurement. It does not grow with its content in this version; the contract
 * records why, and `resize` covers the case meanwhile.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    rows = 3,
    resize = "vertical",
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
      className={cx("rata-textarea", className)}
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
      {(control) => (
        <textarea
          ref={ref}
          rows={rows}
          {...rest}
          {...control}
          className={cx("rata-textarea-input", `rata-textarea-input--resize-${resize}`)}
        />
      )}
    </Field>
  );
});
