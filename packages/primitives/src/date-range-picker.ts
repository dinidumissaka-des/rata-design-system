/**
 * Headless DATE RANGE PICKER behavior — two text inputs, a start and an end,
 * beside one button opening the same modal calendar dialog DatePicker uses.
 *
 * Pure function, no framework hooks and no timers. The grid itself — date
 * arithmetic, the keyboard model, locale handling, `aria-disabled` days — is
 * `getCalendarGridProps` in calendar-grid.ts, shared with DatePicker; typed
 * text resolves through DatePicker's own `resolveDateText`. What is here is
 * what only a range has (the contract's primitive decision):
 *
 *   - which end the next choice in the calendar sets
 *   - the preview span from the chosen start to the focused or hovered day
 *   - the unavailable-span rule: no end past the next unavailable day
 *   - the range-position words in each day's accessible name
 *
 * THE VALUE IS `{ start, end }`, each an ISO calendar date or `null`. Either
 * end can be empty on its own, and typed ends are passed through as typed —
 * never reordered — so a range that runs backwards reaches the caller's
 * validation exactly as the reader entered it.
 */
import { addDays, formatDateRange, formatNumericDate, isISODate, isUnavailable } from "./calendar-grid.js";
import type { AvailabilityOptions } from "./calendar-grid.js";
import { resolveDateText } from "./date-picker.js";

export { formatDateRange } from "./calendar-grid.js";

export interface DateRange {
  start: string | null;
  end: string | null;
}

/** Which end the next choice in the calendar sets. */
export type DateRangeEnd = "start" | "end";

/** The part of a keyboard event this reads. */
export interface DateRangePickerKeyEvent {
  key: string;
  preventDefault(): void;
}

/**
 * Why the calendar is closing — DatePicker's reasons.
 *
 *   choose    the range was completed in the calendar
 *   escape    Escape — nothing more changes
 *   dismiss   a press on the backdrop, or the platform closed it
 */
export type DateRangePickerCloseReason = "choose" | "escape" | "dismiss";

export interface DateRangePickerOptions extends AvailabilityOptions {
  /** The label element's id: names the group and the calendar dialog. */
  labelId: string;
  /** The visible month's title, which describes the dialog. */
  monthId: string;
  /** The live hint saying which end the next choice sets. */
  hintId: string;
  locale: string;
  value?: DateRange;
  /** The text in each box. */
  startText?: string;
  endText?: string;
  open?: boolean;
  disabled?: boolean;
  /** Accessible name for the calendar button, before the chosen range is appended. */
  calendarLabel?: string;
  /**
   * The day the reader is pointing at in the grid — hovered, else focused.
   * While the end is being chosen, the preview runs from the start to it.
   */
  previewDate?: string | null;
  onOpenChange?: (open: boolean, reason?: DateRangePickerCloseReason) => void;
  onStartTextChange?: (text: string) => void;
  onEndTextChange?: (text: string) => void;
  onValueChange?: (value: DateRange) => void;
}

export interface DateRangeInputProps {
  value: string;
  autoComplete: "off";
  onChange: (event: { target: { value: string } }) => void;
  onKeyDown: (event: DateRangePickerKeyEvent) => void;
}

/** What a day cell adds to the grid's own `role` and `aria-selected`. */
export interface DateRangeCellProps {
  "data-range-start": "" | undefined;
  "data-range-end": "" | undefined;
  "data-in-range": "" | undefined;
  /** On an end whose range is longer than a day: the band runs into it. */
  "data-range-joined": "" | undefined;
  "data-preview": "" | undefined;
}

export interface DateRangePickerProps {
  startInput: DateRangeInputProps;
  endInput: DateRangeInputProps;
  trigger: {
    type: "button";
    "aria-label": string;
    "aria-disabled": true | undefined;
    onClick: (event: { preventDefault(): void }) => void;
  };
  dialog: {
    "aria-labelledby": string;
    "aria-describedby": string;
  };
  monthTitle: {
    id: string;
    "aria-live": "polite";
  };
  /** "Choose start date" / "Choose end date", announced as it changes. */
  hint: {
    id: string;
    "aria-live": "polite";
    children: string;
  };
  /** Which end the next choice in the calendar sets. */
  choosing: DateRangeEnd;
  /** Where the roving tab stop starts when the calendar opens. */
  initialFocusDate: (today: string) => string;
  /**
   * Spread into `getCalendarGridProps`: availability with the unavailable-span
   * rule folded in, the ends as the selected days, and the range-position
   * words for each day's name.
   */
  grid: Required<Pick<AvailabilityOptions, "isDateUnavailable">> &
    Pick<AvailabilityOptions, "min" | "max"> & {
      isSelected: (date: string) => boolean;
      describeDate: (date: string) => string | undefined;
    };
  /** The range states a day cell is styled by. */
  cell: (date: string) => DateRangeCellProps;
  /** Parse and commit each box — the wrapper calls these on blur. */
  commitStart: () => void;
  commitEnd: () => void;
  /** A day was chosen in the calendar. */
  choose: (date: string) => void;
}

/**
 * Which end the next calendar choice sets: the empty one, or the start when
 * both are empty or both are set — a choice over a whole range starts a new
 * one.
 */
export function nextRangeEnd(value: DateRange): DateRangeEnd {
  return value.start !== null && value.end === null ? "end" : "start";
}

/**
 * The first unavailable day strictly after `start`, looking no further than
 * `limit`, or `null` when there is none in that span. It is the wall the
 * unavailable-span rule builds: no end can lie past it.
 */
export function nextUnavailableAfter(
  start: string,
  limit: string,
  options: AvailabilityOptions
): string | null {
  for (let day = addDays(start, 1); day <= limit; day = addDays(day, 1)) {
    if (isUnavailable(day, options)) return day;
  }
  return null;
}

/**
 * What choosing `date` in the calendar does to `value`, and whether that
 * completes the range. `null` when the day cannot be chosen.
 *
 *   choosing the start   the day is the start. An end before it is cleared,
 *                        since that would make the range run backwards; an
 *                        end on or after it completes the range.
 *   choosing the end     a day before the start becomes the new start, not
 *                        an end — reordering behind the reader's back would
 *                        put the cursor's meaning in the wrong place. Any
 *                        other day is the end, and completes the range.
 */
export function chooseRangeDate(
  value: DateRange,
  date: string
): { value: DateRange; complete: boolean } {
  if (nextRangeEnd(value) === "end" && value.start !== null) {
    if (date < value.start) return { value: { start: date, end: null }, complete: false };
    return { value: { start: value.start, end: date }, complete: true };
  }
  const end = value.start === null && value.end !== null && value.end >= date ? value.end : null;
  return { value: { start: date, end }, complete: end !== null };
}

/** Words for states the fill shows. English: the contract has no prop to translate them. */
const START_DATE = "start date";
const END_DATE = "end date";
const IN_RANGE = "in range";
const CHOOSE_START = "Choose start date";
const CHOOSE_END = "Choose end date";

export function getDateRangePickerProps(options: DateRangePickerOptions): DateRangePickerProps {
  const {
    labelId,
    monthId,
    hintId,
    locale,
    value = { start: null, end: null },
    startText = "",
    endText = "",
    open = false,
    disabled = false,
    calendarLabel = "Choose dates",
    previewDate = null,
    min,
    max,
    isDateUnavailable,
    onOpenChange,
    onStartTextChange,
    onEndTextChange,
    onValueChange,
  } = options;

  const start = value.start !== null && isISODate(value.start) ? value.start : null;
  const end = value.end !== null && isISODate(value.end) ? value.end : null;
  const choosing = nextRangeEnd({ start, end });
  const base: AvailabilityOptions = { min, max, isDateUnavailable };

  // The unavailable-span rule, scanned lazily and incrementally: the grid
  // asks about ~42 days per render, and each day from the start is checked
  // at most once.
  let wall: string | null = null;
  let scannedTo = start;
  function pastWall(date: string): boolean {
    if (choosing !== "end" || start === null || scannedTo === null || date <= start) return false;
    if (wall === null && scannedTo < date) {
      wall = nextUnavailableAfter(scannedTo, date, base);
      scannedTo = date;
    }
    return wall !== null && date > wall;
  }

  const unavailable = (date: string) => isUnavailable(date, base) || pastWall(date);

  function commit(which: DateRangeEnd, text: string): boolean {
    const current = which === "start" ? value.start : value.end;
    const resolved = resolveDateText(text, current, locale);
    if (resolved.text !== text) (which === "start" ? onStartTextChange : onEndTextChange)?.(resolved.text);
    if (resolved.value === current) return false;
    // Passed through as typed: an end before the start is the caller's to report.
    onValueChange?.(which === "start" ? { ...value, start: resolved.value } : { ...value, end: resolved.value });
    return true;
  }

  function input(which: DateRangeEnd): DateRangeInputProps {
    const text = which === "start" ? startText : endText;
    const onText = which === "start" ? onStartTextChange : onEndTextChange;
    return {
      value: text,
      autoComplete: "off",
      onChange: (event) => {
        if (disabled) return;
        onText?.(event.target.value);
      },
      onKeyDown: (event) => {
        if (disabled || event.key !== "Enter") return;
        // Prevented only when it changed the value, as in DatePicker.
        if (commit(which, text)) event.preventDefault();
      },
    };
  }

  const preview =
    choosing === "end" && start !== null && previewDate !== null && previewDate > start && !unavailable(previewDate)
      ? previewDate
      : null;

  return {
    startInput: input("start"),
    endInput: input("end"),

    trigger: {
      type: "button",
      "aria-label":
        start !== null && end !== null ? `${calendarLabel}, ${formatDateRange(start, end, locale)}` : calendarLabel,
      "aria-disabled": disabled || undefined,
      onClick: (event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onOpenChange?.(!open);
      },
    },

    dialog: { "aria-labelledby": labelId, "aria-describedby": `${monthId} ${hintId}` },
    monthTitle: { id: monthId, "aria-live": "polite" },
    hint: { id: hintId, "aria-live": "polite", children: choosing === "end" ? CHOOSE_END : CHOOSE_START },

    choosing,

    initialFocusDate: (today) => start ?? end ?? today,

    grid: {
      min,
      max,
      // Folded into isDateUnavailable rather than passed beside it, so the
      // grid's one availability path — focusable, aria-disabled, "unavailable"
      // in the name, refused on click — covers the span rule too.
      isDateUnavailable: (date) => (isDateUnavailable?.(date) ?? false) || pastWall(date),
      // The ends were chosen; the days between were not, so they are not
      // aria-selected — six selected days for one choice of two misstates it.
      isSelected: (date) => date === start || date === end,
      describeDate: (date) => {
        const words = [
          date === start ? START_DATE : undefined,
          date === end ? END_DATE : undefined,
          start !== null && end !== null && date > start && date < end ? IN_RANGE : undefined,
        ].filter(Boolean);
        return words.length ? words.join(", ") : undefined;
      },
    },

    cell: (date) => ({
      "data-range-start": date === start ? "" : undefined,
      "data-range-end": date === end ? "" : undefined,
      "data-in-range": start !== null && end !== null && date > start && date < end ? "" : undefined,
      "data-range-joined":
        start !== null && end !== null && end > start && (date === start || date === end) ? "" : undefined,
      "data-preview": preview !== null && date > start! && date <= preview ? "" : undefined,
    }),

    commitStart: () => {
      if (!disabled) commit("start", startText);
    },
    commitEnd: () => {
      if (!disabled) commit("end", endText);
    },

    choose: (date) => {
      if (disabled || unavailable(date)) return;
      const next = chooseRangeDate({ start, end }, date);
      onStartTextChange?.(next.value.start === null ? "" : formatNumericDate(next.value.start, locale));
      onEndTextChange?.(next.value.end === null ? "" : formatNumericDate(next.value.end, locale));
      if (next.value.start !== value.start || next.value.end !== value.end) onValueChange?.(next.value);
      if (next.complete) onOpenChange?.(false, "choose");
    },
  };
}
