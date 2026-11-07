import { describe, expect, test, vi, afterEach, beforeAll } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Combobox } from "./combobox.js";
import type { ComboboxOption } from "./combobox.js";
import { installPopoverShim } from "./test-support.js";

/** jsdom has no popover API; see test-support.ts for what the shim does not fake. */
beforeAll(installPopoverShim);
afterEach(cleanup);

const ZONES: ComboboxOption[] = [
  { value: "America/New_York", label: "New York", description: "Eastern Time" },
  { value: "Europe/London", label: "London" },
  { value: "Asia/Colombo", label: "Colombo", disabled: true },
  { value: "Europe/Lisbon", label: "Lisbon" },
];

const input = () => screen.getByRole("combobox", { name: /Time zone/ });
const listbox = () => screen.getByRole("listbox", { hidden: true });
const popup = () => listbox().parentElement as HTMLElement;
const isOpen = () => popup().matches(":popover-open");
const highlighted = () => {
  const id = input().getAttribute("aria-activedescendant");
  return id === null ? null : document.getElementById(id)?.textContent ?? null;
};

const Fixture = (props: Partial<Parameters<typeof Combobox>[0]> = {}) => (
  <form data-testid="form">
    <Combobox label="Time zone" options={ZONES} {...props} />
    <button type="button">After</button>
  </form>
);

describe("Combobox — structure", () => {
  test("an APG combobox with a listbox named by the same label", () => {
    render(<Fixture />);
    expect(input().getAttribute("aria-autocomplete")).toBe("list");
    expect(input().getAttribute("aria-expanded")).toBe("false");
    expect(input().getAttribute("aria-controls")).toBe(listbox().id);
    const labelId = listbox().getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelId)?.textContent).toBe("Time zone");
  });

  test("the popup is a manual popover built on Popover's surface", () => {
    render(<Fixture />);
    expect(popup().getAttribute("popover")).toBe("manual");
    expect(popup().className).toContain("rata-popover");
  });

  test("the toggle is not a tab stop", async () => {
    render(<Fixture />);
    const toggle = screen.getByRole("button", { name: "Time zone" });
    expect(toggle.getAttribute("tabindex")).toBe("-1");
    input().focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  });

  test("it never opens on focus", async () => {
    render(<Fixture />);
    await userEvent.click(input());
    expect(isOpen()).toBe(false);
    expect(input().getAttribute("aria-expanded")).toBe("false");
  });
});

describe("Combobox — keyboard", () => {
  test("ArrowDown opens and highlights the first option; focus stays in the input", async () => {
    render(<Fixture />);
    input().focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(isOpen()).toBe(true);
    expect(input().getAttribute("aria-expanded")).toBe("true");
    expect(highlighted()).toContain("New York");
    expect(document.activeElement).toBe(input());
  });

  test("arrows walk the list through disabled options and wrap", async () => {
    render(<Fixture />);
    input().focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(highlighted()).toBe("Colombo");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(highlighted()).toContain("New York");
    await userEvent.keyboard("{ArrowUp}");
    expect(highlighted()).toBe("Lisbon");
  });

  test("ArrowUp opens on the last option", async () => {
    render(<Fixture />);
    input().focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(highlighted()).toBe("Lisbon");
  });

  test("arrowing does not choose — Enter does", async () => {
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} />);
    input().focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(onValueChange).not.toHaveBeenCalled();
    expect((input() as HTMLInputElement).value).toBe("");
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("Europe/London");
    expect((input() as HTMLInputElement).value).toBe("London");
    expect(isOpen()).toBe(false);
  });

  test("Enter on a disabled option is refused", async () => {
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} />);
    input().focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(isOpen()).toBe(true);
  });

  test("typing opens a filtered list with nothing highlighted", async () => {
    const onInputChange = vi.fn();
    render(<Fixture onInputChange={onInputChange} />);
    await userEvent.type(input(), "york");
    expect(isOpen()).toBe(true);
    expect(onInputChange).toHaveBeenLastCalledWith("york");
    expect(screen.getAllByRole("option", { hidden: true })).toHaveLength(1);
    expect(input().getAttribute("aria-activedescendant")).toBeNull();
  });

  test("starts-with filtering", async () => {
    render(<Fixture filter="starts-with" />);
    await userEvent.type(input(), "on");
    expect(screen.queryAllByRole("option", { hidden: true })).toHaveLength(0);
    // Once as the visible row, once in the count region.
    expect(screen.getAllByText("No matches")).toHaveLength(2);
  });

  test("filter none leaves the server's answer alone", async () => {
    render(<Fixture filter="none" />);
    await userEvent.type(input(), "zzz");
    expect(screen.getAllByRole("option", { hidden: true })).toHaveLength(4);
  });

  test("Escape closes first, then clears, then bubbles", async () => {
    const outer = vi.fn();
    render(
      <div onKeyDown={(event) => event.key === "Escape" && outer()}>
        <Fixture defaultValue="Europe/London" />
      </div>
    );
    input().focus();
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Escape}");
    expect(isOpen()).toBe(false);
    expect((input() as HTMLInputElement).value).toBe("London");
    expect(outer).not.toHaveBeenCalled();

    await userEvent.keyboard("{Escape}");
    expect((input() as HTMLInputElement).value).toBe("");
    expect(outer).not.toHaveBeenCalled();

    await userEvent.keyboard("{Escape}");
    expect(outer).toHaveBeenCalledTimes(1);
  });

  test("Alt+ArrowDown opens without highlighting", async () => {
    render(<Fixture />);
    input().focus();
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(isOpen()).toBe(true);
    expect(input().getAttribute("aria-activedescendant")).toBeNull();
  });

  test("Tab out closes it", async () => {
    render(<Fixture />);
    input().focus();
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.tab();
    expect(isOpen()).toBe(false);
  });
});

describe("Combobox — the value and the text", () => {
  test("unmatched text reverts to the chosen label on blur", async () => {
    render(<Fixture defaultValue="Europe/London" />);
    // Edited, not emptied: emptying the box is the deliberate clear below.
    await userEvent.type(input(), "{Backspace}{Backspace}");
    expect((input() as HTMLInputElement).value).toBe("Lond");
    await userEvent.tab();
    expect((input() as HTMLInputElement).value).toBe("London");
  });

  test("unmatched text with nothing chosen empties on blur", async () => {
    render(<Fixture />);
    await userEvent.type(input(), "Atlantis");
    await userEvent.tab();
    expect((input() as HTMLInputElement).value).toBe("");
  });

  test("allowCustomValue keeps unmatched text as the value", async () => {
    const onValueChange = vi.fn();
    render(<Fixture allowCustomValue onValueChange={onValueChange} />);
    await userEvent.type(input(), "Kandy");
    await userEvent.tab();
    expect((input() as HTMLInputElement).value).toBe("Kandy");
    expect(onValueChange).toHaveBeenCalledWith("Kandy");
  });

  test("clearing the text clears the value", async () => {
    const onValueChange = vi.fn();
    render(<Fixture defaultValue="Europe/London" onValueChange={onValueChange} />);
    await userEvent.clear(input());
    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  test("the hidden input submits the value, not the label", async () => {
    render(<Fixture name="tz" defaultValue="Europe/Lisbon" />);
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(new FormData(form).get("tz")).toBe("Europe/Lisbon");
    expect((input() as HTMLInputElement).value).toBe("Lisbon");
    expect(input().getAttribute("name")).toBeNull();
  });

  test("a controlled value set from outside shows its label", () => {
    function Controlled() {
      const [value, setValue] = useState<string | null>(null);
      return (
        <>
          <Combobox label="Time zone" options={ZONES} value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue("Europe/Lisbon")}>
            Set
          </button>
        </>
      );
    }
    render(<Controlled />);
    fireEvent.click(screen.getByRole("button", { name: "Set" }));
    expect((input() as HTMLInputElement).value).toBe("Lisbon");
  });

  test("opening on a chosen answer shows every option, starting on it", async () => {
    render(<Fixture defaultValue="Europe/Lisbon" />);
    input().focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("option", { hidden: true })).toHaveLength(4);
    expect(highlighted()).toBe("Lisbon");
    const selected = screen.getByRole("option", { hidden: true, selected: true });
    expect(selected.textContent).toBe("Lisbon");
  });
});

describe("Combobox — pointer", () => {
  test("the toggle opens it and keeps focus in the input", async () => {
    render(<Fixture />);
    await userEvent.click(screen.getByRole("button", { name: "Time zone" }));
    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(input());
  });

  test("clicking an option chooses it", async () => {
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Time zone" }));
    await userEvent.click(screen.getByRole("option", { hidden: true, name: "Lisbon" }));
    expect(onValueChange).toHaveBeenCalledWith("Europe/Lisbon");
    expect(isOpen()).toBe(false);
  });

  test("a press outside dismisses it", async () => {
    render(<Fixture />);
    await userEvent.click(screen.getByRole("button", { name: "Time zone" }));
    await userEvent.click(screen.getByRole("button", { name: "After" }));
    expect(isOpen()).toBe(false);
  });
});

describe("Combobox — announcements and states", () => {
  test("the count is announced politely, and waits for loading to clear", async () => {
    const { rerender } = render(<Fixture loading />);
    await userEvent.type(input(), "o");
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");
    expect(listbox().getAttribute("aria-busy")).toBe("true");
    rerender(<Fixture />);
    expect(screen.getByRole("status").textContent).toBe("4 results");
  });

  test("the empty message is announced, outside the options", async () => {
    render(<Fixture emptyMessage="No zones match" />);
    await userEvent.type(input(), "zzz");
    expect(screen.getByRole("status").textContent).toBe("No zones match");
    expect(listbox().contains(screen.getAllByText("No zones match")[0]!)).toBe(false);
  });

  test("disabled: aria-disabled and readOnly, and nothing opens it", async () => {
    render(<Fixture disabled name="tz" defaultValue="Europe/London" />);
    expect(input().getAttribute("aria-disabled")).toBe("true");
    expect(input().hasAttribute("readonly")).toBe(true);
    expect(input().hasAttribute("disabled")).toBe(false);
    input().focus();
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.click(screen.getByRole("button", { name: "Time zone" }));
    expect(isOpen()).toBe(false);
    // The text field's consequence: the hidden input still submits.
    expect(new FormData(screen.getByTestId("form") as HTMLFormElement).get("tz")).toBe("Europe/London");
  });

  test("Field supplies the rest: required, status, description and message", () => {
    render(
      <Fixture required status="invalid" description="Where you work." message="Choose a time zone." />
    );
    expect(input().getAttribute("aria-required")).toBe("true");
    expect(input().getAttribute("aria-invalid")).toBe("true");
    expect(input().getAttribute("aria-describedby")).toContain("description");
    expect(input().getAttribute("aria-describedby")).toContain("message");
  });

  test("size sets the box class", () => {
    render(<Fixture size="lg" />);
    expect(input().className).toContain("rata-combobox-input--lg");
  });
});
