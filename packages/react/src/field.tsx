import { useId } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { getFieldProps } from "@rata/primitives";
import type { FieldControlProps, FieldStatus } from "@rata/primitives";
import { cx } from "./cx.js";

export type { FieldControlProps, FieldStatus };

export interface FieldProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** The control's name. Always required — `labelHidden` hides it, nothing removes it. */
  label: ReactNode;
  /** Renders the control, given the id and ARIA it must carry. */
  children: (control: FieldControlProps) => ReactNode;
  /** Takes the label off screen while leaving it in the accessibility tree. */
  labelHidden?: boolean;
  /** Stable id for the control. Defaults to a generated one. */
  id?: string;
  /** Validation lifecycle. Drives `aria-invalid`, `aria-busy`, and the control's ring. */
  status?: FieldStatus;
  /** Persistent helper text under the control. */
  description?: ReactNode;
  /** Status-dependent message under the control: the error, confirmation, or in-flight note. */
  message?: ReactNode;
  /** Marks the field required to assistive technology and in the label. */
  required?: boolean;
  /** Blocks editing while keeping the field focusable, readable and announced. */
  disabled?: boolean;
  className?: string;
}

/**
 * The label, helper text, message and validation state around a form control.
 *
 * The control arrives as a FUNCTION rather than as children, and that is the
 * one unusual thing here. Field has to hand it six attributes, and of the
 * three ways to do that: cloning `children` breaks the moment someone wraps
 * their input in a fragment, and a context the control opts into makes a
 * control rendered OUTSIDE a Field silently unlabelled — which is the exact
 * failure this component exists to prevent. A function cannot be forgotten,
 * because there is nothing to render without it.
 *
 * It styles nothing inside the control's box. Height, inline padding, border
 * and focus ring stay with each control, because they genuinely differ: a
 * textarea grows with its content, a select reserves a well for its chevron.
 * What Field owns is what is identical across all of them.
 *
 * `TextField` is built on this rather than replaced by it — `<TextField
 * label="Email" />` is still one element with one prop. Reach for Field
 * directly for the controls that have no wrapper yet, and for third-party
 * ones.
 */
export function Field({
  label,
  children,
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
}: FieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;

  const hasDescription = description !== undefined && description !== "";
  const hasMessage = message !== undefined && message !== "";

  const field = getFieldProps({
    id: fieldId,
    status,
    disabled,
    required,
    hasDescription,
    hasMessage,
    describedBy,
  });

  return (
    <div {...rest} className={cx("rata-field", className)} {...field.root}>
      <label
        className={cx("rata-field-label", labelHidden && "rata-visually-hidden")}
        {...field.label}
      >
        {label}
        {/* aria-hidden: aria-required already announces the requirement, and
            reading the marker too would say it twice. */}
        {required && (
          <span className="rata-field-required" aria-hidden="true">
            {" *"}
          </span>
        )}
      </label>

      {children(field.input)}

      {hasDescription && (
        <p className="rata-field-description" {...field.description}>
          {description}
        </p>
      )}

      {/* Rendered whenever there is one, but only joins the description chain
          while the status is not idle — the primitive decides that, so a
          message left behind after a reset stops being announced without
          disappearing from the page. */}
      {hasMessage && (
        <p className="rata-field-message" {...field.message}>
          {message}
        </p>
      )}
    </div>
  );
}
