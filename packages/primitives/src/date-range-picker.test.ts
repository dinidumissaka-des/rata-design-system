import { describe, expect, test, vi } from "vitest";
import { getCalendarGridProps, formatDateRange } from "./calendar-grid.js";
import {
  chooseRangeDate,
  getDateRangePickerProps,
  nextRangeEnd,
  nextUnavailableAfter,
} from "./date-range-picker.js";
import type { DateRangePickerOptions } from "./date-range-picker.js";

const props = (o: Partial<DateRangePickerOptions> = {}) =>
  getDateRangePickerProps({ labelId: "lbl", monthId: "month", hintId: "hint", locale: "en-GB", ...o });

const key = (k: string) => ({ key: k, preventDefault: vi.fn() });

describe("which end the next choice sets", () => {
  test("the empty end, or the start when both are empty or both are set", () => {
    expect(nextRangeEnd({ start: null, end: null })).toBe("start");
    expect(nextRangeEnd({ start: "2026-11-01", end: null })).toBe("end");
    expect(nextRangeEnd({ start: null, end: "2026-11-07" })).toBe("start");
    expect(nextRangeEnd({ start: "2026-11-01", end: "2026-11-07" })).toBe("start");
  });

  test("first the start, then the end, which completes the range", () => {
    const first = chooseRangeDate({ start: null, end: null }, "2026-11-03");
    expect(first).toEqual({ value: { start: "2026-11-03", end: null }, complete: false });
    expect(chooseRangeDate(first.value, "2026-11-09")).toEqual({
      value: { start: "2026-11-03", end: "2026-11-09" },
      complete: true,
    });
  });

  test("a one-day range is valid", () => {
    expect(chooseRangeDate({ start: "2026-11-03", end: null }, "2026-11-03")).toEqual({
      value: { start: "2026-11-03", end: "2026-11-03" },
      complete: true,
    });
  });

  test("a day before the start becomes the new start, never an end", () => {
    expect(chooseRangeDate({ start: "2026-11-10", end: null }, "2026-11-04")).toEqual({
      value: { start: "2026-11-04", end: null },
      complete: false,
    });
  });

  test("a choice over a whole range starts a new one and clears the end", () => {
    expect(chooseRangeDate({ start: "2026-11-01", end: "2026-11-07" }, "2026-11-20")).toEqual({
      value: { start: "2026-11-20", end: null },
      complete: false,
    });
  });

  test("with only an end, a start on or before it completes the range", () => {
    expect(chooseRangeDate({ start: null, end: "2026-11-07" }, "2026-11-02")).toEqual({
      value: { start: "2026-11-02", end: "2026-11-07" },
      complete: true,
    });
    expect(chooseRangeDate({ start: null, end: "2026-11-07" }, "2026-11-12")).toEqual({
      value: { start: "2026-11-12", end: null },
      complete: false,
    });
  });
});

describe("the unavailable-span rule", () => {
  const booked = new Set(["2026-11-05"]);
  const isDateUnavailable = (d: string) => booked.has(d);

  test("nextUnavailableAfter finds the wall within the limit", () => {
    expect(nextUnavailableAfter("2026-11-01", "2026-11-30", { isDateUnavailable })).toBe("2026-11-05");
    expect(nextUnavailableAfter("2026-11-01", "2026-11-04", { isDateUnavailable })).toBeNull();
    expect(nextUnavailableAfter("2026-11-01", "2026-11-30", { max: "2026-11-20" })).toBe("2026-11-21");
  });

  test("once a start is chosen, no end past the next unavailable day", () => {
    const p = props({ value: { start: "2026-11-02", end: null }, isDateUnavailable });
    expect(p.grid.isDateUnavailable("2026-11-04")).toBe(false);
    expect(p.grid.isDateUnavailable("2026-11-05")).toBe(true);
    expect(p.grid.isDateUnavailable("2026-11-06")).toBe(true);
    expect(p.grid.isDateUnavailable("2026-11-30")).toBe(true);
    // Before the start is still choosable — it would be a new start.
    expect(p.grid.isDateUnavailable("2026-10-30")).toBe(false);
  });

  test("the rule only applies while the end is being chosen", () => {
    const p = props({ value: { start: "2026-11-02", end: "2026-11-03" }, isDateUnavailable });
    expect(p.grid.isDateUnavailable("2026-11-06")).toBe(false);
  });

  test("the grid announces and refuses a day past the wall", () => {
    const onChoose = vi.fn();
    const p = props({ value: { start: "2026-11-02", end: null }, isDateUnavailable });
    const grid = getCalendarGridProps({
      focusedDate: "2026-11-02",
      firstDayOfWeek: 1,
      locale: "en-GB",
      today: "2026-11-01",
      ...p.grid,
      onChoose,
    });
    const day = grid.day("2026-11-08");
    expect(day["aria-disabled"]).toBe(true);
    expect(day["aria-label"]).toBe("8 November 2026, unavailable");
    day.onClick({ preventDefault: vi.fn() });
    expect(onChoose).not.toHaveBeenCalled();
  });

  test("choose refuses a day past the wall too", () => {
    const onValueChange = vi.fn();
    props({ value: { start: "2026-11-02", end: null }, isDateUnavailable, onValueChange }).choose("2026-11-08");
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("range positions", () => {
  const p = props({ value: { start: "2026-11-02", end: "2026-11-05" } });

  test("the ends are selected; the days between are named, not selected", () => {
    expect(p.grid.isSelected("2026-11-02")).toBe(true);
    expect(p.grid.isSelected("2026-11-05")).toBe(true);
    expect(p.grid.isSelected("2026-11-03")).toBe(false);
    expect(p.grid.describeDate("2026-11-02")).toBe("start date");
    expect(p.grid.describeDate("2026-11-03")).toBe("in range");
    expect(p.grid.describeDate("2026-11-05")).toBe("end date");
    expect(p.grid.describeDate("2026-11-06")).toBeUndefined();
  });

  test("the words reach the day's accessible name through the grid", () => {
    const grid = getCalendarGridProps({
      focusedDate: "2026-11-02",
      firstDayOfWeek: 1,
      locale: "en-GB",
      today: "2026-11-01",
      ...p.grid,
    });
    expect(grid.day("2026-11-03")["aria-label"]).toBe("3 November 2026, in range");
    expect(grid.cell("2026-11-02")["aria-selected"]).toBe(true);
    expect(grid.cell("2026-11-03")["aria-selected"]).toBe(false);
  });

  test("a one-day range is both ends", () => {
    expect(props({ value: { start: "2026-11-02", end: "2026-11-02" } }).grid.describeDate("2026-11-02")).toBe(
      "start date, end date"
    );
  });

  test("cells carry the range states", () => {
    expect(p.cell("2026-11-02")).toMatchObject({ "data-range-start": "", "data-in-range": undefined });
    expect(p.cell("2026-11-04")).toMatchObject({ "data-in-range": "" });
    expect(p.cell("2026-11-05")).toMatchObject({ "data-range-end": "", "data-range-joined": "" });
    // A one-day range has no band to run into its ends.
    const one = props({ value: { start: "2026-11-02", end: "2026-11-02" } });
    expect(one.cell("2026-11-02")["data-range-joined"]).toBeUndefined();
  });

  test("the preview runs from the start to the pointed-at day, while the end is chosen", () => {
    const half = props({ value: { start: "2026-11-02", end: null }, previewDate: "2026-11-04" });
    expect(half.cell("2026-11-02")["data-preview"]).toBeUndefined();
    expect(half.cell("2026-11-03")["data-preview"]).toBe("");
    expect(half.cell("2026-11-04")["data-preview"]).toBe("");
    expect(half.cell("2026-11-05")["data-preview"]).toBeUndefined();
    // Before the start: that day would be a new start, so there is nothing to preview.
    const before = props({ value: { start: "2026-11-02", end: null }, previewDate: "2026-11-01" });
    expect(before.cell("2026-11-01")["data-preview"]).toBeUndefined();
    // Not while the start is being chosen.
    expect(p.cell("2026-11-03")["data-preview"]).toBeUndefined();
  });
});

describe("getDateRangePickerProps", () => {
  test("typing changes only that end's text", () => {
    const onStartTextChange = vi.fn();
    const onValueChange = vi.fn();
    props({ onStartTextChange, onValueChange }).startInput.onChange({ target: { value: "03/1" } });
    expect(onStartTextChange).toHaveBeenCalledWith("03/1");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("Enter and blur commit one end, passing both values through", () => {
    const onValueChange = vi.fn();
    const enter = key("Enter");
    props({ value: { start: "2026-11-01", end: null }, endText: "7/11/2026", onValueChange }).endInput.onKeyDown(
      enter
    );
    expect(onValueChange).toHaveBeenCalledWith({ start: "2026-11-01", end: "2026-11-07" });
    expect(enter.preventDefault).toHaveBeenCalled();

    onValueChange.mockClear();
    props({ value: { start: null, end: "2026-11-07" }, startText: "2026-11-01", onValueChange }).commitStart();
    expect(onValueChange).toHaveBeenCalledWith({ start: "2026-11-01", end: "2026-11-07" });
  });

  test("an end typed before the start is passed through, never swapped", () => {
    const onValueChange = vi.fn();
    props({ value: { start: "2026-11-10", end: null }, endText: "01/11/2026", onValueChange }).commitEnd();
    expect(onValueChange).toHaveBeenCalledWith({ start: "2026-11-10", end: "2026-11-01" });
  });

  test("junk reverts to that end's value", () => {
    const onEndTextChange = vi.fn();
    const onValueChange = vi.fn();
    props({ value: { start: null, end: "2026-11-07" }, endText: "soon", onEndTextChange, onValueChange }).commitEnd();
    expect(onEndTextChange).toHaveBeenCalledWith("07/11/2026");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("the calendar button names the range it will change", () => {
    expect(props().trigger["aria-label"]).toBe("Choose dates");
    expect(props({ value: { start: "2026-11-01", end: "2026-11-07" } }).trigger["aria-label"]).toBe(
      "Choose dates, 1 to 7 November 2026"
    );
  });

  test("the button toggles the calendar, and its click guard refuses while disabled", () => {
    const onOpenChange = vi.fn();
    props({ onOpenChange }).trigger.onClick({ preventDefault: vi.fn() });
    expect(onOpenChange).toHaveBeenCalledWith(true);

    onOpenChange.mockClear();
    const click = { preventDefault: vi.fn() };
    const disabled = props({ disabled: true, onOpenChange });
    disabled.trigger.onClick(click);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(click.preventDefault).toHaveBeenCalled();
    expect(disabled.trigger["aria-disabled"]).toBe(true);
  });

  test("the dialog is labelled by the field and described by the month and the hint", () => {
    const p = props();
    expect(p.dialog).toEqual({ "aria-labelledby": "lbl", "aria-describedby": "month hint" });
    expect(p.hint).toEqual({ id: "hint", "aria-live": "polite", children: "Choose start date" });
    expect(props({ value: { start: "2026-11-01", end: null } }).hint.children).toBe("Choose end date");
  });

  test("focus starts on the start, else the end, else today", () => {
    expect(props().initialFocusDate("2026-11-07")).toBe("2026-11-07");
    expect(props({ value: { start: null, end: "2026-11-20" } }).initialFocusDate("2026-11-07")).toBe("2026-11-20");
    expect(props({ value: { start: "2026-11-02", end: null } }).initialFocusDate("2026-11-07")).toBe("2026-11-02");
  });

  test("choosing the start keeps the calendar open; choosing the end closes it", () => {
    const onValueChange = vi.fn();
    const onStartTextChange = vi.fn();
    const onEndTextChange = vi.fn();
    const onOpenChange = vi.fn();
    const handlers = { onValueChange, onStartTextChange, onEndTextChange, onOpenChange };

    props({ open: true, ...handlers }).choose("2026-11-03");
    expect(onValueChange).toHaveBeenLastCalledWith({ start: "2026-11-03", end: null });
    expect(onStartTextChange).toHaveBeenLastCalledWith("03/11/2026");
    expect(onOpenChange).not.toHaveBeenCalled();

    props({ open: true, value: { start: "2026-11-03", end: null }, ...handlers }).choose("2026-11-09");
    expect(onValueChange).toHaveBeenLastCalledWith({ start: "2026-11-03", end: "2026-11-09" });
    expect(onEndTextChange).toHaveBeenLastCalledWith("09/11/2026");
    expect(onOpenChange).toHaveBeenCalledWith(false, "choose");
  });

  test("disabled: typing, committing and choosing do nothing", () => {
    const onStartTextChange = vi.fn();
    const onValueChange = vi.fn();
    const p = props({ disabled: true, startText: "1/11/2026", onStartTextChange, onValueChange });
    p.startInput.onChange({ target: { value: "x" } });
    p.startInput.onKeyDown(key("Enter"));
    p.commitStart();
    p.choose("2026-11-01");
    expect(onStartTextChange).not.toHaveBeenCalled();
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("formatDateRange", () => {
  test("the locale's range, with the separator spoken as 'to'", () => {
    expect(formatDateRange("2026-11-01", "2026-11-07", "en-GB")).toBe("1 to 7 November 2026");
    expect(formatDateRange("2026-11-01", "2026-11-07", "en-US")).toBe("November 1 to 7, 2026");
    expect(formatDateRange("2026-11-28", "2026-12-03", "en-GB")).toBe("28 November to 3 December 2026");
    expect(formatDateRange("2026-11-01", "2026-11-01", "en-GB")).toBe("1 November 2026");
  });
});
