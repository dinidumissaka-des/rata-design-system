/**
 * Headless NUMBER FIELD behavior — an APG spinbutton over a text input.
 *
 * Pure functions, no framework hooks and no timers. Parsing, clamping,
 * stepping and formatting are exported on their own so they can be tested and
 * reused without a component; `getNumberFieldProps` assembles them into the
 * input, button and hidden-input prop bags.
 *
 * WHO HOLDS WHAT. The caller holds two pieces of state: the committed `value`
 * (a number, or `null` for empty) and the `draft` — the raw text while the
 * reader is editing, or `null` when they are not. The input shows the draft
 * while there is one and the formatted value otherwise. Typing changes the
 * draft only; the value, the clamp and the formatting happen on commit (blur
 * or Enter), so "-", "1." and "0.0" are never rewritten under the caret.
 *
 * Press-and-hold repeat is returned as DATA (`repeat`), not run here: timers
 * are the wrapper's, the schedule is the primitive's.
 *
 * Disabled follows the system rule: `aria-disabled` and `readOnly` come from
 * Field, and this refuses every key and both buttons. The value still submits.
 */

/** The part of a keyboard event this reads. */
export interface NumberFieldKeyEvent {
  key: string;
  preventDefault(): void;
}

export interface NumberFieldOptions {
  /** The committed value. `null` is empty, which is not zero. */
  value: number | null;
  /** The text being edited, or `null` when the field is not being edited. */
  draft: string | null;
  min?: number;
  max?: number;
  /** How far one arrow press or button press moves. Defaults to 1. */
  step?: number;
  /** BCP 47 locale for parsing and formatting — the page's, never a prop. */
  locale?: string;
  formatOptions?: Intl.NumberFormatOptions;
  disabled?: boolean;
  /** Accessible name for the increment button. */
  incrementLabel?: string;
  /** Accessible name for the decrement button. */
  decrementLabel?: string;
  /** Form name. Carried by the hidden input, which holds the plain number. */
  name?: string;
  /** Fires only when the committed number actually changes. */
  onValueChange?: (value: number | null) => void;
  onDraftChange?: (draft: string | null) => void;
}

export interface NumberFieldStepButtonProps {
  type: "button";
  /** APG: the buttons are pointer targets; the keyboard has the arrow keys. */
  tabIndex: -1;
  "aria-label": string;
  "aria-disabled": true | undefined;
}

export interface NumberFieldProps {
  input: {
    type: "text";
    role: "spinbutton";
    inputMode: "decimal";
    autoComplete: "off";
    value: string;
    "aria-valuenow": number | undefined;
    "aria-valuemin": number | undefined;
    "aria-valuemax": number | undefined;
    "aria-valuetext": string | undefined;
    onFocus: () => void;
    onBlur: () => void;
    onChange: (event: { target: { value: string } }) => void;
    onKeyDown: (event: NumberFieldKeyEvent) => void;
  };
  decrement: NumberFieldStepButtonProps;
  increment: NumberFieldStepButtonProps;
  /** `null` without a `name` — there is nothing to submit under. */
  hidden: { type: "hidden"; name: string; value: string } | null;
  /** Steps once in a direction, refusing at a limit or while disabled. */
  stepBy: (direction: 1 | -1) => void;
  /** Press-and-hold schedule, in milliseconds: first repeat after `delay`, then every `interval`. */
  repeat: { delay: number; interval: number };
}

/** The native spinner's feel: a pause long enough for a single tap, then a steady run. */
export const NUMBER_FIELD_REPEAT = { delay: 400, interval: 60 } as const;

/** The locale's decimal and grouping separators, read from Intl rather than guessed. */
export function separators(locale?: string): { decimal: string; group: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(11111.1);
  return {
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
    group: parts.find((p) => p.type === "group")?.value ?? ",",
  };
}

const isPercent = (formatOptions?: Intl.NumberFormatOptions) => formatOptions?.style === "percent";

/**
 * Text → number. `null` for empty text, `undefined` for text that is not a
 * number — the distinction a native number input cannot make.
 *
 * Accepts the field's own formatted output too ("€1,250.00"), since that is
 * what is in the box if the reader commits without editing. Grouping
 * separators are dropped, the locale's decimal separator becomes ".", and the
 * ASCII and Unicode minus signs are both a minus.
 */
export function parseNumber(
  text: string,
  locale?: string,
  formatOptions?: Intl.NumberFormatOptions
): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const { decimal, group } = separators(locale);
  let normalised = trimmed.replace(/[−‒–]/g, "-");
  // A non-breaking or narrow space is the group separator in several locales;
  // a typed ordinary space means the same thing there.
  if (/\s/.test(group)) normalised = normalised.replace(/\s/g, "");
  normalised = normalised.split(group).join("");
  if (decimal !== ".") normalised = normalised.split(decimal).join(".");
  // The format's own currency symbol, percent sign and unit are formatting,
  // not number — read from Intl, so only what this format produces is
  // dropped and "1e5" stays the non-number it is.
  for (const part of new Intl.NumberFormat(locale, formatOptions).formatToParts(-1)) {
    if (["currency", "percentSign", "unit", "literal"].includes(part.type)) {
      normalised = normalised.split(part.value.trim()).join("");
    }
  }
  normalised = normalised.replace(/\s/g, "");
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(normalised)) return undefined;
  const parsed = Number(normalised);
  if (!Number.isFinite(parsed)) return undefined;
  return isPercent(formatOptions) ? roundTo(parsed / 100, decimals(parsed) + 2) : parsed;
}

/** Between `min` and `max`, whichever of them is set. */
export function clamp(value: number, min?: number, max?: number): number {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}

function decimals(n: number): number {
  const text = String(n);
  if (text.includes("e-")) return Number(text.split("e-")[1]);
  return text.includes(".") ? text.split(".")[1]!.length : 0;
}

function roundTo(n: number, places: number): number {
  return Number(n.toFixed(Math.min(places, 20)));
}

/**
 * One step from `value`. Empty starts from `min`, or zero. The result is
 * rounded to the precision of the step and the starting value, so 0.1 + 0.2
 * is 0.3 rather than 0.30000000000000004, and then clamped. A typed value off
 * the step grid moves by `step` from where it is; it is not snapped.
 */
export function stepValue(
  value: number | null,
  direction: number,
  options: { step?: number; min?: number; max?: number } = {}
): number {
  const { step = 1, min, max } = options;
  if (value === null) return clamp(min ?? 0, min, max);
  const next = roundTo(value + direction * step, Math.max(decimals(step), decimals(value)));
  return clamp(next, min, max);
}

/** The value as the reader sees it at rest — "€1,250.00". */
export function formatNumber(
  value: number,
  locale?: string,
  formatOptions?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, formatOptions).format(value);
}

/**
 * The value as the reader edits it — "1250.00": the locale's decimal
 * separator and the format's fraction digits, but no grouping, currency or
 * unit, which are all things a reader should not have to type around.
 */
export function formatForEditing(
  value: number | null,
  locale?: string,
  formatOptions?: Intl.NumberFormatOptions
): string {
  if (value === null) return "";
  const resolved = new Intl.NumberFormat(locale, formatOptions).resolvedOptions();
  const shown = isPercent(formatOptions) ? roundTo(value * 100, decimals(value)) : value;
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumFractionDigits: resolved.minimumFractionDigits,
    maximumFractionDigits: Math.max(resolved.minimumFractionDigits ?? 0, 20),
  }).format(shown);
}

export function getNumberFieldProps(options: NumberFieldOptions): NumberFieldProps {
  const {
    value,
    draft,
    min,
    max,
    step = 1,
    locale,
    formatOptions,
    disabled = false,
    incrementLabel = "Increase",
    decrementLabel = "Decrease",
    name,
    onValueChange,
    onDraftChange,
  } = options;

  const atMin = value !== null && min !== undefined && value <= min;
  const atMax = value !== null && max !== undefined && value >= max;

  const emit = (next: number | null) => {
    if (next !== value) onValueChange?.(next);
  };

  /** Resolves the draft to a value. Unparseable text falls back to the last good value. */
  const commit = (): number | null => {
    if (draft === null) return value;
    const parsed = parseNumber(draft, locale, formatOptions);
    const next = parsed === undefined ? value : parsed === null ? null : clamp(parsed, min, max);
    emit(next);
    return next;
  };

  const moveTo = (next: number) => {
    emit(next);
    if (draft !== null) onDraftChange?.(formatForEditing(next, locale, formatOptions));
  };

  const stepBy = (direction: 1 | -1, multiplier = 1) => {
    if (disabled) return;
    // Step from what is typed, when it is a number, so the arrow keys continue
    // from the reader's entry rather than from the last committed value.
    const parsed = draft === null ? value : parseNumber(draft, locale, formatOptions);
    const from = parsed === undefined ? value : parsed;
    if (from !== null && direction < 0 && min !== undefined && from <= min) return;
    if (from !== null && direction > 0 && max !== undefined && from >= max) return;
    moveTo(stepValue(from, direction * multiplier, { step, min, max }));
  };

  const button = (label: string, refused: boolean): NumberFieldStepButtonProps => ({
    type: "button",
    tabIndex: -1,
    "aria-label": label,
    "aria-disabled": disabled || refused || undefined,
  });

  return {
    input: {
      type: "text",
      role: "spinbutton",
      inputMode: "decimal",
      autoComplete: "off",
      value: draft ?? (value === null ? "" : formatNumber(value, locale, formatOptions)),
      "aria-valuenow": value ?? undefined,
      "aria-valuemin": min,
      "aria-valuemax": max,
      // What is announced is what is shown at rest: "€12.50", not "12.5".
      "aria-valuetext": value === null ? undefined : formatNumber(value, locale, formatOptions),
      onFocus: () => {
        onDraftChange?.(formatForEditing(value, locale, formatOptions));
      },
      onBlur: () => {
        commit();
        onDraftChange?.(null);
      },
      onChange: (event) => {
        if (disabled) return;
        onDraftChange?.(event.target.value);
      },
      onKeyDown: (event) => {
        if (disabled) {
          // Keys that would change the value are refused; Tab and the rest pass.
          if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) {
            event.preventDefault();
          }
          return;
        }
        switch (event.key) {
          case "ArrowUp":
            event.preventDefault();
            stepBy(1);
            return;
          case "ArrowDown":
            event.preventDefault();
            stepBy(-1);
            return;
          case "PageUp":
            event.preventDefault();
            stepBy(1, 10);
            return;
          case "PageDown":
            event.preventDefault();
            stepBy(-1, 10);
            return;
          // APG: Home and End go to the limits — only when there is one, or
          // the keys keep their caret meaning inside the text.
          case "Home":
            if (min === undefined) return;
            event.preventDefault();
            moveTo(min);
            return;
          case "End":
            if (max === undefined) return;
            event.preventDefault();
            moveTo(max);
            return;
          case "Enter": {
            // Not prevented: Enter may also be submitting the form, and the
            // value it submits is the one committed here, first.
            const next = commit();
            onDraftChange?.(formatForEditing(next, locale, formatOptions));
            return;
          }
        }
      },
    },
    decrement: button(decrementLabel, atMin),
    increment: button(incrementLabel, atMax),
    hidden:
      name === undefined
        ? null
        : { type: "hidden", name, value: value === null ? "" : String(value) },
    stepBy: (direction) => stepBy(direction),
    repeat: { ...NUMBER_FIELD_REPEAT },
  };
}
