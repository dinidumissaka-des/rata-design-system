/**
 * Headless SLIDER behavior — APG Slider and Multi-Thumb Slider on native
 * `<input type="range">`, one per thumb.
 *
 * The native input is the hit surface and the keyboard model; the track and
 * thumb are drawn. So this returns, per thumb, the input's prop bag and the
 * drawn thumb's state, plus the fill's extent — all as data, no DOM.
 *
 * Four things the platform does not do, and this does:
 *
 * - KEEPS TWO THUMBS FROM CROSSING. Each input keeps the full `min`/`max`, so
 *   its pointer mapping matches the drawn track; a change past the other
 *   thumb is clamped to it instead — each thumb's limit is the other's value.
 * - PAGEUP / PAGEDOWN MOVE TEN STEPS. Engines disagree about the native page
 *   step, and the contract promises ten.
 * - THE DISABLED GUARD. A range input has no `readOnly`, so with `disabled`
 *   the value keys and pointer down are refused, and an adjustment that slips
 *   past them (an assistive-technology gesture) reports nothing — the wrapper
 *   renders the input controlled, so it snaps back to the current value.
 * - HOVER AND PRESS FOR THE DRAWN THUMB. The pointer is on the transparent
 *   input, the feedback is on the thumb, so pointer events on the input set
 *   `data-hovered` / `data-pressed` on the thumb, which `.rata-state-layer`
 *   responds to (decision C9).
 *
 * Commit is reported from the native `change` event (`onCommit`), which the
 * platform fires once per interaction — pointer release, each key press, an
 * assistive-technology adjustment — and which React's `onChange` does not
 * expose. The wrapper attaches it.
 */

export type SliderValue = number | [number, number];

/** The part of a keyboard event this reads. */
export interface SliderKeyEvent {
  key: string;
  preventDefault(): void;
}

export interface SliderOptions {
  /** The first input's id — the label's `for` points at it. The second derives from it. */
  id: string;
  value: SliderValue;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Names for the two thumbs of a range. */
  thumbLabels?: [string, string];
  formatValue?: (value: number) => string;
  name?: string;
  /** Pointer over each thumb's input. */
  hovered?: [boolean, boolean];
  /** Pointer down on each thumb's input. */
  pressed?: [boolean, boolean];
  onValueChange?: (value: SliderValue) => void;
  onValueCommit?: (value: SliderValue) => void;
  onHoveredChange?: (index: number, hovered: boolean) => void;
  onPressedChange?: (index: number, pressed: boolean) => void;
}

export interface SliderInputProps {
  type: "range";
  id: string;
  min: number;
  max: number;
  step: number;
  value: string;
  name: string | undefined;
  "aria-label": string | undefined;
  "aria-valuetext": string | undefined;
  "aria-disabled": true | undefined;
  onChange: (event: { target: { value: string } }) => void;
  onKeyDown: (event: SliderKeyEvent) => void;
  onPointerDown: (event: { preventDefault(): void }) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  /** Call from the native `change` event with the input's value. */
  onCommit: (raw: string) => void;
}

export interface SliderThumb {
  input: SliderInputProps;
  thumb: {
    "data-hovered": "" | undefined;
    "data-pressed": "" | undefined;
  };
  /** Where the thumb sits along the track, 0 to 1. */
  position: number;
}

export interface SliderProps {
  range: boolean;
  thumbs: SliderThumb[];
  /** The fill's extent along the track, 0 to 1: from min to the thumb, or between two. */
  fill: { start: number; end: number };
  /** For a range, the value halfway between the thumbs, 0 to 1 — the line that splits their hit areas. */
  split: number;
  /** The visible text: one value, or both ends of a range. */
  output: string;
  /** The group bag a range is wrapped in; `null` for one thumb. */
  group: { role: "group" } | null;
}

const VALUE_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

function decimals(n: number): number {
  const text = String(n);
  if (text.includes("e-")) return Number(text.split("e-")[1]);
  return text.includes(".") ? text.split(".")[1]!.length : 0;
}

/** Onto the step grid from `min`, then into `[min, max]`. */
export function snapToStep(value: number, min: number, max: number, step: number): number {
  const snapped = Math.round((value - min) / step) * step + min;
  const rounded = Number(snapped.toFixed(Math.min(20, Math.max(decimals(step), decimals(min)))));
  return Math.min(max, Math.max(min, rounded));
}

export function getSliderProps(options: SliderOptions): SliderProps {
  const {
    id,
    value,
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    thumbLabels,
    formatValue,
    name,
    hovered = [false, false],
    pressed = [false, false],
    onValueChange,
    onValueCommit,
    onHoveredChange,
    onPressedChange,
  } = options;

  const range = Array.isArray(value);
  const values: number[] = range ? [value[0], value[1]] : [value];
  const span = max - min || 1;
  const fraction = (v: number) => Math.min(1, Math.max(0, (v - min) / span));
  const text = (v: number) => (formatValue ? formatValue(v) : String(v));

  /** The whole value with thumb `index` moved to `next`, clamped so the thumbs never cross. */
  const withThumb = (index: number, next: number): SliderValue => {
    let v = snapToStep(next, min, max, step);
    if (!range) return v;
    if (index === 0) v = Math.min(v, values[1]!);
    else v = Math.max(v, values[0]!);
    return index === 0 ? [v, values[1]!] : [values[0]!, v];
  };

  const same = (a: SliderValue, b: SliderValue) =>
    Array.isArray(a) && Array.isArray(b) ? a[0] === b[0] && a[1] === b[1] : a === b;

  const thumbs = values.map((current, index): SliderThumb => {
    const move = (next: number, commit: boolean) => {
      const whole = withThumb(index, next);
      if (!same(whole, value)) onValueChange?.(whole);
      if (commit) onValueCommit?.(whole);
    };

    return {
      input: {
        type: "range",
        id: index === 0 ? id : `${id}-end`,
        min,
        max,
        step,
        value: String(current),
        name,
        "aria-label": range ? thumbLabels?.[index] : undefined,
        "aria-valuetext": formatValue ? formatValue(current) : undefined,
        "aria-disabled": disabled || undefined,
        onChange: (event) => {
          // An adjustment that got past the guard reports nothing; the
          // controlled input snaps back to `value`.
          if (disabled) return;
          const next = Number(event.target.value);
          if (Number.isFinite(next)) move(next, false);
        },
        onKeyDown: (event) => {
          if (!VALUE_KEYS.has(event.key)) return;
          if (disabled) {
            event.preventDefault();
            return;
          }
          if (event.key === "PageUp" || event.key === "PageDown") {
            // Prevented, so no native change event follows: this press is the
            // whole interaction, so it commits here.
            event.preventDefault();
            move(current + (event.key === "PageUp" ? 10 : -10) * step, true);
          }
        },
        onPointerDown: (event) => {
          if (disabled) {
            event.preventDefault();
            return;
          }
          onPressedChange?.(index, true);
        },
        onPointerUp: () => onPressedChange?.(index, false),
        onPointerCancel: () => onPressedChange?.(index, false),
        onPointerEnter: () => {
          if (!disabled) onHoveredChange?.(index, true);
        },
        onPointerLeave: () => onHoveredChange?.(index, false),
        onCommit: (raw) => {
          if (disabled) return;
          const next = Number(raw);
          if (Number.isFinite(next)) onValueCommit?.(withThumb(index, next));
        },
      },
      thumb: {
        "data-hovered": !disabled && hovered[index] ? "" : undefined,
        "data-pressed": !disabled && pressed[index] ? "" : undefined,
      },
      position: fraction(current),
    };
  });

  return {
    range,
    thumbs,
    fill: range
      ? { start: fraction(values[0]!), end: fraction(values[1]!) }
      : { start: 0, end: fraction(values[0]!) },
    split: range ? (fraction(values[0]!) + fraction(values[1]!)) / 2 : 1,
    output: range ? `${text(values[0]!)} – ${text(values[1]!)}` : text(values[0]!),
    group: range ? { role: "group" } : null,
  };
}
