/**
 * Headless DATE PICKER behavior — a text input that parses a locale-formatted
 * date, beside a button opening the WAI-ARIA APG Date Picker Dialog.
 *
 * Pure function, no framework hooks and no timers. The calendar itself — the
 * grid, its keyboard model and its date arithmetic — is `getCalendarGridProps`
 * in calendar-grid.ts, shared with the date range picker. What is here is the
 * part only a single-date field has: the typed text, when it is parsed, and
 * how the calendar button and the dialog are named.
 *
 * THE VALUE IS AN ISO CALENDAR DATE, never a `Date`: "2026-11-01" has no time
 * and no zone, so it cannot move by a day between a browser and a server.
 *
 * TYPING IS THE PRIMARY PATH. Text is parsed on blur and on Enter, never per
 * keystroke — "03/1" is not a date yet — in the page locale's numeric order,
 * the same order the placeholder shows.
 */
import { formatLongDate, formatNumericDate, parseDateText } from "./calendar-grid.js";

export {
  getCalendarGridProps,
  addDays,
  addMonths,
  addYears,
  dayOfWeek,
  daysInMonth,
  endOfWeek,
  formatDayNumber,
  formatLongDate,
  formatMonthYear,
  formatNumericDate,
  isISODate,
  isUnavailable,
  localeFirstDayOfWeek,
  monthOf,
  monthWeeks,
  numericDateFormat,
  numericDatePlaceholder,
  parseDateText,
  parseISODate,
  startOfWeek,
  toISODate,
  todayISO,
  weekdayNames,
} from "./calendar-grid.js";
export type {
  AvailabilityOptions,
  CalendarCellProps,
  CalendarDayProps,
  CalendarGridOptions,
  CalendarGridProps,
  CalendarKeyEvent,
} from "./calendar-grid.js";

/** The part of a keyboard event this reads. */
export interface DatePickerKeyEvent {
  key: string;
  preventDefault(): void;
}

/**
 * Why the calendar is closing.
 *
 *   choose    a day was chosen
 *   escape    Escape — nothing changes
 *   dismiss   a press on the backdrop, or the platform closed it
 */
export type DatePickerCloseReason = "choose" | "escape" | "dismiss";

export interface DatePickerOptions {
  /** The text input's id. Field binds the label to it, so the caller owns it. */
  id: string;
  /** The label element's id, which also names the calendar dialog. */
  labelId: string;
  /** The visible month's title, which describes the dialog. */
  monthId: string;
  locale: string;
  value?: string | null;
  /** The text in the box. */
  text?: string;
  open?: boolean;
  disabled?: boolean;
  /** Accessible name for the calendar button, before the chosen date is appended. */
  calendarLabel?: string;
  onOpenChange?: (open: boolean, reason?: DatePickerCloseReason) => void;
  onTextChange?: (text: string) => void;
  onValueChange?: (value: string | null) => void;
}

export interface DatePickerProps {
  input: {
    value: string;
    autoComplete: "off";
    onChange: (event: { target: { value: string } }) => void;
    onKeyDown: (event: DatePickerKeyEvent) => void;
  };
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
    /** Paging months is announced, since the grid's name does not change. */
    "aria-live": "polite";
  };
  /**
   * Parse the text and commit it — the wrapper calls this on blur. Exposed
   * rather than wired to `onBlur` because the wrapper also needs to know
   * whether focus went to the calendar button first.
   */
  commitText: () => void;
  /** A day was chosen in the calendar. Commits it, reformats the text and closes. */
  choose: (date: string) => void;
}

/**
 * What typed text resolves to.
 *
 *   empty          the value is cleared
 *   a real date    the value, written back in the locale's format
 *   anything else  the text reverts to the current value's — a field that
 *                  kept unparseable text over an older value would submit
 *                  the old date under text the reader overwrote
 *
 * A date outside `min`/`max` or refused by `isDateUnavailable` is NOT
 * rejected here: typed entry can reach any date, and the contract reports it
 * through `status` and `message`, which the caller sets.
 */
export function resolveDateText(
  text: string,
  value: string | null,
  locale: string
): { value: string | null; text: string } {
  const parsed = parseDateText(text, locale);
  if (parsed === null) return { value: null, text: "" };
  if (parsed === "invalid") return { value, text: value === null ? "" : formatNumericDate(value, locale) };
  return { value: parsed, text: formatNumericDate(parsed, locale) };
}

export function getDatePickerProps(options: DatePickerOptions): DatePickerProps {
  const {
    labelId,
    monthId,
    locale,
    value = null,
    text = "",
    open = false,
    disabled = false,
    calendarLabel = "Choose date",
    onOpenChange,
    onTextChange,
    onValueChange,
  } = options;

  /** Returns whether the value changed. */
  function commitText(): boolean {
    const resolved = resolveDateText(text, value, locale);
    if (resolved.text !== text) onTextChange?.(resolved.text);
    if (resolved.value !== value) {
      onValueChange?.(resolved.value);
      return true;
    }
    return false;
  }

  return {
    input: {
      value: text,
      autoComplete: "off",
      onChange: (event) => {
        if (disabled) return;
        onTextChange?.(event.target.value);
      },
      onKeyDown: (event) => {
        if (disabled || event.key !== "Enter") return;
        // Prevented only when it changed the value: otherwise the form
        // around the field would submit the date from before this Enter.
        if (commitText()) event.preventDefault();
      },
    },

    trigger: {
      type: "button",
      // The APG Date Picker Dialog's convention: once there is a date, the
      // button says what it will change.
      "aria-label": value === null ? calendarLabel : `${calendarLabel}, ${formatLongDate(value, locale)}`,
      "aria-disabled": disabled || undefined,
      onClick: (event) => {
        // The click guard: focusable and announced, and refuses to open.
        if (disabled) {
          event.preventDefault();
          return;
        }
        onOpenChange?.(!open);
      },
    },

    dialog: { "aria-labelledby": labelId, "aria-describedby": monthId },
    monthTitle: { id: monthId, "aria-live": "polite" },

    commitText: () => {
      if (!disabled) commitText();
    },

    choose: (date) => {
      onTextChange?.(formatNumericDate(date, locale));
      if (date !== value) onValueChange?.(date);
      onOpenChange?.(false, "choose");
    },
  };
}
