import { describe, expect, test, afterEach, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Steps } from "./steps.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const checkout = [
  { id: "shipping", label: "Shipping" },
  { id: "payment", label: "Payment" },
  { id: "review", label: "Review" },
];

/** The visible list — the measuring copy is aria-hidden and has no label. */
function visibleList() {
  return screen.getByRole("list");
}

describe("Steps", () => {
  test("is an ordered list named by label, with no landmark when not navigable", () => {
    render(<Steps label="Checkout progress" current="payment" steps={checkout} />);
    const list = screen.getByRole("list", { name: "Checkout progress" });
    expect(list.tagName).toBe("OL");
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  test("with onStepSelect the label moves to a <nav> around the list", () => {
    render(
      <Steps label="Checkout progress" current="payment" steps={checkout} onStepSelect={() => {}} />
    );
    const nav = screen.getByRole("navigation", { name: "Checkout progress" });
    expect(within(nav).getByRole("list").getAttribute("aria-label")).toBeNull();
  });

  test("aria-current='step' is on the current item, and only it", () => {
    const { container } = render(<Steps label="Progress" current="payment" steps={checkout} />);
    const current = container.querySelectorAll("[aria-current]");
    expect(current).toHaveLength(1);
    expect(current[0]!.getAttribute("aria-current")).toBe("step");
    expect(current[0]!.textContent).toContain("Payment");
  });

  test("each step states its position and state in words", () => {
    render(<Steps label="Progress" current="payment" steps={checkout} />);
    const items = within(visibleList()).getAllByRole("listitem");
    // The marker's number is aria-hidden; the name is the label with its hidden words.
    expect(items.map((li) => li.querySelector(".rata-steps-label")!.textContent)).toEqual([
      "Step 1 of 3, Shipping, completed",
      "Step 2 of 3, Payment, current",
      "Step 3 of 3, Review, upcoming",
    ]);
  });

  test("markers are aria-hidden", () => {
    const { container } = render(<Steps label="Progress" current="payment" steps={checkout} />);
    container.querySelectorAll(".rata-steps-marker").forEach((marker) => {
      expect(marker.getAttribute("aria-hidden")).toBe("true");
    });
  });

  test("without onStepSelect nothing is a button", () => {
    render(<Steps label="Progress" current="review" steps={checkout} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  test("only reached steps become buttons, and they report their id", () => {
    const onStepSelect = vi.fn();
    render(
      <Steps label="Progress" current="payment" steps={checkout} onStepSelect={onStepSelect} />
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.textContent).toBe("Step 1 of 3, Shipping, completed");
    fireEvent.click(buttons[0]!);
    expect(onStepSelect).toHaveBeenCalledWith("shipping");
  });

  test("an invalid step is a button, marked in the danger role and named as needing attention", () => {
    const steps = [{ id: "details", label: "Your details", invalid: true }, ...checkout.slice(1)];
    render(<Steps label="Application" current="review" steps={steps} onStepSelect={() => {}} />);
    const button = screen.getByRole("button", { name: /Your details, needs attention/ });
    expect(button.closest("li")?.getAttribute("data-status")).toBe("invalid");
  });

  test("navigable steps compose the state layer flush", () => {
    render(<Steps label="Progress" current="review" steps={checkout} onStepSelect={() => {}} />);
    for (const button of screen.getAllByRole("button")) {
      expect(button.className).toContain("rata-state-layer");
      expect(button.className).toContain("rata-state-layer--flush");
      expect(button.getAttribute("type")).toBe("button");
    }
  });

  test("vertical renders no measuring copy and never collapses", () => {
    const { container } = render(
      <Steps label="Profile" orientation="vertical" current="payment" steps={checkout} />
    );
    expect(container.querySelector(".rata-steps-measure")).toBeNull();
    expect(container.querySelector(".rata-steps--vertical")).toBeTruthy();
    expect(container.querySelector("[data-compact]")).toBeNull();
  });

  test("descriptions render under the label", () => {
    const steps = [{ id: "a", label: "Account", description: "Name and email" }];
    render(<Steps label="Setup" orientation="vertical" current="a" steps={steps} />);
    expect(visibleList().textContent).toContain("Name and email");
  });

  test("the measuring copy is hidden and holds nothing focusable", () => {
    const { container } = render(
      <Steps label="Progress" current="review" steps={checkout} onStepSelect={() => {}} />
    );
    const measure = container.querySelector(".rata-steps-measure")!;
    expect(measure.getAttribute("aria-hidden")).toBe("true");
    expect(measure.querySelectorAll("button, a, [tabindex]")).toHaveLength(0);
  });
});

describe("Steps — collapsing by measured overflow", () => {
  /** Fakes layout: the root is `available` wide; the measured steps sum to `needed`. */
  function stubLayout(initial: { available: number; needed: number }) {
    const size = { ...initial };
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement
    ) {
      const measured = this.matches(".rata-steps-measure .rata-steps-item");
      const width = measured ? size.needed / checkout.length : size.available;
      return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON() {} };
    });
    const observers: Array<() => void> = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private readonly cb: () => void) {
          observers.push(() => this.cb());
        }
        observe() {}
        disconnect() {}
      }
    );
    return {
      resize(next: Partial<typeof size>) {
        Object.assign(size, next);
        act(() => observers.forEach((fire) => fire()));
      },
    };
  }

  test("a row that fits renders in full", () => {
    stubLayout({ available: 600, needed: 400 });
    const { container } = render(<Steps label="Progress" current="payment" steps={checkout} />);
    expect(container.querySelector("[data-compact]")).toBeNull();
    expect(container.querySelector(".rata-steps-summary")).toBeNull();
  });

  test("a row that overflows collapses to 'Step N of M', keeping the list whole", () => {
    stubLayout({ available: 200, needed: 400 });
    const { container } = render(<Steps label="Progress" current="payment" steps={checkout} />);
    expect(container.querySelector("[data-compact]")).toBeTruthy();
    const summary = container.querySelector(".rata-steps-summary")!;
    expect(summary.textContent).toBe("Step 2 of 3");
    expect(summary.getAttribute("aria-hidden")).toBe("true");
    expect(within(visibleList()).getAllByRole("listitem")).toHaveLength(3);
  });

  test("re-checks on resize, and expands back when there is room again", () => {
    const layout = stubLayout({ available: 600, needed: 400 });
    const { container } = render(<Steps label="Progress" current="payment" steps={checkout} />);
    expect(container.querySelector("[data-compact]")).toBeNull();
    layout.resize({ available: 300 });
    expect(container.querySelector("[data-compact]")).toBeTruthy();
    layout.resize({ available: 500 });
    expect(container.querySelector("[data-compact]")).toBeNull();
  });

  test("collapsing does not change the measurement, so it cannot oscillate", () => {
    const layout = stubLayout({ available: 300, needed: 400 });
    const { container } = render(<Steps label="Progress" current="payment" steps={checkout} />);
    expect(container.querySelector("[data-compact]")).toBeTruthy();
    // Several observer rounds at the same size leave it compact.
    layout.resize({});
    layout.resize({});
    expect(container.querySelector("[data-compact]")).toBeTruthy();
  });
});
