import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { fieldLabelId, getSliderProps } from "@rata/primitives";
import type { SliderValue } from "@rata/primitives";
import { Field } from "./field.js";
import { cx } from "./cx.js";

export type { SliderValue };

export interface SliderProps {
  /** What the value measures. Always required — `labelHidden` hides it, nothing removes it. */
  label: ReactNode;
  /** Controls the value from outside. A two-element tuple renders two thumbs. */
  value?: number | [number, number];
  /** The starting value when the component owns the state. Its shape decides one thumb or two. */
  defaultValue?: number | [number, number];
  /** Fires continuously while the thumb moves. */
  onValueChange?: (value: number | [number, number]) => void;
  /** Fires once when an interaction ends: pointer release, a key press, or an assistive-technology adjustment. */
  onValueCommit?: (value: number | [number, number]) => void;
  /** The lowest value. */
  min?: number;
  /** The highest value. */
  max?: number;
  /** The grid values snap to. Arrow keys move one step, PageUp and PageDown ten. */
  step?: number;
  /** Names for the two thumbs of a range. Required when the value is a tuple. */
  thumbLabels?: [string, string];
  /** Turns a value into the text shown in the output and announced as `aria-valuetext`. */
  formatValue?: (value: number) => string;
  /** Renders the current value as visible text beside the label. */
  showValue?: boolean;
  /** Form field name. A range submits two values under the same name, lower first. */
  name?: string;
  /** Takes the label off screen while leaving it in the accessibility tree. */
  labelHidden?: boolean;
  /** Stable id for the slider. Defaults to a generated one. */
  id?: string;
  /** Persistent helper text under the control. */
  description?: ReactNode;
  /** Blocks adjustment while keeping the slider focusable, readable and announced. */
  disabled?: boolean;
  /** Class for the wrapper — the width the layout wants, not a restyle. */
  className?: string;
}

/**
 * Choose a value, or a range of two, along a bounded track.
 *
 * One NATIVE `<input type="range">` per thumb, never a `div role="slider"`:
 * the native control is what iOS VoiceOver's swipe-to-adjust reaches, what a
 * form submits, and where Home/End/PageUp come from. It lies transparent over
 * a drawn track and thumb — the thumb is a real element, positioned from the
 * value by transform, so it can carry `.rata-state-layer`.
 *
 * The primitive decides everything about values. What this wrapper owns:
 *
 * - The pointer state the thumb's feedback is drawn from (`data-hovered`,
 *   `data-pressed`, decision C9), kept per thumb.
 * - `onValueCommit`, from the native `change` event, which React's `onChange`
 *   does not expose and which the platform fires exactly once per
 *   interaction — release, key press, or an assistive-technology adjustment.
 * - The number of thumbs, decided once from the first value's shape.
 *
 * A range is a `role="group"` named by the label through `aria-labelledby`;
 * each thumb is named by `thumbLabels`. The `<output>` is not a live region,
 * because each thumb's `aria-valuetext` is already announced on change.
 */
export function Slider({
  label,
  value,
  min = 0,
  defaultValue = min,
  onValueChange,
  onValueCommit,
  max = 100,
  step = 1,
  thumbLabels,
  formatValue,
  showValue = true,
  name,
  labelHidden = false,
  id,
  description,
  disabled = false,
  className,
}: SliderProps) {
  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState<SliderValue>(defaultValue);
  const current = isControlled ? value : uncontrolled;
  const [hovered, setHovered] = useState<[boolean, boolean]>([false, false]);
  const [pressed, setPressed] = useState<[boolean, boolean]>([false, false]);

  // Decided once: switching between a number and a tuple is not supported.
  const [range] = useState(() => Array.isArray(current));

  const setAt =
    (set: (update: (prev: [boolean, boolean]) => [boolean, boolean]) => void) =>
    (index: number, on: boolean) =>
      set((prev) => {
        if (prev[index] === on) return prev;
        const next: [boolean, boolean] = [prev[0], prev[1]];
        next[index] = on;
        return next;
      });

  const controlRef = useRef<HTMLSpanElement | null>(null);
  const latest = useRef<ReturnType<typeof getSliderProps> | null>(null);

  // The native change event: one per interaction, which is what commit means.
  useEffect(() => {
    const inputs = [...(controlRef.current?.querySelectorAll("input") ?? [])];
    const listeners = inputs.map((input, index) => {
      const listener = () => latest.current?.thumbs[index]?.input.onCommit(input.value);
      input.addEventListener("change", listener);
      return () => input.removeEventListener("change", listener);
    });
    return () => listeners.forEach((remove) => remove());
  }, []);

  return (
    <Field
      className={cx("rata-slider", range && "rata-slider--range", className)}
      label={label}
      labelHidden={labelHidden}
      id={id}
      description={description}
      disabled={disabled}
    >
      {({ readOnly: _readOnly, id: controlId, ...control }) => {
        const slider = getSliderProps({
          id: controlId,
          value: range && !Array.isArray(current) ? [current, current] : current,
          min,
          max,
          step,
          disabled,
          thumbLabels,
          formatValue,
          name,
          hovered,
          pressed,
          onValueChange: (next) => {
            if (!isControlled) setUncontrolled(next);
            onValueChange?.(next);
          },
          onValueCommit,
          onHoveredChange: setAt(setHovered),
          onPressedChange: setAt(setPressed),
        });
        latest.current = slider;

        const style = {
          "--rata-slider-start": slider.fill.start,
          "--rata-slider-end": slider.fill.end,
          "--rata-slider-split": slider.split,
        } as CSSProperties;

        return (
          <>
            {showValue && (
              <output
                className="rata-slider-output"
                htmlFor={slider.thumbs.map((t) => t.input.id).join(" ")}
                // Not a live region: each thumb's valuetext is already
                // announced on every change, and this would say it twice.
                aria-live="off"
              >
                {slider.output}
              </output>
            )}
            <span
              ref={controlRef}
              className="rata-slider-control"
              style={style}
              {...(slider.group
                ? { ...slider.group, "aria-labelledby": fieldLabelId(controlId) }
                : {})}
            >
              <span className="rata-slider-track" aria-hidden="true">
                <span className="rata-slider-fill" />
              </span>
              {slider.thumbs.map((thumb, index) => (
                <ThumbPair
                  key={index}
                  input={{ ...control, ...thumb.input }}
                  thumb={thumb.thumb}
                  position={thumb.position}
                  modifier={range ? (index === 0 ? "start" : "end") : undefined}
                />
              ))}
            </span>
          </>
        );
      }}
    </Field>
  );
}

/** One native control and the drawn thumb it moves, adjacent so focus can reach the thumb in CSS. */
function ThumbPair({
  input,
  thumb,
  position,
  modifier,
}: {
  input: Record<string, unknown> & ReturnType<typeof getSliderProps>["thumbs"][number]["input"];
  thumb: ReturnType<typeof getSliderProps>["thumbs"][number]["thumb"];
  position: number;
  modifier: "start" | "end" | undefined;
}) {
  const { onCommit: _onCommit, ...native } = input;
  return (
    <>
      <input
        {...native}
        className={cx("rata-slider-range", modifier && `rata-slider-range--${modifier}`)}
      />
      <span
        className="rata-slider-rail"
        style={{ "--rata-slider-position": position } as CSSProperties}
        aria-hidden="true"
      >
        <span {...thumb} className="rata-slider-thumb rata-state-layer" />
      </span>
    </>
  );
}
