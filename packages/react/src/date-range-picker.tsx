import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  formatDayNumber,
  formatNumericDate,
  getCalendarGridProps,
  getDateRangePickerProps,
  isISODate,
  localeFirstDayOfWeek,
  numericDatePlaceholder,
  todayISO,
} from "@rata/primitives";
import type { DateRange, FieldStatus } from "@rata/primitives";
import { Icon, Calendar, ChevronLeft, ChevronRight } from "@rata/icons";
import { Field } from "./field.js";
import { useModalDialog } from "./modal-dialog.js";
import { cx } from "./cx.js";

export type { DateRange };
export type DateRangePickerSize = "sm" | "md" | "lg";

export interface DateRangePickerProps {
  /** What the range is. Always required — `labelHidden` hides it, nothing removes it. */
  label: ReactNode;
  /** The visible label on the start input. */
  startLabel?: string;
  /** The visible label on the end input. */
  endLabel?: string;
  /** Controls the range from outside: `{ start, end }`, each an ISO calendar date or `null`. */
  value?: DateRange;
  /** The starting range when the component owns the state. */
  defaultValue?: DateRange;
  /** Fires with both ends whenever either changes. */
  onValueChange?: (value: DateRange) => void;
  /** The earliest choosable date for either end, as ISO. */
  min?: string;
  /** The latest choosable date for either end, as ISO. */
  max?: string;
  /** Marks individual dates unchoosable. Runs for every visible day; precompute a set. */
  isDateUnavailable?: (date: string) => boolean;
  /** Which weekday starts each row, 0 being Sunday. Defaults to the page locale's. */
  firstDayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Accessible name for the calendar button. The chosen range is appended to it. */
  calendarLabel?: string;
  /** Shown in each empty input. Defaults to the expected format for the page locale. */
  placeholder?: string;
  /** Form field name for the start. Submits the ISO date. */
  startName?: string;
  /** Form field name for the end. Submits the ISO date. */
  endName?: string;
  /** Control height and inline padding. Text size does not change with it. */
  size?: DateRangePickerSize;
  /** Takes the label off screen while leaving it in the accessibility tree. */
  labelHidden?: boolean;
  /** Stable id for the range field. Defaults to a generated one. */
  id?: string;
  /** Validation lifecycle. Drives `aria-invalid`, `aria-busy`, and the ring. */
  status?: FieldStatus;
  /** Persistent helper text under the control. */
  description?: ReactNode;
  /** Status-dependent message under the control. */
  message?: ReactNode;
  /** Marks both ends required to assistive technology and in the label. */
  required?: boolean;
  /** Blocks typing and opening the calendar while keeping both inputs focusable and announced. */
  disabled?: boolean;
  /** Class for the wrapper — the width the form wants, not a restyle. */
  className?: string;
}

/** The page's locale: the document's `lang`, then the browser's, then English. */
function pageLocale(): string {
  const candidates = [
    typeof document !== "undefined" ? document.documentElement.lang : "",
    typeof navigator !== "undefined" ? navigator.language : "",
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return new Intl.Locale(candidate).toString();
    } catch {
      // Not a valid tag; try the next.
    }
  }
  return "en";
}

const formatValue = (value: string | null, locale: string) =>
  value !== null && isISODate(value) ? formatNumericDate(value, locale) : "";

/** Words the contract has no prop to translate. */
const PREVIOUS_MONTH = "Previous month";
const NEXT_MONTH = "Next month";

/**
 * A labelled field for a start and an end date: each typed in the page's
 * locale, or both chosen on one calendar grid.
 *
 * TWO INPUTS IN ONE GROUP. A `role="group"` named by `label` holds a start and
 * an end input, each with its own visible label, so each is announced as
 * "Stay, Check-in". Both parse the locale's numeric format on blur and Enter,
 * as DatePicker's does, and typed ends are passed through as typed — an end
 * before the start is the caller's to report through `status`.
 *
 * ONE CALENDAR, DATEPICKER'S. The button opens the same native modal
 * `<dialog>` through `useModalDialog`, holding the same `getCalendarGridProps`
 * grid with the same keyboard model. The first choice is the start and the
 * second the end, which closes it; while the end is being chosen, a live hint
 * says so and the days from the start to the pointed-at day are previewed.
 * Once a start is chosen, no end past the next unavailable day can be picked.
 *
 * The value is `{ start, end }`, each an ISO calendar date string or `null`.
 */
export function DateRangePicker({
  label,
  startLabel = "Start date",
  endLabel = "End date",
  value,
  defaultValue = { start: null, end: null },
  onValueChange,
  min,
  max,
  isDateUnavailable,
  firstDayOfWeek,
  calendarLabel = "Choose dates",
  placeholder,
  startName,
  endName,
  size = "md",
  labelHidden = false,
  id,
  status = "idle",
  description,
  message,
  required = false,
  disabled = false,
  className,
}: DateRangePickerProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const labelId = `${fieldId}-label`;
  const endId = `${fieldId}-end`;
  const startLabelId = `${fieldId}-start-label`;
  const endLabelId = `${fieldId}-end-label`;
  const monthId = `${fieldId}-month`;
  const hintId = `${fieldId}-hint`;

  // Sanitised: React's `:r0:` is not a valid CSS ident.
  const anchorName = `--rata-date-range-picker-${generated.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const anchorStyle = { "--rata-date-range-picker-anchor": anchorName } as CSSProperties;

  const locale = useMemo(pageLocale, []);
  const weekStart = firstDayOfWeek ?? localeFirstDayOfWeek(locale);

  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState<DateRange>(defaultValue);
  const currentValue = isControlled ? value : uncontrolledValue;

  const [startText, setStartText] = useState(() => formatValue(currentValue.start, locale));
  const [endText, setEndText] = useState(() => formatValue(currentValue.end, locale));
  const [open, setOpen] = useState(false);
  const [focusedDate, setFocusedDate] = useState(() => todayISO());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const focusedDayRef = useRef<HTMLButtonElement | null>(null);
  const returnFocus = useRef(false);

  // A value set from outside shows in the boxes, one end at a time.
  const shownStart = useRef(currentValue.start);
  const shownEnd = useRef(currentValue.end);
  useEffect(() => {
    if (shownStart.current === currentValue.start) return;
    shownStart.current = currentValue.start;
    setStartText(formatValue(currentValue.start, locale));
  }, [currentValue.start, locale]);
  useEffect(() => {
    if (shownEnd.current === currentValue.end) return;
    shownEnd.current = currentValue.end;
    setEndText(formatValue(currentValue.end, locale));
  }, [currentValue.end, locale]);

  function commitValue(next: DateRange) {
    shownStart.current = next.start;
    shownEnd.current = next.end;
    if (!isControlled) setUncontrolledValue(next);
    onValueChange?.(next);
  }

  const picker = getDateRangePickerProps({
    labelId,
    monthId,
    hintId,
    locale,
    value: currentValue,
    startText,
    endText,
    open,
    disabled,
    calendarLabel,
    previewDate: hoveredDate ?? focusedDate,
    min,
    max,
    isDateUnavailable,
    onOpenChange: setCalendarOpen,
    onStartTextChange: setStartText,
    onEndTextChange: setEndText,
    onValueChange: commitValue,
  });

  function setCalendarOpen(next: boolean) {
    if (next) {
      setFocusedDate(picker.initialFocusDate(todayISO()));
      setHoveredDate(null);
    }
    if (!next && open) returnFocus.current = true;
    setOpen(next);
  }

  const { ref: dialogRef, handlers } = useModalDialog({
    open,
    onClose: () => setCalendarOpen(false),
    dismissible: true,
    initialFocus: focusedDayRef,
  });

  // Focus goes back to the calendar button however it closed. Declared after
  // useModalDialog so it runs after close(), as in DatePicker.
  useEffect(() => {
    if (open || !returnFocus.current) return;
    returnFocus.current = false;
    triggerRef.current?.focus();
  }, [open]);

  // The roving tab stop follows the keyboard, and only while focus is already
  // in the grid, so the month buttons keep focus when they page.
  const gridRef = useRef<HTMLTableElement | null>(null);
  const focusFollows = useRef(false);
  useEffect(() => {
    if (!open || !focusFollows.current) return;
    focusFollows.current = false;
    focusedDayRef.current?.focus();
  }, [focusedDate, open]);

  function focusDate(date: string) {
    focusFollows.current = gridRef.current?.contains(document.activeElement) ?? false;
    setFocusedDate(date);
  }

  const grid = getCalendarGridProps({
    focusedDate,
    firstDayOfWeek: weekStart,
    locale,
    ...picker.grid,
    direction:
      typeof document !== "undefined" && gridRef.current
        ? (getComputedStyle(gridRef.current).direction as "ltr" | "rtl") || "ltr"
        : "ltr",
    onFocusDate: (date) => {
      // The keyboard has moved the cursor; the preview follows it, not a
      // pointer left resting somewhere else in the grid.
      setHoveredDate(null);
      focusDate(date);
    },
    onChoose: (date) => {
      // The calendar can stay open after a choice — the start — so the roving
      // stop moves to the chosen day, which a click may not have focused.
      focusDate(date);
      picker.choose(date);
    },
  });

  return (
    <Field
      className={cx("rata-date-range-picker", className)}
      label={label}
      labelHidden={labelHidden}
      id={fieldId}
      status={status}
      description={description}
      message={message}
      required={required}
      disabled={disabled}
    >
      {(control) => {
        // Field's id goes on the start input, so its label and an error
        // summary's link both land there; the ARIA goes on both inputs.
        const { id: _id, ...shared } = control;
        const inputClass = "rata-date-range-picker-input";
        return (
          <>
            <div role="group" aria-labelledby={labelId} className="rata-date-range-picker-group">
              <div className="rata-date-range-picker-ends">
                <label id={startLabelId} htmlFor={fieldId} className="rata-date-range-picker-end-label">
                  {startLabel}
                </label>
                <label id={endLabelId} htmlFor={endId} className="rata-date-range-picker-end-label">
                  {endLabel}
                </label>
              </div>
              <span
                className={cx("rata-date-range-picker-box", `rata-date-range-picker-box--${size}`)}
                style={anchorStyle}
              >
                {/* aria-labelledby names each input by its own label alone:
                    Field's label also points at the start input, and the
                    group already carries that name. */}
                <input
                  type="text"
                  {...shared}
                  id={fieldId}
                  aria-labelledby={startLabelId}
                  {...picker.startInput}
                  placeholder={placeholder ?? numericDatePlaceholder(locale)}
                  onBlur={() => picker.commitStart()}
                  className={inputClass}
                />
                <span aria-hidden="true" className="rata-date-range-picker-separator">
                  –
                </span>
                <input
                  type="text"
                  {...shared}
                  id={endId}
                  aria-labelledby={endLabelId}
                  {...picker.endInput}
                  placeholder={placeholder ?? numericDatePlaceholder(locale)}
                  onBlur={() => picker.commitEnd()}
                  className={inputClass}
                />
                <button
                  ref={triggerRef}
                  {...picker.trigger}
                  className="rata-date-range-picker-trigger rata-state-layer rata-state-layer--flush"
                >
                  <Icon icon={Calendar} aria-hidden="true" />
                </button>
              </span>
            </div>

            {startName !== undefined && <input type="hidden" name={startName} value={currentValue.start ?? ""} />}
            {endName !== undefined && <input type="hidden" name={endName} value={currentValue.end ?? ""} />}

            <dialog
              ref={dialogRef}
              {...handlers}
              {...picker.dialog}
              className="rata-date-range-picker-calendar"
              style={anchorStyle}
            >
              {/* Rendered only while open: isDateUnavailable runs for every
                  visible day, and a closed calendar has none. */}
              {open && (
                <>
                  <div className="rata-date-range-picker-header">
                    <button
                      type="button"
                      className="rata-date-range-picker-nav rata-state-layer rata-state-layer--flush"
                      aria-label={PREVIOUS_MONTH}
                      onClick={grid.previousMonth}
                    >
                      <Icon icon={ChevronLeft} aria-hidden="true" />
                    </button>
                    <h2 {...picker.monthTitle} className="rata-date-range-picker-month">
                      {grid.monthLabel}
                    </h2>
                    <button
                      type="button"
                      className="rata-date-range-picker-nav rata-state-layer rata-state-layer--flush"
                      aria-label={NEXT_MONTH}
                      onClick={grid.nextMonth}
                    >
                      <Icon icon={ChevronRight} aria-hidden="true" />
                    </button>
                  </div>

                  <table
                    ref={gridRef}
                    {...grid.grid}
                    aria-labelledby={monthId}
                    className="rata-date-range-picker-grid"
                    onPointerLeave={() => setHoveredDate(null)}
                  >
                    <thead>
                      <tr>
                        {grid.weekdays.map((weekday) => (
                          <th
                            key={weekday.long}
                            scope="col"
                            abbr={weekday.long}
                            className="rata-date-range-picker-weekday"
                          >
                            {weekday.short}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {grid.weeks.map((week) => (
                        <tr key={week[0]}>
                          {week.map((date) => {
                            const day = grid.day(date);
                            return (
                              <td
                                key={date}
                                {...grid.cell(date)}
                                {...picker.cell(date)}
                                className="rata-date-range-picker-cell"
                              >
                                <button
                                  {...day}
                                  ref={day.tabIndex === 0 ? focusedDayRef : undefined}
                                  onPointerEnter={() => setHoveredDate(date)}
                                  className="rata-date-range-picker-day rata-state-layer rata-state-layer--flush"
                                >
                                  {formatDayNumber(date, locale)}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <p id={picker.hint.id} aria-live={picker.hint["aria-live"]} className="rata-date-range-picker-hint">
                    {picker.hint.children}
                  </p>
                </>
              )}
            </dialog>
          </>
        );
      }}
    </Field>
  );
}
