import { describe, expect, test, vi, afterEach, beforeAll, afterAll, beforeEach } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker } from "./date-picker.js";
import { installDialogShim } from "./test-support.js";

/**
 * jsdom has no showModal(); the shim implements the open/close state machine
 * and nothing else — no focus trap, no inert page. See test-support.ts.
 */
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

const input = () => screen.getByRole("textbox", { name: /Check-in/ }) as HTMLInputElement;
const calendarButton = () => screen.getByRole("button", { name: /^Choose date/ });
const dialog = () => screen.getByRole("dialog");
const grid = () => screen.getByRole("grid");
const focused = () => document.activeElement as HTMLElement;
const day = (name: string) => within(grid()).getByRole("button", { name });

const Fixture = (props: Partial<Parameters<typeof DatePicker>[0]> = {}) => (
  <form data-testid="form">
    <DatePicker label="Check-in" {...props} />
    <button type="button">After</button>
  </form>
);

async function openCalendar() {
  await userEvent.click(calendarButton());
  expect(dialog()).toBeTruthy();
}

describe("DatePicker — the field", () => {
  test("typing is the primary path: the placeholder is the locale's format", () => {
    render(<Fixture />);
    expect(input().placeholder).toBe("DD/MM/YYYY");
    expect(input().getAttribute("autocomplete")).toBe("off");
  });

  test("typed text parses on blur, in the page locale's order", async () => {
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} name="checkin" />);
    await userEvent.type(input(), "1/11/2026");
    // Not per keystroke: "03/1" is not a date yet.
    expect(onValueChange).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(onValueChange).toHaveBeenCalledWith("2026-11-01");
    expect(input().value).toBe("01/11/2026");
    // The form posts the ISO date, not the displayed text.
    expect(new FormData(screen.getByTestId("form") as HTMLFormElement).get("checkin")).toBe("2026-11-01");
  });

  test("Enter parses too", async () => {
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} />);
    await userEvent.type(input(), "25.12.2026{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("2026-12-25");
  });

  test("text that is not a date reverts to the current value", async () => {
    render(<Fixture defaultValue="2026-11-01" />);
    await userEvent.clear(input());
    await userEvent.type(input(), "31/02/2026");
    await userEvent.tab();
    expect(input().value).toBe("01/11/2026");
  });

  test("clearing the box clears the value", async () => {
    const onValueChange = vi.fn();
    render(<Fixture defaultValue="2026-11-01" onValueChange={onValueChange} />);
    await userEvent.clear(input());
    await userEvent.tab();
    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  test("a typed unavailable date is passed through for the caller to report", async () => {
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} min="2026-11-10" />);
    await userEvent.type(input(), "01/11/2026");
    await userEvent.tab();
    expect(onValueChange).toHaveBeenCalledWith("2026-11-01");
  });

  test("the calendar button is a tab stop and names the date it will change", async () => {
    const { rerender } = render(<Fixture />);
    input().focus();
    await userEvent.tab();
    expect(focused()).toBe(calendarButton());
    expect(calendarButton().getAttribute("aria-label")).toBe("Choose date");
    rerender(<Fixture value="2026-11-01" />);
    expect(calendarButton().getAttribute("aria-label")).toBe("Choose date, 1 November 2026");
  });

  test("a controlled value set from outside shows in the box", () => {
    function Controlled() {
      const [value, setValue] = useState<string | null>(null);
      return (
        <>
          <DatePicker label="Check-in" value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue("2026-12-24")}>
            Set
          </button>
        </>
      );
    }
    render(<Controlled />);
    fireEvent.click(screen.getByRole("button", { name: "Set" }));
    expect(input().value).toBe("24/12/2026");
  });

  test("disabled: aria-disabled and readOnly, and the button refuses to open", async () => {
    render(<Fixture disabled name="checkin" defaultValue="2026-11-01" />);
    expect(input().getAttribute("aria-disabled")).toBe("true");
    expect(input().readOnly).toBe(true);
    expect(input().disabled).toBe(false);
    expect(calendarButton().getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(calendarButton());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(new FormData(screen.getByTestId("form") as HTMLFormElement).get("checkin")).toBe("2026-11-01");
  });
});

describe("DatePicker — the calendar dialog", () => {
  test("a modal dialog named by the label and described by the visible month", async () => {
    render(<Fixture />);
    await openCalendar();
    const node = dialog();
    expect(node.tagName).toBe("DIALOG");
    expect(document.getElementById(node.getAttribute("aria-labelledby")!)?.textContent).toBe("Check-in");
    expect(document.getElementById(node.getAttribute("aria-describedby")!)?.textContent).toBe(
      "November 2026"
    );
    expect(screen.getByRole("heading", { name: "November 2026" }).getAttribute("aria-live")).toBe("polite");
  });

  test("focus starts on today when nothing is chosen", async () => {
    render(<Fixture />);
    await openCalendar();
    expect(focused()).toBe(day("7 November 2026"));
    expect(focused().getAttribute("aria-current")).toBe("date");
  });

  test("focus starts on the chosen date, whose cell is aria-selected", async () => {
    render(<Fixture defaultValue="2026-11-20" />);
    await openCalendar();
    expect(focused()).toBe(day("20 November 2026"));
    expect(focused().closest("td")!.getAttribute("aria-selected")).toBe("true");
    expect(focused().getAttribute("aria-selected")).toBeNull();
  });

  test("one roving tab stop", async () => {
    render(<Fixture />);
    await openCalendar();
    const tabbable = within(grid())
      .getAllByRole("button")
      .filter((b) => b.tabIndex === 0);
    expect(tabbable).toEqual([day("7 November 2026")]);
  });

  test("the weekday headers start on the locale's first day, or firstDayOfWeek", async () => {
    const { unmount } = render(<Fixture />);
    await openCalendar();
    expect(screen.getAllByRole("columnheader")[0]!.getAttribute("abbr")).toBe("Monday");
    unmount();
    render(<Fixture firstDayOfWeek={0} />);
    await openCalendar();
    expect(screen.getAllByRole("columnheader")[0]!.getAttribute("abbr")).toBe("Sunday");
  });

  test("the rows are whole weeks, with outside days choosable", async () => {
    render(<Fixture />);
    await openCalendar();
    const outside = day("26 October 2026");
    expect(outside.hasAttribute("data-outside-month")).toBe(true);
    expect(outside.getAttribute("aria-disabled")).toBeNull();
  });
});

describe("DatePicker — the grid's keyboard model", () => {
  const cases: Array<[string, string]> = [
    ["{ArrowRight}", "8 November 2026"],
    ["{ArrowLeft}", "6 November 2026"],
    ["{ArrowDown}", "14 November 2026"],
    ["{ArrowUp}", "31 October 2026"],
    ["{Home}", "2 November 2026"],
    ["{End}", "8 November 2026"],
    ["{PageDown}", "7 December 2026"],
    ["{PageUp}", "7 October 2026"],
    ["{Shift>}{PageDown}{/Shift}", "7 November 2027"],
    ["{Shift>}{PageUp}{/Shift}", "7 November 2025"],
  ];
  for (const [keys, expected] of cases) {
    test(`${keys} moves focus to ${expected}`, async () => {
      render(<Fixture />);
      await openCalendar();
      await userEvent.keyboard(keys);
      expect(focused().getAttribute("aria-label")).toBe(expected);
      expect(focused().tabIndex).toBe(0);
    });
  }

  test("paging changes the month title", async () => {
    render(<Fixture />);
    await openCalendar();
    await userEvent.keyboard("{PageDown}");
    expect(screen.getByRole("heading").textContent).toBe("December 2026");
    expect(dialog().getAttribute("aria-describedby")).toBe(screen.getByRole("heading").id);
  });

  test("Enter chooses, closes and returns focus to the calendar button", async () => {
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} />);
    await openCalendar();
    await userEvent.keyboard("{ArrowRight}{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("2026-11-08");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(input().value).toBe("08/11/2026");
    expect(focused()).toBe(calendarButton());
  });

  test("Space chooses too", async () => {
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} />);
    await openCalendar();
    await userEvent.keyboard("{ArrowLeft}[Space]");
    expect(onValueChange).toHaveBeenCalledWith("2026-11-06");
  });

  test("Escape closes without changing anything, focus back on the button", async () => {
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} />);
    await openCalendar();
    await userEvent.keyboard("{ArrowRight}");
    // jsdom does not turn Escape into the dialog's cancel event; this is it.
    const cancel = new Event("cancel", { cancelable: true, bubbles: true });
    fireEvent(dialog(), cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(focused()).toBe(calendarButton());
  });

  test("unavailable days are focusable, announced and refused", async () => {
    const onValueChange = vi.fn();
    render(
      <Fixture
        onValueChange={onValueChange}
        min="2026-11-05"
        isDateUnavailable={(d) => d === "2026-11-08"}
      />
    );
    await openCalendar();
    await userEvent.keyboard("{ArrowRight}");
    expect(focused().getAttribute("aria-label")).toBe("8 November 2026, unavailable");
    expect(focused().getAttribute("aria-disabled")).toBe("true");
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(dialog()).toBeTruthy();
    // min: days before it stay in the grid, unavailable.
    expect(day("4 November 2026, unavailable").getAttribute("aria-disabled")).toBe("true");
  });

  test("the month buttons page and keep focus where it is", async () => {
    render(<Fixture />);
    await openCalendar();
    const next = screen.getByRole("button", { name: "Next month" });
    await userEvent.click(next);
    expect(screen.getByRole("heading").textContent).toBe("December 2026");
    expect(focused()).toBe(next);
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("heading").textContent).toBe("November 2026");
  });

  test("clicking a day chooses it", async () => {
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} />);
    await openCalendar();
    await userEvent.click(day("19 November 2026"));
    expect(onValueChange).toHaveBeenCalledWith("2026-11-19");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("DatePicker — Field", () => {
  test("required, status, description and message come from Field", () => {
    render(
      <Fixture required status="invalid" description="Any weekday." message="We do not deliver on Sundays." />
    );
    expect(input().getAttribute("aria-required")).toBe("true");
    expect(input().getAttribute("aria-invalid")).toBe("true");
    expect(input().getAttribute("aria-describedby")).toContain("message");
  });

  test("size sets the box class", () => {
    render(<Fixture size="sm" />);
    expect(input().className).toContain("rata-date-picker-input--sm");
  });
});
