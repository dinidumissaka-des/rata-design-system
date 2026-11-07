import { describe, expect, test, vi, afterEach, beforeAll, afterAll, beforeEach } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateRangePicker } from "./date-range-picker.js";
import type { DateRange } from "./date-range-picker.js";
import { installDialogShim } from "./test-support.js";

/** jsdom has no showModal(); the shim implements the open/close state machine only. */
beforeAll(() => {
  installDialogShim();
  document.documentElement.lang = "en-GB";
});
afterAll(() => {
  document.documentElement.lang = "";
});

// Only Date is faked, so userEvent's own timers still run. 7 November 2026
// is a Saturday.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 7, 12));
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const startInput = () => screen.getByRole("textbox", { name: "Check-in" }) as HTMLInputElement;
const endInput = () => screen.getByRole("textbox", { name: "Check-out" }) as HTMLInputElement;
const calendarButton = () => screen.getByRole("button", { name: /^Choose dates/ });
const dialog = () => screen.getByRole("dialog");
const grid = () => screen.getByRole("grid");
const focused = () => document.activeElement as HTMLElement;
const day = (name: string | RegExp) => within(grid()).getByRole("button", { name });
const form = () => screen.getByTestId("form") as HTMLFormElement;

const Fixture = (props: Partial<Parameters<typeof DateRangePicker>[0]> = {}) => (
  <form data-testid="form">
    <DateRangePicker label="Stay" startLabel="Check-in" endLabel="Check-out" {...props} />
    <button type="button">After</button>
  </form>
);

async function openCalendar() {
  await userEvent.click(calendarButton());
  expect(dialog()).toBeTruthy();
}

describe("DateRangePicker — the field", () => {
  test("a group named by the label, holding two inputs with their own labels", () => {
    render(<Fixture />);
    const group = screen.getByRole("group", { name: "Stay" });
    expect(within(group).getByRole("textbox", { name: "Check-in" })).toBe(startInput());
    expect(within(group).getByRole("textbox", { name: "Check-out" })).toBe(endInput());
    expect(startInput().placeholder).toBe("DD/MM/YYYY");
    expect(endInput().placeholder).toBe("DD/MM/YYYY");
  });

  test("the labels default to Start date and End date", () => {
    render(<DateRangePicker label="Period" />);
    expect(screen.getByRole("textbox", { name: "Start date" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "End date" })).toBeTruthy();
  });

  test("each end parses on blur, and the form posts both ISO dates", async () => {
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} startName="checkin" endName="checkout" />);
    await userEvent.type(startInput(), "1/11/2026");
    expect(onValueChange).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(onValueChange).toHaveBeenLastCalledWith({ start: "2026-11-01", end: null });
    expect(startInput().value).toBe("01/11/2026");
    await userEvent.type(endInput(), "7.11.2026{Enter}");
    expect(onValueChange).toHaveBeenLastCalledWith({ start: "2026-11-01", end: "2026-11-07" });
    const data = new FormData(form());
    expect(data.get("checkin")).toBe("2026-11-01");
    expect(data.get("checkout")).toBe("2026-11-07");
  });

  test("an end typed before the start is passed through, not swapped", async () => {
    const onValueChange = vi.fn();
    render(<Fixture defaultValue={{ start: "2026-11-10", end: null }} onValueChange={onValueChange} />);
    await userEvent.type(endInput(), "01/11/2026");
    await userEvent.tab();
    expect(onValueChange).toHaveBeenLastCalledWith({ start: "2026-11-10", end: "2026-11-01" });
    expect(startInput().value).toBe("10/11/2026");
  });

  test("the calendar button names the range it will change", () => {
    const { rerender } = render(<Fixture />);
    expect(calendarButton().getAttribute("aria-label")).toBe("Choose dates");
    rerender(<Fixture value={{ start: "2026-11-01", end: "2026-11-07" }} />);
    expect(calendarButton().getAttribute("aria-label")).toBe("Choose dates, 1 to 7 November 2026");
  });

  test("a controlled range set from outside shows in both boxes", () => {
    function Controlled() {
      const [range, setRange] = useState<DateRange>({ start: null, end: null });
      return (
        <>
          <DateRangePicker label="Stay" startLabel="Check-in" endLabel="Check-out" value={range} onValueChange={setRange} />
          <button type="button" onClick={() => setRange({ start: "2026-12-24", end: "2026-12-27" })}>
            Set
          </button>
        </>
      );
    }
    render(<Controlled />);
    fireEvent.click(screen.getByRole("button", { name: "Set" }));
    expect(startInput().value).toBe("24/12/2026");
    expect(endInput().value).toBe("27/12/2026");
  });

  test("disabled: both inputs aria-disabled and readOnly, the button refuses, both values submit", async () => {
    render(
      <Fixture
        disabled
        startName="checkin"
        endName="checkout"
        defaultValue={{ start: "2026-11-01", end: "2026-11-03" }}
      />
    );
    for (const input of [startInput(), endInput()]) {
      expect(input.getAttribute("aria-disabled")).toBe("true");
      expect(input.readOnly).toBe(true);
      expect(input.disabled).toBe(false);
    }
    expect(calendarButton().getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(calendarButton());
    expect(screen.queryByRole("dialog")).toBeNull();
    const data = new FormData(form());
    expect(data.get("checkin")).toBe("2026-11-01");
    expect(data.get("checkout")).toBe("2026-11-03");
  });

  test("required, status, description and message reach both inputs from Field", () => {
    render(<Fixture required status="invalid" description="Up to 14 nights." message="Check-out must be after check-in." />);
    for (const input of [startInput(), endInput()]) {
      expect(input.getAttribute("aria-required")).toBe("true");
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(input.getAttribute("aria-describedby")).toContain("message");
    }
  });

  test("size sets the box class", () => {
    const { container } = render(<Fixture size="lg" />);
    expect(container.querySelector(".rata-date-range-picker-box--lg")).toBeTruthy();
  });
});

describe("DateRangePicker — the calendar", () => {
  test("a modal dialog named by the label, described by the month and the hint", async () => {
    render(<Fixture />);
    await openCalendar();
    const node = dialog();
    expect(node.tagName).toBe("DIALOG");
    expect(document.getElementById(node.getAttribute("aria-labelledby")!)?.textContent).toBe("Stay");
    const [month, hint] = node.getAttribute("aria-describedby")!.split(" ");
    expect(document.getElementById(month!)?.textContent).toBe("November 2026");
    expect(document.getElementById(hint!)?.textContent).toBe("Choose start date");
    expect(document.getElementById(hint!)?.getAttribute("aria-live")).toBe("polite");
  });

  test("focus starts on today with nothing chosen, on the start once there is one", async () => {
    const { unmount } = render(<Fixture />);
    await openCalendar();
    expect(focused()).toBe(day("7 November 2026"));
    unmount();
    render(<Fixture defaultValue={{ start: "2026-11-20", end: null }} />);
    await openCalendar();
    expect(focused()).toBe(day("20 November 2026, start date"));
  });

  test("the first choice is the start, the second the end, which closes", async () => {
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} />);
    await openCalendar();
    await userEvent.keyboard("{ArrowRight}{Enter}");
    expect(onValueChange).toHaveBeenLastCalledWith({ start: "2026-11-08", end: null });
    // Still open, and the hint has moved on.
    expect(dialog()).toBeTruthy();
    expect(screen.getByText("Choose end date")).toBeTruthy();
    expect(startInput().value).toBe("08/11/2026");
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{Enter}");
    expect(onValueChange).toHaveBeenLastCalledWith({ start: "2026-11-08", end: "2026-11-10" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(endInput().value).toBe("10/11/2026");
    expect(focused()).toBe(calendarButton());
  });

  test("clicking works the same way", async () => {
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} />);
    await openCalendar();
    await userEvent.click(day("12 November 2026"));
    await userEvent.click(day("15 November 2026"));
    expect(onValueChange).toHaveBeenLastCalledWith({ start: "2026-11-12", end: "2026-11-15" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("a day before the start becomes the new start", async () => {
    const onValueChange = vi.fn();
    render(<Fixture defaultValue={{ start: "2026-11-10", end: null }} onValueChange={onValueChange} />);
    await openCalendar();
    await userEvent.click(day("4 November 2026"));
    expect(onValueChange).toHaveBeenLastCalledWith({ start: "2026-11-04", end: null });
    expect(dialog()).toBeTruthy();
  });

  test("a choice over a whole range starts a new one", async () => {
    const onValueChange = vi.fn();
    render(<Fixture defaultValue={{ start: "2026-11-02", end: "2026-11-05" }} onValueChange={onValueChange} />);
    await openCalendar();
    await userEvent.click(day("20 November 2026"));
    expect(onValueChange).toHaveBeenLastCalledWith({ start: "2026-11-20", end: null });
    expect(endInput().value).toBe("");
  });

  test("the ends' cells are aria-selected; the days between are named, not selected", async () => {
    render(<Fixture defaultValue={{ start: "2026-11-02", end: "2026-11-05" }} />);
    await openCalendar();
    const start = day("2 November 2026, start date");
    const between = day("3 November 2026, in range");
    const end = day("5 November 2026, end date");
    expect(start.closest("td")!.getAttribute("aria-selected")).toBe("true");
    expect(end.closest("td")!.getAttribute("aria-selected")).toBe("true");
    expect(between.closest("td")!.getAttribute("aria-selected")).toBe("false");
    expect(start.getAttribute("aria-selected")).toBeNull();
    expect(between.closest("td")!.hasAttribute("data-in-range")).toBe(true);
  });

  test("the preview follows the keyboard from the start", async () => {
    render(<Fixture defaultValue={{ start: "2026-11-02", end: null }} />);
    await openCalendar();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(day("3 November 2026").closest("td")!.hasAttribute("data-preview")).toBe(true);
    expect(day("4 November 2026").closest("td")!.hasAttribute("data-preview")).toBe(true);
    expect(day("5 November 2026").closest("td")!.hasAttribute("data-preview")).toBe(false);
  });

  test("the preview follows the pointer too", async () => {
    render(<Fixture defaultValue={{ start: "2026-11-02", end: null }} />);
    await openCalendar();
    fireEvent.pointerEnter(day("6 November 2026"));
    expect(day("5 November 2026").closest("td")!.hasAttribute("data-preview")).toBe(true);
    fireEvent.pointerLeave(grid());
    expect(day("5 November 2026").closest("td")!.hasAttribute("data-preview")).toBe(false);
  });

  test("once a start is chosen, no end past the next unavailable day", async () => {
    const onValueChange = vi.fn();
    render(<Fixture isDateUnavailable={(d) => d === "2026-11-11"} onValueChange={onValueChange} />);
    await openCalendar();
    await userEvent.click(day("9 November 2026"));
    expect(day("10 November 2026").getAttribute("aria-disabled")).toBeNull();
    expect(day("11 November 2026, unavailable").getAttribute("aria-disabled")).toBe("true");
    const past = day("13 November 2026, unavailable");
    expect(past.getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(past);
    expect(onValueChange).toHaveBeenLastCalledWith({ start: "2026-11-09", end: null });
    expect(dialog()).toBeTruthy();
    // Before the start is still choosable, as a new start.
    expect(day("2 November 2026").getAttribute("aria-disabled")).toBeNull();
  });

  test("the grid's keyboard model is DatePicker's", async () => {
    render(<Fixture />);
    await openCalendar();
    await userEvent.keyboard("{PageDown}");
    expect(focused().getAttribute("aria-label")).toBe("7 December 2026");
    expect(screen.getByRole("heading").textContent).toBe("December 2026");
    await userEvent.keyboard("{Home}");
    expect(focused().getAttribute("aria-label")).toBe("7 December 2026");
    await userEvent.keyboard("{End}");
    expect(focused().getAttribute("aria-label")).toBe("13 December 2026");
  });

  test("Escape closes, keeping a chosen start, focus back on the button", async () => {
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} />);
    await openCalendar();
    await userEvent.keyboard("{Enter}");
    const cancel = new Event("cancel", { cancelable: true, bubbles: true });
    fireEvent(dialog(), cancel);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith({ start: "2026-11-07", end: null });
    expect(focused()).toBe(calendarButton());
  });
});
