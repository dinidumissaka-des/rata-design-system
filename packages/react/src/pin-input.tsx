import { forwardRef, useState } from "react";
import type { ReactNode, SyntheticEvent } from "react";
import { getPinInputProps } from "@rata/primitives";
import type { FieldStatus, PinInputCharacters, PinInputPurpose } from "@rata/primitives";
import { Field } from "./field.js";
import { cx } from "./cx.js";

export type PinInputSize = "md" | "lg";
export type { PinInputCharacters, PinInputPurpose };

export interface PinInputProps {
  /** What the code is. Always required — `labelHidden` hides it, nothing removes it. */
  label: ReactNode;
  /** How many characters the code has. Draws that many boxes and caps the input. */
  length: number;
  /** Controls the code from outside. */
  value?: string;
  /** The starting text when the component owns the state. */
  defaultValue?: string;
  /** Fires with the whole code on every change. */
  onValueChange?: (value: string) => void;
  /** Fires once when the code reaches `length` characters. */
  onComplete?: (value: string) => void;
  /** Which characters are accepted, and which on-screen keyboard appears. */
  characters?: PinInputCharacters;
  /** Whether this is a code the reader was sent or a secret they know. */
  purpose?: PinInputPurpose;
  /** Form field name. Submits the code as one string. */
  name?: string;
  /** Box size. There is no `sm`. */
  size?: PinInputSize;
  /** Takes the label off screen while leaving it in the accessibility tree. */
  labelHidden?: boolean;
  /** Stable id for the code input. Defaults to a generated one. */
  id?: string;
  /** Validation lifecycle. Drives `aria-invalid`, `aria-busy`, and the ring on every box. */
  status?: FieldStatus;
  /** Persistent helper text under the control. */
  description?: ReactNode;
  /** Status-dependent message under the control. */
  message?: ReactNode;
  /** Marks the field required to assistive technology and in the label. */
  required?: boolean;
  /** Blocks typing while keeping the input focusable, readable and announced. */
  disabled?: boolean;
  /** Class for the wrapper — placement, not a restyle. */
  className?: string;
}

/**
 * A fixed-length code entered into ONE input drawn as boxes.
 *
 * The input is real, labelled, and lies transparent over the boxes; the boxes
 * are `aria-hidden` and drawn from the primitive's per-box state, so they can
 * never disagree with what the input holds. Autofill, paste and Backspace are
 * the platform's because there is only one control.
 *
 * What this wrapper adds is the DOM: it tracks focus and the caret (from
 * `select` events) for the primitive to derive the active box from, and it
 * puts the length — "6 characters" — at the HEAD of the description chain,
 * ahead of Field's helper text, so a reader who cannot see the boxes hears
 * how long the code is before anything else.
 *
 * `onComplete` never submits anything. The caller starts verification.
 */
export const PinInput = forwardRef<HTMLInputElement, PinInputProps>(function PinInput(
  {
    label,
    length,
    value,
    defaultValue = "",
    onValueChange,
    onComplete,
    characters = "numeric",
    purpose = "one-time-code",
    name,
    size = "lg",
    labelHidden = false,
    id,
    status = "idle",
    description,
    message,
    required = false,
    disabled = false,
    className,
  },
  ref
) {
  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const current = isControlled ? value : uncontrolled;
  const [focused, setFocused] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);

  const trackCaret = (event: SyntheticEvent<HTMLInputElement>) =>
    setSelectionStart(event.currentTarget.selectionStart);

  return (
    <Field
      className={cx("rata-pin-input", `rata-pin-input--${size}`, className)}
      label={label}
      labelHidden={labelHidden}
      id={id}
      status={status}
      description={description}
      message={message}
      required={required}
      disabled={disabled}
    >
      {(control) => {
        const pin = getPinInputProps({
          id: control.id,
          value: current,
          length,
          characters,
          purpose,
          disabled,
          focused,
          selectionStart,
          onValueChange: (next) => {
            if (!isControlled) setUncontrolled(next);
            onValueChange?.(next);
          },
          onComplete,
        });
        const describedBy = [pin.lengthDescription.id, control["aria-describedby"]]
          .filter(Boolean)
          .join(" ");
        return (
          <span className="rata-pin-input-well">
            <span className="rata-pin-input-boxes" aria-hidden="true">
              {pin.boxes.map((box, index) => (
                <span
                  key={index}
                  className="rata-pin-input-box"
                  data-state={box.state}
                  data-caret={box.caret ? "" : undefined}
                >
                  {box.masked ? <span className="rata-pin-input-dot" /> : box.char}
                </span>
              ))}
            </span>
            <input
              ref={ref}
              {...control}
              {...pin.input}
              aria-describedby={describedBy}
              name={name}
              className="rata-pin-input-control"
              onFocus={(event) => {
                setFocused(true);
                trackCaret(event);
              }}
              onChange={(event) => {
                pin.input.onChange(event);
                trackCaret(event);
              }}
              onBlur={() => setFocused(false)}
              onSelect={trackCaret}
              onKeyUp={trackCaret}
            />
            <span className="rata-visually-hidden" id={pin.lengthDescription.id}>
              {pin.lengthDescription.text}
            </span>
          </span>
        );
      }}
    </Field>
  );
});
