import { describe, expect, test, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl } from "./segmented-control.js";

afterEach(cleanup);

const OPTIONS = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
];

describe("SegmentedControl", () => {
  test("is a named radiogroup of radios — a question, not a set of regions", () => {
    render(<SegmentedControl label="Range" options={OPTIONS} />);
    expect(screen.getByRole("radiogroup", { name: "Range" })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    // Not tabs: nothing here controls a panel, because the value is the answer.
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByRole("radio", { name: "Week" }).getAttribute("aria-controls")).toBeNull();
  });

  test("the answer is announced, not only raised", () => {
    render(<SegmentedControl label="Range" options={OPTIONS} defaultValue="month" />);
    expect(screen.getByRole("radio", { name: "Month", checked: true })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Week" }).getAttribute("aria-checked")).toBe("false");
  });

  test("it defaults to the first option — there is no unanswered state", () => {
    render(<SegmentedControl label="Range" options={OPTIONS} />);
    expect(screen.getByRole("radio", { name: "Week" }).getAttribute("aria-checked")).toBe("true");
  });

  test("exactly one option is the tab stop", () => {
    render(<SegmentedControl label="Range" options={OPTIONS} defaultValue="month" />);
    expect(screen.getAllByRole("radio").map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
  });

  test("arrow keys move real focus and select, wrapping", async () => {
    render(<SegmentedControl label="Range" options={OPTIONS} />);
    screen.getByRole("radio", { name: "Week" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Month" }));
    expect(screen.getByRole("radio", { name: "Month" }).getAttribute("aria-checked")).toBe("true");

    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Quarter" }));
  });

  test("both axes' arrows work, and no orientation is claimed", async () => {
    render(<SegmentedControl label="Range" options={OPTIONS} />);
    // The bar is horizontal by construction, so announcing an orientation
    // would promise that only one pair moves. Accepting both claims nothing.
    expect(screen.getByRole("radiogroup").getAttribute("aria-orientation")).toBeNull();
    screen.getByRole("radio", { name: "Week" }).focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Month" }));
  });

  test("Home and End jump to the ends", async () => {
    render(<SegmentedControl label="Range" options={OPTIONS} defaultValue="month" />);
    screen.getByRole("radio", { name: "Month" }).focus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "Quarter" }).getAttribute("aria-checked")).toBe("true");
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("radio", { name: "Week" }).getAttribute("aria-checked")).toBe("true");
  });

  test("re-picking the current answer reports nothing", async () => {
    // There is no cleared state to fall into, and a handler that refetches on
    // change should not fire for a click where the reader already was.
    const onValueChange = vi.fn();
    render(<SegmentedControl label="Range" options={OPTIONS} onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "Week" }));
    expect(onValueChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("radio", { name: "Month" }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("month");
  });

  test("a disabled option is reachable and announced, but never the answer", async () => {
    render(
      <SegmentedControl
        label="Range"
        options={[
          { value: "week", label: "Week" },
          { value: "month", label: "Month", disabled: true },
        ]}
      />
    );
    const disabled = screen.getByRole("radio", { name: "Month" });
    expect(disabled.getAttribute("aria-disabled")).toBe("true");
    expect(disabled).toHaveProperty("disabled", false);

    screen.getByRole("radio", { name: "Week" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(disabled);
    // Focus moved; the answer did not.
    expect(disabled.getAttribute("aria-checked")).toBe("false");

    await userEvent.click(disabled);
    expect(disabled.getAttribute("aria-checked")).toBe("false");
  });

  test("controlled: the caller owns the answer", async () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl label="Range" options={OPTIONS} value="week" onValueChange={onValueChange} />
    );
    await userEvent.click(screen.getByRole("radio", { name: "Quarter" }));
    expect(onValueChange).toHaveBeenCalledWith("quarter");
    expect(screen.getByRole("radio", { name: "Week" }).getAttribute("aria-checked")).toBe("true");
  });

  test("labelledBy wins over label, because it points at visible text", () => {
    render(
      <>
        <span id="q">Billing period</span>
        <SegmentedControl label="Range" labelledBy="q" options={OPTIONS} />
      </>
    );
    expect(screen.getByRole("radiogroup", { name: "Billing period" })).toBeTruthy();
  });

  test("mounting does not steal focus", () => {
    render(<SegmentedControl label="Range" options={OPTIONS} />);
    expect(document.activeElement).toBe(document.body);
  });

  test("fullWidth and size pick classes, md being the default", () => {
    const { container } = render(<SegmentedControl label="x" options={OPTIONS} />);
    expect(container.querySelector(".rata-segmented-control--md")).toBeTruthy();
    expect(container.querySelector(".rata-segmented-control--full")).toBeNull();
    const { container: full } = render(
      <SegmentedControl label="x" options={OPTIONS} size="sm" fullWidth />
    );
    expect(full.querySelector(".rata-segmented-control--sm")).toBeTruthy();
    expect(full.querySelector(".rata-segmented-control--full")).toBeTruthy();
  });

  test("passes the rest through, so it can be identified", () => {
    render(<SegmentedControl label="x" options={OPTIONS} data-testid="s" />);
    expect(screen.getByRole("radiogroup").getAttribute("data-testid")).toBe("s");
  });
});
