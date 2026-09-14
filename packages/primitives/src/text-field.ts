/**
 * Headless text-field behavior.
 *
 * Pure function (no framework hooks) so it is trivially testable and portable
 * to non-React wrappers later. The caller owns the `id` — the React wrapper
 * passes `useId()` — and this function derives the description and message ids
 * from it, so label/description/message association is never hand-wired.
 *
 * Follows the system's aria-disabled convention rather than the native
 * `disabled` attribute: the field stays focusable and screen-reader
 * discoverable. For an input, the analogue of the button's click guard is
 * `readOnly` — it blocks editing without removing the control from the
 * accessibility tree or the tab order.
 */

/**
 * Validation lifecycle. `idle` is the resting state; `validating` covers
 * in-flight async checks (a uniqueness lookup, say). Each maps to its own
 * ring token in step 2.
 */
export type TextFieldStatus = "idle" | "validating" | "valid" | "invalid";

export interface TextFieldOptions {
  /** Stable unique id for this field. The wrapper supplies it (`useId`). */
  id: string;
  status?: TextFieldStatus;
  disabled?: boolean;
  required?: boolean;
  /** True when the caller renders helper text under the input. */
  hasDescription?: boolean;
  /** True when the caller renders a status/error message under the input. */
  hasMessage?: boolean;
  /** Ids of any further elements describing the input, appended last. */
  describedBy?: string;
}

export interface TextFieldProps {
  root: {
    "data-status": TextFieldStatus;
    "data-disabled": "" | undefined;
  };
  label: {
    htmlFor: string;
  };
  input: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": true | undefined;
    "aria-required": true | undefined;
    "aria-disabled": true | undefined;
    "aria-busy": true | undefined;
    readOnly: true | undefined;
  };
  description: {
    id: string;
  };
  message: {
    id: string;
    "aria-live": "polite";
  };
}

export function getTextFieldProps(options: TextFieldOptions): TextFieldProps {
  const {
    id,
    status = "idle",
    disabled = false,
    required = false,
    hasDescription = false,
    hasMessage = false,
    describedBy,
  } = options;

  const descriptionId = `${id}-description`;
  const messageId = `${id}-message`;

  const described = [
    hasDescription ? descriptionId : undefined,
    hasMessage && status !== "idle" ? messageId : undefined,
    describedBy,
  ].filter(Boolean);

  return {
    root: {
      "data-status": status,
      "data-disabled": disabled ? "" : undefined,
    },
    label: {
      htmlFor: id,
    },
    input: {
      id,
      "aria-describedby": described.length ? described.join(" ") : undefined,
      "aria-invalid": status === "invalid" || undefined,
      "aria-required": required || undefined,
      "aria-disabled": disabled || undefined,
      "aria-busy": status === "validating" || undefined,
      readOnly: disabled || undefined,
    },
    description: {
      id: descriptionId,
    },
    message: {
      id: messageId,
      // Polite rather than role="alert": the message is already in
      // aria-describedby, and an assertive live region would announce it a
      // second time the moment focus lands on the input.
      "aria-live": "polite",
    },
  };
}
