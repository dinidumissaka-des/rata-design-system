import { describe, expect, test, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "./tabs.js";

afterEach(cleanup);

const ITEMS = [
  { value: "details", label: "Details", content: "The details" },
  { value: "history", label: "History", content: "The history" },
  { value: "notes", label: "Notes", content: "The notes" },
];

describe("Tabs", () => {
  test("is a named tablist of tabs over panels — not a radiogroup", () => {
    render(<Tabs label="Invoice" items={ITEMS} />);
    expect(screen.getByRole("tablist", { name: "Invoice" })).toBeTruthy();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    // The distinction the component exists to hold: a radiogroup answers a
    // question and gets submitted; a tablist reveals a region.
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  test("each tab names its panel, and each panel names its tab", () => {
    render(<Tabs label="Invoice" items={ITEMS} />);
    const tab = screen.getByRole("tab", { name: "Details" });
    const panel = screen.getByRole("tabpanel");
    expect(tab.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("aria-labelledby")).toBe(tab.id);
  });

  test("only one panel is exposed, and it is the selected one", () => {
    render(<Tabs label="Invoice" items={ITEMS} />);
    // `hidden` keeps the rest out of the accessibility tree entirely.
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.getByRole("tabpanel").textContent).toBe("The details");
    expect(screen.getByRole("tab", { name: "Details" }).getAttribute("aria-selected")).toBe("true");
  });

  test("but every panel stays mounted, so nothing inside one is thrown away", () => {
    // Unmounting would discard a half-filled form or a scroll position every
    // time the reader glanced at another tab.
    const { container } = render(<Tabs label="Invoice" items={ITEMS} />);
    expect(container.querySelectorAll(".rata-tabs-panel")).toHaveLength(3);
    expect(container.querySelectorAll("[hidden]")).toHaveLength(2);
  });

  test("the panel is focusable even with nothing focusable inside it", () => {
    // Without this, Tab from the tablist skips a panel of plain text and the
    // reader never reaches the content the tab promised.
    render(<Tabs label="Invoice" items={ITEMS} />);
    expect(screen.getByRole("tabpanel").tabIndex).toBe(0);
  });

  test("exactly one tab is the tab stop", () => {
    render(<Tabs label="Invoice" items={ITEMS} defaultValue="history" />);
    expect(screen.getAllByRole("tab").map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
  });

  test("clicking a tab shows its panel", async () => {
    render(<Tabs label="Invoice" items={ITEMS} />);
    await userEvent.click(screen.getByRole("tab", { name: "Notes" }));
    expect(screen.getByRole("tabpanel").textContent).toBe("The notes");
  });

  test("automatic activation: arrows move real focus and select, wrapping", async () => {
    render(<Tabs label="Invoice" items={ITEMS} />);
    screen.getByRole("tab", { name: "Details" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "History" }));
    expect(screen.getByRole("tabpanel").textContent).toBe("The history");

    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Notes" }));
  });

  test("Home and End jump to the ends", async () => {
    render(<Tabs label="Invoice" items={ITEMS} defaultValue="history" />);
    screen.getByRole("tab", { name: "History" }).focus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tabpanel").textContent).toBe("The notes");
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("tabpanel").textContent).toBe("The details");
  });

  test("manual activation: arrows move focus without selecting", async () => {
    // The reason the prop exists: under automatic, arrowing across four tabs
    // renders four panels — and fires four requests if they fetch.
    const onValueChange = vi.fn();
    render(<Tabs label="Invoice" items={ITEMS} activation="manual" onValueChange={onValueChange} />);
    screen.getByRole("tab", { name: "Details" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "History" }));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole("tabpanel").textContent).toBe("The details");

    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("tabpanel").textContent).toBe("The history");
  });

  test("the vertical axis uses the vertical arrows", async () => {
    render(<Tabs label="Invoice" items={ITEMS} orientation="vertical" />);
    expect(screen.getByRole("tablist").getAttribute("aria-orientation")).toBe("vertical");
    screen.getByRole("tab", { name: "Details" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    // Ignored on this axis — announcing the orientation is a promise kept.
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Details" }));
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "History" }));
  });

  test("a disabled tab is reachable and announced, but cannot be selected", async () => {
    const items = [
      { value: "a", label: "A", content: "A body" },
      { value: "b", label: "B", content: "B body", disabled: true },
    ];
    render(<Tabs label="x" items={items} />);
    const disabled = screen.getByRole("tab", { name: "B" });
    expect(disabled.getAttribute("aria-disabled")).toBe("true");
    expect(disabled).toHaveProperty("disabled", false);

    screen.getByRole("tab", { name: "A" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(disabled);
    // Focus moved; selection did not.
    expect(screen.getByRole("tabpanel").textContent).toBe("A body");

    await userEvent.click(disabled);
    expect(screen.getByRole("tabpanel").textContent).toBe("A body");
  });

  test("controlled: the caller owns which panel shows", async () => {
    const onValueChange = vi.fn();
    render(<Tabs label="x" items={ITEMS} value="details" onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("tab", { name: "Notes" }));
    expect(onValueChange).toHaveBeenCalledWith("notes");
    // Unchanged, because the caller did not change it.
    expect(screen.getByRole("tabpanel").textContent).toBe("The details");
  });

  test("labelledBy wins over label, because it points at visible text", () => {
    render(
      <>
        <h2 id="h">Invoice 42</h2>
        <Tabs label="Invoice" labelledBy="h" items={ITEMS} />
      </>
    );
    expect(screen.getByRole("tablist", { name: "Invoice 42" })).toBeTruthy();
  });

  test("mounting does not steal focus", () => {
    // Focus follows the arrow keys, never the first paint — a page of tabs
    // would otherwise yank focus on load.
    render(<Tabs label="x" items={ITEMS} />);
    expect(document.activeElement).toBe(document.body);
  });

  test("passes the rest through, so the set can be identified", () => {
    const { container } = render(<Tabs label="x" items={ITEMS} data-testid="t" />);
    expect(container.querySelector('[data-testid="t"]')).toBeTruthy();
  });
});
