import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { getNumberFieldProps } from "@rata/primitives";
import type { FieldStatus } from "@rata/primitives";
import { Icon, Minus, Plus } from "@rata/icons";
import { Field } from "./field.js";
import { cx } from "./cx.js";

export type NumberFieldSize = "sm" | "md" | "lg";

export interface NumberFieldProps {
  /** The quantity's name. Always required — `labelHidden` hides it, nothing removes it. */
  label: ReactNode;
  /** Controls the value from outside. `null` is empty, which is different from zero. */
  value?: number | null;
  /** The starting value when the component owns the state. */
  defaultValue?: number | null;
  /** Fires with the parsed number when the value changes. */
  onValueChange?: (value: number | null) => void;
  /** The lowest allowed value. Typed values below it are clamped on blur. */
  min?: number;
  /** The highest allowed value. Typed values above it are clamped on blur. */
  max?: number;
  /** How far ArrowUp, ArrowDown and the buttons move. PageUp and PageDown move ten steps. */
  step?: number;
  /** How the value is displayed when the field is not being edited. */
  formatOptions?: Intl.NumberFormatOptions;
  /** Renders the decrement and increment buttons at either end. */
  stepButtons?: boolean;
  /** Accessible name for the increment button. */
  incrementLabel?: string;
  /** Accessible name for the decrement button. */
  decrementLabel?: string;
  /** A hint shown while the field is empty. */
  placeholder?: string;
  /** Form field name. Submits the unformatted number as a plain decimal string. */
  name?: string;
  /** Control height and inline padding. Text size does not change with it. */
  size?: NumberFieldSize;
  /** Takes the label off screen while leaving it in the accessibility tree. */
  labelHidden?: boolean;
  /** Stable id for the input. Defaults to a generated one. */
  id?: string;
  /** Validation lifecycle. Drives `aria-invalid`, `aria-busy`, and the ring. */
  status?: FieldStatus;
  /** Persistent helper text under the control. */
  description?: ReactNode;
  /** Status-dependent message under the control. */
  message?: ReactNode;
  /** Marks the field required to assistive technology and in the label. */
  required?: boolean;
  /** Blocks editing and stepping while keeping the field focusable, readable and announced. */
  disabled?: boolean;
  /** Class for the wrapper — the width the form wants, not a restyle. */
  className?: string;
}

/**
 * A labelled input for a numeric quantity — the APG spinbutton pattern on a
 * TEXT input, never `type="number"`, so the raw text can be parsed rather
 * than trusted (see the contract for everything the native one gets wrong).
 *
 * Every number rule is the primitive's: parse, clamp, step, format. What this
 * wrapper owns is the state and the DOM:
 *
 * - The committed value and the DRAFT — the raw text while the reader is
 *   editing. Typing changes the draft; blur and Enter commit it.
 * - The LOCALE, read from the nearest `lang` attribute after mount, so a page
 *   cannot disagree with itself about what a comma means.
 * - Press-and-hold. The primitive hands over a schedule; the timers are here.
 *   A press keeps focus where it was — the buttons are not tab stops, and
 *   taking focus would commit the draft mid-edit.
 */
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  {
    label,
    value,
    defaultValue = null,
    onValueChange,
    min,
    max,
    step = 1,
    formatOptions,
    stepButtons = true,
    incrementLabel = "Increase",
    decrementLabel = "Decrease",
    placeholder,
    name,
    size = "md",
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
  const [uncontrolled, setUncontrolled] = useState<number | null>(defaultValue);
  const current = isControlled ? value : uncontrolled;
  const [draft, setDraft] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [locale, setLocale] = useState<string | undefined>(undefined);
  useLayoutEffect(() => {
    const lang = inputRef.current?.closest("[lang]")?.getAttribute("lang");
    setLocale(lang || undefined);
  }, []);

  // What a step reads, kept current between renders as well as at them: a
  // press-and-hold can tick twice before React renders the first step, and a
  // repeat that read the last render's value would step from the same number
  // again.
  const valueRef = useRef(current);
  valueRef.current = current;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const options = {
    min,
    max,
    step,
    locale,
    formatOptions,
    disabled,
    incrementLabel,
    decrementLabel,
    name,
    onValueChange: (next: number | null) => {
      valueRef.current = next;
      if (!isControlled) setUncontrolled(next);
      onValueChange?.(next);
    },
    onDraftChange: (next: string | null) => {
      draftRef.current = next;
      setDraft(next);
    },
  };
  const field = getNumberFieldProps({ ...options, value: current, draft });

  // The repeat timer outlives the render that started it, so each tick builds
  // its bag from the latest options and the value as it stands now.
  const latest = useRef(options);
  latest.current = options;
  const stepNow = (direction: 1 | -1) =>
    getNumberFieldProps({
      ...latest.current,
      value: valueRef.current,
      draft: draftRef.current,
    }).stepBy(direction);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressed = useRef(false);

  const stop = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const stepControl = (direction: 1 | -1) => {
    const bag = direction > 0 ? field.increment : field.decrement;
    return {
      ...bag,
      onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return;
        // Keeps focus — and the draft — in the box.
        event.preventDefault();
        pressed.current = true;
        if (bag["aria-disabled"]) return;
        stepNow(direction);
        const { delay, interval } = field.repeat;
        const tick = () => {
          stepNow(direction);
          timer.current = setTimeout(tick, interval);
        };
        stop();
        timer.current = setTimeout(tick, delay);
      },
      onPointerUp: stop,
      onPointerLeave: stop,
      onPointerCancel: stop,
      onClick: () => {
        // A pointer press already stepped on pointerdown. A click with no
        // press before it is assistive technology activating the button.
        if (pressed.current) {
          pressed.current = false;
          return;
        }
        field.stepBy(direction);
      },
    };
  };

  return (
    <Field
      className={cx("rata-number-field", className)}
      label={label}
      labelHidden={labelHidden}
      id={id}
      status={status}
      description={description}
      message={message}
      required={required}
      disabled={disabled}
    >
      {(control) => (
        <span className="rata-number-field-well">
          {stepButtons && (
            <button
              {...stepControl(-1)}
              className="rata-number-field-step rata-number-field-step--decrement rata-state-layer rata-state-layer--flush"
            >
              <Icon icon={Minus} />
            </button>
          )}
          <input
            {...control}
            {...field.input}
            placeholder={placeholder}
            className={cx(
              "rata-number-field-input",
              `rata-number-field-input--${size}`,
              stepButtons && "rata-number-field-input--stepped"
            )}
            ref={(node) => {
              inputRef.current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) ref.current = node;
            }}
          />
          {stepButtons && (
            <button
              {...stepControl(1)}
              className="rata-number-field-step rata-number-field-step--increment rata-state-layer rata-state-layer--flush"
            >
              <Icon icon={Plus} />
            </button>
          )}
          {field.hidden && <input {...field.hidden} />}
        </span>
      )}
    </Field>
  );
});
