import { describe, expect, test, vi } from "vitest";
import {
  addDays,
  addMonths,
  addYears,
  endOfWeek,
  formatLongDate,
  formatNumericDate,
  getCalendarGridProps,
  isUnavailable,
  localeFirstDayOfWeek,
  monthWeeks,
  numericDatePlaceholder,
  parseDateText,
  parseISODate,
  startOfWeek,
  toISODate,
  weekdayNames,
} from "./calendar-grid.js";

describe("ISO calendar dates", () => {
  test("only real dates exist", () => {
    expect(toISODate(2026, 2, 29)).toBeNull();
    expect(toISODate(2028, 2, 29)).toBe("2028-02-29");
    expect(parseISODate("2026-13-01")).toBeNull();
    expect(parseISODate("2026-11-01")).toEqual({ year: 2026, month: 11, day: 1 });
  });

  test("day arithmetic crosses months and years, never a daylight-saving gap", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    // The last Sunday of March and of October, where local-time arithmetic slips.
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
  });

  test("months clamp to the end of a shorter month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addYears("2028-02-29", 1)).toBe("2029-02-28");
  });

  test("weeks start where they are told to", () => {
    // 2026-11-04 is a Wednesday.
    expect(startOfWeek("2026-11-04", 1)).toBe("2026-11-02");
    expect(startOfWeek("2026-11-04", 0)).toBe("2026-11-01");
    expect(endOfWeek("2026-11-04", 1)).toBe("2026-11-08");
  });

  test("a month is whole weeks, padded from its neighbours", () => {
    const weeks = monthWeeks("2026-11-15", 1);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]![0]).toBe("2026-10-26");
    expect(weeks.at(-1)!.at(-1)).toBe("2026-12-06");
  });
});

describe("locale", () => {
  test("the week start comes from the locale, Monday when unknown", () => {
    expect([0, 1]).toContain(localeFirstDayOfWeek("en-US"));
    expect(localeFirstDayOfWeek("en-GB")).toBe(1);
  });

  test("the format, the placeholder and the parser agree", () => {
    expect(numericDatePlaceholder("en-GB")).toBe("DD/MM/YYYY");
    expect(numericDatePlaceholder("en-US")).toBe("MM/DD/YYYY");
    expect(formatNumericDate("2026-11-01", "en-GB")).toBe("01/11/2026");
    expect(formatNumericDate("2026-11-01", "en-US")).toBe("11/01/2026");
    expect(parseDateText("01/11/2026", "en-GB")).toBe("2026-11-01");
    expect(parseDateText("01/11/2026", "en-US")).toBe("2026-01-11");
  });

  test("parsing is lenient about separators and strict about dates", () => {
    expect(parseDateText("1.11.2026", "en-GB")).toBe("2026-11-01");
    expect(parseDateText(" 1 11 2026 ", "en-GB")).toBe("2026-11-01");
    expect(parseDateText("2026-11-01", "en-US")).toBe("2026-11-01");
    expect(parseDateText("", "en-GB")).toBeNull();
    expect(parseDateText("31/02/2026", "en-GB")).toBe("invalid");
    expect(parseDateText("03/1", "en-GB")).toBe("invalid");
    expect(parseDateText("1/11/26", "en-GB")).toBe("invalid");
  });

  test("names come from Intl", () => {
    expect(formatLongDate("2026-11-01", "en-GB")).toBe("1 November 2026");
    const names = weekdayNames("en-GB", 1);
    expect(names[0]!.long).toBe("Monday");
    expect(names[6]!.long).toBe("Sunday");
  });
});

describe("availability", () => {
  test("min, max and the predicate", () => {
    const options = { min: "2026-11-05", max: "2026-11-20", isDateUnavailable: (d: string) => d === "2026-11-10" };
    expect(isUnavailable("2026-11-04", options)).toBe(true);
    expect(isUnavailable("2026-11-21", options)).toBe(true);
    expect(isUnavailable("2026-11-10", options)).toBe(true);
    expect(isUnavailable("2026-11-11", options)).toBe(false);
  });
});

const grid = (o: Partial<Parameters<typeof getCalendarGridProps>[0]> = {}) =>
  getCalendarGridProps({
    focusedDate: "2026-11-04",
    firstDayOfWeek: 1,
    locale: "en-GB",
    today: "2026-11-07",
    ...o,
  });

const key = (k: string, extra: Record<string, unknown> = {}) => ({ key: k, preventDefault: vi.fn(), ...extra });

describe("getCalendarGridProps — keyboard", () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ["ArrowRight", {}, "2026-11-05"],
    ["ArrowLeft", {}, "2026-11-03"],
    ["ArrowDown", {}, "2026-11-11"],
    ["ArrowUp", {}, "2026-10-28"],
    ["Home", {}, "2026-11-02"],
    ["End", {}, "2026-11-08"],
    ["PageDown", {}, "2026-12-04"],
    ["PageUp", {}, "2026-10-04"],
    ["PageDown", { shiftKey: true }, "2027-11-04"],
    ["PageUp", { shiftKey: true }, "2025-11-04"],
  ];
  for (const [name, extra, expected] of cases) {
    test(`${extra.shiftKey ? "Shift+" : ""}${name} moves to ${expected}`, () => {
      const onFocusDate = vi.fn();
      const event = key(name, extra);
      grid({ onFocusDate }).grid.onKeyDown(event);
      expect(onFocusDate).toHaveBeenCalledWith(expected);
      expect(event.preventDefault).toHaveBeenCalled();
    });
  }

  test("right-to-left mirrors the horizontal arrows", () => {
    const onFocusDate = vi.fn();
    grid({ onFocusDate, direction: "rtl" }).grid.onKeyDown(key("ArrowLeft"));
    expect(onFocusDate).toHaveBeenCalledWith("2026-11-05");
  });

  test("Enter and Space are left to the day's button, and modifiers to the browser", () => {
    const onFocusDate = vi.fn();
    const enter = key("Enter");
    grid({ onFocusDate }).grid.onKeyDown(enter);
    grid({ onFocusDate }).grid.onKeyDown(key("ArrowRight", { ctrlKey: true }));
    expect(onFocusDate).not.toHaveBeenCalled();
    expect(enter.preventDefault).not.toHaveBeenCalled();
  });

  test("arrows land on unavailable days — the geometry does not lie", () => {
    const onFocusDate = vi.fn();
    grid({ onFocusDate, isDateUnavailable: (d) => d === "2026-11-05" }).grid.onKeyDown(key("ArrowRight"));
    expect(onFocusDate).toHaveBeenCalledWith("2026-11-05");
  });

  test("the month buttons page by a month and keep the day", () => {
    const onFocusDate = vi.fn();
    grid({ onFocusDate }).nextMonth();
    expect(onFocusDate).toHaveBeenLastCalledWith("2026-12-04");
    grid({ onFocusDate }).previousMonth();
    expect(onFocusDate).toHaveBeenLastCalledWith("2026-10-04");
  });
});

describe("getCalendarGridProps — days", () => {
  test("one roving tab stop", () => {
    const g = grid();
    expect(g.day("2026-11-04").tabIndex).toBe(0);
    expect(g.day("2026-11-05").tabIndex).toBe(-1);
  });

  test("a day is named by its full date, and today is aria-current", () => {
    const g = grid();
    expect(g.day("2026-11-04")["aria-label"]).toBe("4 November 2026");
    expect(g.day("2026-11-07")["aria-current"]).toBe("date");
    expect(g.day("2026-11-04")["aria-current"]).toBeUndefined();
  });

  test("selection is on the cell, never the button", () => {
    const g = grid({ isSelected: (d) => d === "2026-11-04" });
    expect(g.cell("2026-11-04")).toEqual({ role: "gridcell", "aria-selected": true });
    expect(g.cell("2026-11-05")["aria-selected"]).toBe(false);
    expect("aria-selected" in g.day("2026-11-04")).toBe(false);
  });

  test("unavailable days are aria-disabled, say so, and refuse to be chosen", () => {
    const onChoose = vi.fn();
    const g = grid({ min: "2026-11-03", onChoose });
    const day = g.day("2026-11-02");
    expect(day["aria-disabled"]).toBe(true);
    expect(day["aria-label"]).toBe("2 November 2026, unavailable");
    const click = { preventDefault: vi.fn() };
    day.onClick(click);
    expect(onChoose).not.toHaveBeenCalled();
    expect(click.preventDefault).toHaveBeenCalled();
    g.day("2026-11-03").onClick({ preventDefault: vi.fn() });
    expect(onChoose).toHaveBeenCalledWith("2026-11-03");
  });

  test("days outside the month are marked and still choosable", () => {
    const onChoose = vi.fn();
    const g = grid({ onChoose });
    expect(g.day("2026-10-26")["data-outside-month"]).toBe("");
    g.day("2026-10-26").onClick({ preventDefault: vi.fn() });
    expect(onChoose).toHaveBeenCalledWith("2026-10-26");
  });

  test("describeDate appends to the name", () => {
    const g = grid({ describeDate: (d) => (d === "2026-11-04" ? "start date" : undefined) });
    expect(g.day("2026-11-04")["aria-label"]).toBe("4 November 2026, start date");
  });

  test("the headers and the title follow the locale", () => {
    const g = grid();
    expect(g.monthLabel).toBe("November 2026");
    expect(g.weekdays[0]!.long).toBe("Monday");
    expect(g.weeks[0]![0]).toBe("2026-10-26");
  });
});
