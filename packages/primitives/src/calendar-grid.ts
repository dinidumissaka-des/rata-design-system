/**
 * Headless CALENDAR GRID behavior — the date arithmetic, keyboard model,
 * unavailable-day handling and locale formatting that a date picker, a date
 * range picker and any future inline calendar share.
 *
 * Split out of the date picker on purpose (its contract's last-but-one
 * decision): the range picker needs exactly this without the text input, and
 * two copies of "what does PageDown on 31 January mean" would drift.
 *
 * ISO CALENDAR DATES ONLY. Every date in and out of this module is a
 * "YYYY-MM-DD" string. Arithmetic runs on UTC midnights, which have no
 * daylight-saving gaps, so adding a day can never land on the same date or
 * skip one — the bug local-time `Date` arithmetic produces twice a year.
 * Locale formatting goes through `Intl.DateTimeFormat` with `timeZone: "UTC"`
 * for the same reason. No date library.
 *
 * Pure functions and one prop-getter, no framework hooks and no timers.
 * Moving DOM focus is the wrapper's: `onFocusDate` reports where it should
 * go, as `getMenuProps`'s `onFocusValue` does.
 */

// ── ISO calendar dates ───────────────────────────────────────────────────

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days in a month, `month` being 1–12. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "2026-11-01" from its parts, or `null` when that day does not exist. */
export function toISODate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || year < 1 || year > 9999) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month)) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The parts of an ISO calendar date, or `null` when it is not one. */
export function parseISODate(iso: string): { year: number; month: number; day: number } | null {
  const match = ISO.exec(iso);
  if (match === null) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return toISODate(year, month, day) === null ? null : { year, month, day };
}

export function isISODate(value: unknown): value is string {
  return typeof value === "string" && parseISODate(value) !== null;
}

function toUTC(iso: string): number {
  const parts = parseISODate(iso);
  if (parts === null) throw new Error(`Not an ISO calendar date: "${iso}"`);
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function fromUTC(time: number): string {
  const date = new Date(time);
  return toISODate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())!;
}

const DAY = 86_400_000;

export function addDays(iso: string, days: number): string {
  return fromUTC(toUTC(iso) + days * DAY);
}

/**
 * The same day `months` later, clamped to the end of a shorter month: one
 * month after 31 January is 28 (or 29) February, not 3 March. Paging back
 * and forth must not drift the reader off the end of the month.
 */
export function addMonths(iso: string, months: number): string {
  const { year, month, day } = parseISODate(iso)!;
  const index = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return toISODate(nextYear, nextMonth, Math.min(day, daysInMonth(nextYear, nextMonth)))!;
}

export function addYears(iso: string, years: number): string {
  return addMonths(iso, years * 12);
}

/** 0 for Sunday through 6 for Saturday. */
export function dayOfWeek(iso: string): number {
  return new Date(toUTC(iso)).getUTCDay();
}

/** The first day of the week `iso` falls in, for a week starting on `firstDayOfWeek`. */
export function startOfWeek(iso: string, firstDayOfWeek: number): string {
  return addDays(iso, -((dayOfWeek(iso) - firstDayOfWeek + 7) % 7));
}

export function endOfWeek(iso: string, firstDayOfWeek: number): string {
  return addDays(startOfWeek(iso, firstDayOfWeek), 6);
}

/** "2026-11" — the month a date belongs to. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * The whole weeks covering `iso`'s month: days from the neighbouring months
 * fill the first and last rows, so every row is seven days and Down always
 * means "same weekday, next week".
 */
export function monthWeeks(iso: string, firstDayOfWeek: number): string[][] {
  const { year, month } = parseISODate(iso)!;
  const first = toISODate(year, month, 1)!;
  const last = toISODate(year, month, daysInMonth(year, month))!;
  const weeks: string[][] = [];
  let cursor = startOfWeek(first, firstDayOfWeek);
  while (cursor <= last) {
    const week: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** Today in the reader's own time zone, which is the "today" they mean. */
export function todayISO(now: Date = new Date()): string {
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate())!;
}

// ── Locale ───────────────────────────────────────────────────────────────

/**
 * The locale's first day of the week, 0 being Sunday, from `Intl.Locale`'s
 * week info — `getWeekInfo()` in current engines, the `weekInfo` accessor in
 * the ones that shipped it first. Monday where the engine exposes neither.
 */
export function localeFirstDayOfWeek(locale: string): number {
  try {
    const intlLocale = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const info = intlLocale.getWeekInfo?.() ?? intlLocale.weekInfo;
    if (info && Number.isInteger(info.firstDay)) return info.firstDay % 7;
  } catch {
    // An unknown tag — fall through to the documented default.
  }
  return 1;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let cached = formatters.get(key);
  if (cached === undefined) {
    cached = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });
    formatters.set(key, cached);
  }
  return cached;
}

/** "1 November 2026" in en-GB, "November 1, 2026" in en-US. */
export function formatLongDate(iso: string, locale: string): string {
  return formatter(locale, { day: "numeric", month: "long", year: "numeric" }).format(toUTC(iso));
}

/** "November 2026" — the visible month's title. */
export function formatMonthYear(iso: string, locale: string): string {
  return formatter(locale, { month: "long", year: "numeric" }).format(toUTC(iso));
}

/** The day of the month as the locale writes its numerals. */
export function formatDayNumber(iso: string, locale: string): string {
  return formatter(locale, { day: "numeric" }).format(toUTC(iso));
}

/** The seven weekday headers in row order: a short form to show, a long one to announce. */
export function weekdayNames(
  locale: string,
  firstDayOfWeek: number
): Array<{ short: string; long: string }> {
  // 2026-11-01 is a Sunday; any known Sunday would do.
  const sunday = "2026-11-01";
  return Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(sunday, (firstDayOfWeek + i) % 7);
    return {
      short: formatter(locale, { weekday: "short" }).format(toUTC(iso)),
      long: formatter(locale, { weekday: "long" }).format(toUTC(iso)),
    };
  });
}

type DatePart = "day" | "month" | "year";

/**
 * The locale's numeric date format, as the order of its three parts and the
 * separator between them: en-GB is day/month/year, en-US month/day/year,
 * ISO-ordered locales year-month-day. Read from `formatToParts`, so the
 * placeholder, the formatter and the parser all come from one place and
 * cannot disagree.
 */
export function numericDateFormat(locale: string): { order: DatePart[]; separator: string } {
  const parts = formatter(locale, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(
    toUTC("2026-11-01")
  );
  const order = parts
    .map((part) => part.type)
    .filter((type): type is DatePart => type === "day" || type === "month" || type === "year");
  const literal = parts.find((part) => part.type === "literal")?.value ?? "/";
  return {
    order: order.length === 3 ? order : ["day", "month", "year"],
    separator: literal.replace(/[‎‏]/g, ""),
  };
}

/** The date in the locale's numeric format, with Latin digits so it can be typed back. */
export function formatNumericDate(iso: string, locale: string): string {
  const { year, month, day } = parseISODate(iso)!;
  const { order, separator } = numericDateFormat(locale);
  const text: Record<DatePart, string> = {
    day: String(day).padStart(2, "0"),
    month: String(month).padStart(2, "0"),
    year: String(year).padStart(4, "0"),
  };
  return order.map((part) => text[part]).join(separator);
}

/** The format as a hint: "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD". */
export function numericDatePlaceholder(locale: string): string {
  const { order, separator } = numericDateFormat(locale);
  const hint: Record<DatePart, string> = { day: "DD", month: "MM", year: "YYYY" };
  return order.map((part) => hint[part]).join(separator);
}

/**
 * Typed text as an ISO date. `null` for an empty box, `"invalid"` for text
 * that is not a real date in the locale's order.
 *
 * Lenient about what separates the numbers — "1/11/2026", "1.11.2026" and
 * "1 11 2026" all parse — and strict about everything else: a four-digit
 * year, a month and day that exist. An ISO date is accepted too, because it
 * is unambiguous in every locale and is what a reader pastes from a system.
 */
export function parseDateText(text: string, locale: string): string | null | "invalid" {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (parseISODate(trimmed) !== null) return trimmed;
  const numbers = trimmed.split(/[^0-9]+/).filter(Boolean);
  if (numbers.length !== 3) return "invalid";
  const { order } = numericDateFormat(locale);
  const value: Partial<Record<DatePart, string>> = {};
  order.forEach((part, i) => {
    value[part] = numbers[i];
  });
  if (value.year?.length !== 4) return "invalid";
  if ((value.month?.length ?? 0) > 2 || (value.day?.length ?? 0) > 2) return "invalid";
  return toISODate(Number(value.year), Number(value.month), Number(value.day)) ?? "invalid";
}

// ── Availability ─────────────────────────────────────────────────────────

export interface AvailabilityOptions {
  min?: string;
  max?: string;
  isDateUnavailable?: (date: string) => boolean;
}

/** Outside `min`/`max`, or refused by `isDateUnavailable`. */
export function isUnavailable(iso: string, options: AvailabilityOptions): boolean {
  const { min, max, isDateUnavailable } = options;
  if (min !== undefined && iso < min) return true;
  if (max !== undefined && iso > max) return true;
  return isDateUnavailable?.(iso) === true;
}

// ── Web: the grid's ARIA and keyboard model ──────────────────────────────

/** The part of a keyboard event this reads. */
export interface CalendarKeyEvent {
  key: string;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  preventDefault(): void;
}

export interface CalendarGridOptions extends AvailabilityOptions {
  /** The day holding the roving tab stop. Its month is the one shown. */
  focusedDate: string;
  /** 0 for Sunday. */
  firstDayOfWeek: number;
  locale: string;
  /** Today, injectable so tests do not depend on the clock. */
  today?: string;
  /** Whether a day is a chosen answer — `aria-selected` on its cell. */
  isSelected?: (date: string) => boolean;
  /**
   * Words appended to a day's accessible name, for what fill and tint show:
   * the range picker's "start date", "in range". Separate from availability,
   * which this module names itself.
   */
  describeDate?: (date: string) => string | undefined;
  /** Text direction. In right-to-left, ArrowLeft is the next day. */
  direction?: "ltr" | "rtl";
  /** The day that should take focus now — the wrapper moves DOM focus to it. */
  onFocusDate?: (date: string) => void;
  /** A day was chosen. Not called for an unavailable day. */
  onChoose?: (date: string) => void;
}

export interface CalendarDayProps {
  type: "button";
  /** Roving tabindex: exactly one day in the grid is a tab stop. */
  tabIndex: 0 | -1;
  "aria-label": string;
  "aria-disabled": true | undefined;
  "aria-current": "date" | undefined;
  "data-outside-month": "" | undefined;
  "data-today": "" | undefined;
  onClick: (event: { preventDefault(): void }) => void;
}

export interface CalendarCellProps {
  role: "gridcell";
  /**
   * On the cell, not the button inside it: ARIA supports `aria-selected` on
   * `gridcell` and not on `button`, and an unsupported attribute may simply
   * be dropped — leaving the chosen day marked by its fill alone.
   */
  "aria-selected": boolean;
}

export interface CalendarGridProps {
  grid: { role: "grid"; onKeyDown: (event: CalendarKeyEvent) => void };
  /** Whole weeks covering the focused date's month. */
  weeks: string[][];
  /** The seven weekday headers, in row order. */
  weekdays: Array<{ short: string; long: string }>;
  /** "November 2026". */
  monthLabel: string;
  day: (date: string) => CalendarDayProps;
  cell: (date: string) => CalendarCellProps;
  /** The month navigation buttons: the same day one month away, focus left where it is. */
  previousMonth: () => void;
  nextMonth: () => void;
}

/** Words for states the fill shows. English: the contract has no prop to translate them. */
const UNAVAILABLE = "unavailable";

export function getCalendarGridProps(options: CalendarGridOptions): CalendarGridProps {
  const {
    focusedDate,
    firstDayOfWeek,
    locale,
    today = todayISO(),
    isSelected = () => false,
    describeDate,
    direction = "ltr",
    onFocusDate,
    onChoose,
  } = options;

  const visibleMonth = monthOf(focusedDate);
  const unavailable = (iso: string) => isUnavailable(iso, options);

  function move(target: string) {
    onFocusDate?.(target);
  }

  const forward = direction === "rtl" ? "ArrowLeft" : "ArrowRight";
  const backward = direction === "rtl" ? "ArrowRight" : "ArrowLeft";

  return {
    grid: {
      role: "grid",
      onKeyDown: (event) => {
        if (event.ctrlKey === true || event.metaKey === true || event.altKey === true) return;
        let target: string | null = null;
        switch (event.key) {
          case forward:
            target = addDays(focusedDate, 1);
            break;
          case backward:
            target = addDays(focusedDate, -1);
            break;
          case "ArrowDown":
            target = addDays(focusedDate, 7);
            break;
          case "ArrowUp":
            target = addDays(focusedDate, -7);
            break;
          case "Home":
            target = startOfWeek(focusedDate, firstDayOfWeek);
            break;
          case "End":
            target = endOfWeek(focusedDate, firstDayOfWeek);
            break;
          case "PageUp":
            target = event.shiftKey === true ? addYears(focusedDate, -1) : addMonths(focusedDate, -1);
            break;
          case "PageDown":
            target = event.shiftKey === true ? addYears(focusedDate, 1) : addMonths(focusedDate, 1);
            break;
          default:
            // Enter and Space are a click on the focused day's button, which
            // is where choosing is handled — handling them here as well would
            // choose twice.
            return;
        }
        // preventDefault, or the arrows and PageUp/PageDown scroll the page
        // behind the dialog.
        event.preventDefault();
        move(target);
      },
    },

    weeks: monthWeeks(focusedDate, firstDayOfWeek),
    weekdays: weekdayNames(locale, firstDayOfWeek),
    monthLabel: formatMonthYear(focusedDate, locale),

    day: (iso) => {
      const isUnavailableDay = unavailable(iso);
      const extra = describeDate?.(iso);
      const name = [formatLongDate(iso, locale), extra, isUnavailableDay ? UNAVAILABLE : undefined]
        .filter(Boolean)
        .join(", ");
      return {
        type: "button",
        tabIndex: iso === focusedDate ? 0 : -1,
        // The full date, since the visible "1" says nothing out of context;
        // and "unavailable" in the name as well as aria-disabled, so the
        // state is not carried by one attribute a reader may not voice.
        "aria-label": name,
        "aria-disabled": isUnavailableDay || undefined,
        "aria-current": iso === today ? "date" : undefined,
        "data-outside-month": monthOf(iso) !== visibleMonth ? "" : undefined,
        "data-today": iso === today ? "" : undefined,
        onClick: (event) => {
          // Focusable and announced, and refused here — the system's
          // aria-disabled rule applied to a day.
          if (isUnavailableDay) {
            event.preventDefault();
            move(iso);
            return;
          }
          onChoose?.(iso);
        },
      };
    },

    cell: (iso) => ({ role: "gridcell", "aria-selected": isSelected(iso) }),

    previousMonth: () => move(addMonths(focusedDate, -1)),
    nextMonth: () => move(addMonths(focusedDate, 1)),
  };
}
