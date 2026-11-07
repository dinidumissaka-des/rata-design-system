import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  formatDayNumber,
  formatNumericDate,
  getCalendarGridProps,
  getDatePickerProps,
  isISODate,
  localeFirstDayOfWeek,
  numericDatePlaceholder,
  todayISO,
} from "@rata/primitives";
import type { FieldStatus } from "@rata/primitives";
import { Icon, Calendar, ChevronLeft, ChevronRight } from "@rata/icons";
import { Field } from "./field.js";
import { useModalDialog } from "./modal-dialog.js";
import { cx } from "./cx.js";

export type DatePickerSize = "sm" | "md" | "lg";

export interface DatePickerProps {
  /** What the date is. Always required — `labelHidden` hides it, nothing removes it. */
  label: ReactNode;
  /** Controls the chosen date from outside, as an ISO calendar date. `null` is empty. */
  value?: string | null;
  /** The starting date when the component owns the state. */
  defaultValue?: string | null;
  /** Fires with the ISO date when a day is chosen, or typed text parses on blur or Enter. */
  onValueChange?: (value: string | null) => void;
  /** The earliest choosable date, as ISO. */
  min?: string;
  /** The latest choosable date, as ISO. */
  max?: string;
  /** Marks individual dates unchoosable. Runs for every visible day; precompute a set. */
  isDateUnavailable?: (date: string) => boolean;
  /** Which weekday starts each row, 0 being Sunday. Defaults to the page locale's. */
  firstDayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Accessible name for the calendar button. The chosen date is appended to it. */
  calendarLabel?: string;
  /** Shown while empty. Defaults to the expected format for the page locale. */
  placeholder?: string;
  /** Form field name. Submits the ISO date, not the displayed text. */
  name?: string;
  /** Control height and inline padding. Text size does not change with it. */
  size?: DatePickerSize;
  /** Takes the label off screen while leaving it in the accessibility tree. */
  labelHidden?: boolean;
  /** Stable id for the date field. Defaults to a generated one. */
  id?: string;
  /** Validation lifecycle. Drives `aria-invalid`, `aria-busy`, and the ring. */
  status?: FieldStatus;
  /** Persistent helper text under the control. */
  description?: ReactNode;
  /** Status-dependent message under the control. */
  message?: ReactNode;
  /** Marks the field required to assistive technology and in the label. */
  required?: boolean;
  /** Blocks typing and opening the calendar while keeping the field focusable and announced. */
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
 * A labelled field for one calendar date: typed in the page's locale, or
 * chosen from the WAI-ARIA APG Date Picker Dialog.
 *
 * TYPING FIRST. The input parses the locale's numeric format on blur and
 * Enter; the placeholder is generated from the same format, so the hint and
 * the parser cannot disagree. Text that is not a date reverts.
 *
 * THE CALENDAR IS A NATIVE MODAL `<dialog>`, through the same
 * `useModalDialog` Dialog and Sheet use, so the focus trap, the inert page,
 * the scrim and Escape come from the platform. Inside it, a `role="grid"`
 * with one roving tab stop: arrows move a day, Up and Down a week, Home and
 * End to the row's ends, PageUp/PageDown a month, with Shift a year. Enter
 * or Space chooses and closes; Escape closes. Focus returns to the calendar
 * button either way. The grid is `getCalendarGridProps`, shared with the
 * date range picker.
 *
 * The value is an ISO calendar date string, never a `Date`.
 */
export function DatePicker({
  label,
  value,
  defaultValue = null,
  onValueChange,
  min,
  max,
  isDateUnavailable,
  firstDayOfWeek,
  calendarLabel = "Choose date",
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
}: DatePickerProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const labelId = `${fieldId}-label`;
  const monthId = `${fieldId}-month`;

  // Sanitised: React's `:r0:` is not a valid CSS ident.
  const anchorName = `--rata-date-picker-${generated.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const anchorStyle = { "--rata-date-picker-anchor": anchorName } as CSSProperties;

  const locale = useMemo(pageLocale, []);
  const weekStart = firstDayOfWeek ?? localeFirstDayOfWeek(locale);

  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState<string | null>(defaultValue);
  const currentValue = isControlled ? value : uncontrolledValue;

  const [text, setText] = useState(() => formatValue(currentValue, locale));
  const [open, setOpen] = useState(false);
  const [focusedDate, setFocusedDate] = useState(() => todayISO());

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const focusedDayRef = useRef<HTMLButtonElement | null>(null);
  const returnFocus = useRef(false);

  // A value set from outside shows in the box.
  const shownValue = useRef(currentValue);
  useEffect(() => {
    if (shownValue.current === currentValue) return;
    shownValue.current = currentValue;
    setText(formatValue(currentValue, locale));
  }, [currentValue, locale]);

  function commitValue(next: string | null) {
    shownValue.current = next;
    if (!isControlled) setUncontrolledValue(next);
    onValueChange?.(next);
  }

  function setCalendarOpen(next: boolean) {
    if (next) {
      // Starts on the chosen date, or today — APG's rule.
      setFocusedDate(currentValue !== null && isISODate(currentValue) ? currentValue : todayISO());
    }
    if (!next && open) returnFocus.current = true;
    setOpen(next);
  }

  const picker = getDatePickerProps({
    id: fieldId,
    labelId,
    monthId,
    locale,
    value: currentValue,
    text,
    open,
    disabled,
    calendarLabel,
    onOpenChange: setCalendarOpen,
    onTextChange: setText,
    onValueChange: commitValue,
  });

  const { ref: dialogRef, handlers } = useModalDialog({
    open,
    onClose: () => setCalendarOpen(false),
    dismissible: true,
    initialFocus: focusedDayRef,
  });

  // Focus goes back to the calendar button however it closed — a choice,
  // Escape, the backdrop. Declared after useModalDialog so it runs after
  // close(): while the dialog is still modal the button is inert behind it,
  // and focusing it would silently do nothing.
  useEffect(() => {
    if (open || !returnFocus.current) return;
    returnFocus.current = false;
    triggerRef.current?.focus();
  }, [open]);

  // The roving tab stop follows the keyboard: a new focused date is a new
  // button, which has to be given DOM focus. Not on open — showModal and
  // initialFocus do that — and only while focus is already in the grid, so
  // the month buttons keep focus when they page.
  const gridRef = useRef<HTMLTableElement | null>(null);
  const focusFollows = useRef(false);
  useEffect(() => {
    if (!open || !focusFollows.current) return;
    focusFollows.current = false;
    focusedDayRef.current?.focus();
  }, [focusedDate, open]);

  const grid = getCalendarGridProps({
    focusedDate,
    firstDayOfWeek: weekStart,
    locale,
    min,
    max,
    isDateUnavailable,
    isSelected: (date) => date === currentValue,
    direction:
      typeof document !== "undefined" && gridRef.current
        ? (getComputedStyle(gridRef.current).direction as "ltr" | "rtl") || "ltr"
        : "ltr",
    onFocusDate: (date) => {
      focusFollows.current = gridRef.current?.contains(document.activeElement) ?? false;
      setFocusedDate(date);
    },
    onChoose: (date) => picker.choose(date),
  });

  return (
    <Field
      className={cx("rata-date-picker", className)}
      label={label}
      labelHidden={labelHidden}
      id={fieldId}
      status={status}
      description={description}
      message={message}
      required={required}
      disabled={disabled}
    >
      {(control) => (
        <>
          <span className="rata-date-picker-well" style={anchorStyle}>
            <input
              type="text"
              {...control}
              {...picker.input}
              placeholder={placeholder ?? numericDatePlaceholder(locale)}
              onBlur={() => picker.commitText()}
              className={cx("rata-date-picker-input", `rata-date-picker-input--${size}`)}
            />
            <button
              ref={triggerRef}
              {...picker.trigger}
              className="rata-date-picker-trigger rata-state-layer rata-state-layer--flush"
            >
              <Icon icon={Calendar} aria-hidden="true" />
            </button>
          </span>

          {name !== undefined && <input type="hidden" name={name} value={currentValue ?? ""} />}

          <dialog
            ref={dialogRef}
            {...handlers}
            {...picker.dialog}
            className="rata-date-picker-calendar"
            style={anchorStyle}
          >
            {/* Rendered only while open: isDateUnavailable runs for every
                visible day, and a closed calendar has none. */}
            {open && (
              <>
                <div className="rata-date-picker-header">
                  <button
                    type="button"
                    className="rata-date-picker-nav rata-state-layer rata-state-layer--flush"
                    aria-label={PREVIOUS_MONTH}
                    onClick={grid.previousMonth}
                  >
                    <Icon icon={ChevronLeft} aria-hidden="true" />
                  </button>
                  {/* A heading: everything behind a modal is inert, so the
                      outline inside it starts fresh, as in Dialog. */}
                  <h2 {...picker.monthTitle} className="rata-date-picker-month">
                    {grid.monthLabel}
                  </h2>
                  <button
                    type="button"
                    className="rata-date-picker-nav rata-state-layer rata-state-layer--flush"
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
                  className="rata-date-picker-grid"
                >
                  <thead>
                    <tr>
                      {grid.weekdays.map((weekday) => (
                        <th key={weekday.long} scope="col" abbr={weekday.long} className="rata-date-picker-weekday">
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
                            <td key={date} {...grid.cell(date)} className="rata-date-picker-cell">
                              <button
                                {...day}
                                ref={day.tabIndex === 0 ? focusedDayRef : undefined}
                                className="rata-date-picker-day rata-state-layer rata-state-layer--flush"
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
              </>
            )}
          </dialog>
        </>
      )}
    </Field>
  );
}
