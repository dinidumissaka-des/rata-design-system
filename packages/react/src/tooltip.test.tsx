import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button.js";
import { Tooltip } from "./tooltip.js";
import { installPopoverShim } from "./test-support.js";

/**
 * jsdom implements neither the popover API nor a top layer. See
 * test-support.ts for what the shim does and does not pretend to have.
 */
beforeAll(installPopoverShim);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.documentElement.style.removeProperty("--rata-motion-delay-hint");
});

const hint = () => screen.getByRole("tooltip", { hidden: true });
const showing = () => hint().matches(":popover-open");

const Labelled = () => (
  <>
    <Tooltip content="Copy token path" relationship="label">
      <Button variant="tertiary" iconOnly aria-label="Copy token path">
        C
      </Button>
    </Tooltip>
    <button type="button">After</button>
  </>
);

const Described = () => (
  <>
    <button type="button">Before</button>
    <Tooltip content="Add a payment method to publish">
      <Button disabled>Publish</Button>
    </Tooltip>
  </>
);

describe("Tooltip", () => {
  test("label: the hint names the trigger through aria-labelledby", () => {
    render(<Labelled />);
    const button = screen.getByRole("button", { name: "Copy token path" });
    expect(button.getAttribute("aria-labelledby")).toBe(hint().id);
    expect(button.getAttribute("aria-describedby")).toBeNull();
    // aria-labelledby wins over aria-label, so the name is read once.
    expect(button.getAttribute("aria-label")).toBe("Copy token path");
  });

  test("description is the default, and is announced after the name", () => {
    render(<Described />);
    const button = screen.getByRole("button", { name: "Publish" });
    expect(button.getAttribute("aria-describedby")).toBe(hint().id);
    expect(button.getAttribute("aria-labelledby")).toBeNull();
  });

  test("the hint is role=tooltip in the top layer, never focusable, and always mounted", () => {
    render(<Described />);
    expect(hint().getAttribute("popover")).toMatch(/^(hint|manual)$/);
    expect(hint().getAttribute("tabindex")).toBeNull();
    expect(hint().textContent).toBe("Add a payment method to publish");
    expect(showing()).toBe(false);
  });

  test("keyboard focus opens it immediately; leaving closes it", async () => {
    document.documentElement.style.setProperty("--rata-motion-delay-hint", "280ms");
    render(<Described />);
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Publish" }));
    expect(showing()).toBe(true);
    await userEvent.tab({ shift: true });
    expect(showing()).toBe(false);
  });

  test("it works on an aria-disabled control, which stays focusable", async () => {
    render(<Described />);
    const button = screen.getByRole("button", { name: "Publish" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    act(() => button.focus());
    expect(showing()).toBe(true);
  });

  test("pointer hover waits for motion.delay.hint, read from the token", () => {
    vi.useFakeTimers();
    document.documentElement.style.setProperty("--rata-motion-delay-hint", "280ms");
    render(<Described />);
    const button = screen.getByRole("button", { name: "Publish" });
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(279));
    expect(showing()).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(showing()).toBe(true);
  });

  test("a pointer that leaves during the delay never shows it", () => {
    vi.useFakeTimers();
    document.documentElement.style.setProperty("--rata-motion-delay-hint", "280ms");
    render(<Described />);
    const button = screen.getByRole("button", { name: "Publish" });
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(500));
    expect(showing()).toBe(false);
  });

  test("touch never draws it — and the tap's focus does not either", () => {
    render(<Described />);
    const button = screen.getByRole("button", { name: "Publish" });
    fireEvent.pointerEnter(button, { pointerType: "touch" });
    fireEvent.pointerDown(button, { pointerType: "touch" });
    act(() => button.focus());
    expect(showing()).toBe(false);
    // The name is still wired, so a screen-reader user hears it anyway.
    expect(button.getAttribute("aria-describedby")).toBe(hint().id);
  });

  test("hoverable: moving from the trigger onto the hint keeps it open", () => {
    render(<Described />);
    const button = screen.getByRole("button", { name: "Publish" });
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    expect(showing()).toBe(true);
    fireEvent.pointerLeave(button, { pointerType: "mouse", relatedTarget: hint() });
    fireEvent.pointerEnter(hint(), { pointerType: "mouse" });
    expect(showing()).toBe(true);
    fireEvent.pointerLeave(hint(), { pointerType: "mouse", relatedTarget: document.body });
    expect(showing()).toBe(false);
  });

  test("dismissible: Escape closes it from anywhere without moving focus", () => {
    render(<Labelled />);
    const button = screen.getByRole("button", { name: "Copy token path" });
    const after = screen.getByRole("button", { name: "After" });
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    act(() => after.focus());
    expect(showing()).toBe(true);
    fireEvent.keyDown(after, { key: "Escape" });
    expect(showing()).toBe(false);
    expect(document.activeElement).toBe(after);
  });

  test("the first Escape is the hint's alone", () => {
    const outer = vi.fn();
    render(
      <div onKeyDown={outer}>
        <Labelled />
      </div>
    );
    const button = screen.getByRole("button", { name: "Copy token path" });
    act(() => button.focus());
    fireEvent.keyDown(button, { key: "Escape" });
    expect(showing()).toBe(false);
    expect(outer).not.toHaveBeenCalled();
    // Closed, so the next Escape belongs to whatever is around it.
    fireEvent.keyDown(button, { key: "Escape" });
    expect(outer).toHaveBeenCalledOnce();
  });

  test("the platform closing a hint is respected until a fresh hover", () => {
    render(<Described />);
    const button = screen.getByRole("button", { name: "Publish" });
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    act(() => hint().hidePopover());
    expect(showing()).toBe(false);
    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    expect(showing()).toBe(true);
  });

  test("placement is a modifier class; block-start is the default and has none", () => {
    const { rerender } = render(
      <Tooltip content="Hint">
        <Button>Go</Button>
      </Tooltip>
    );
    expect(hint().className).toBe("rata-tooltip");
    rerender(
      <Tooltip content="Hint" placement="inline-end">
        <Button>Go</Button>
      </Tooltip>
    );
    expect(hint().className).toBe("rata-tooltip rata-tooltip--inline-end");
  });

  test("each tooltip gets its own anchor name, shared by trigger and hint", () => {
    render(
      <>
        <Tooltip content="One">
          <Button>First</Button>
        </Tooltip>
        <Tooltip content="Two">
          <Button>Second</Button>
        </Tooltip>
      </>
    );
    const names = screen
      .getAllByRole("button")
      .map((b) => b.style.getPropertyValue("--rata-tooltip-anchor"));
    expect(names[0]).toMatch(/^--rata-tooltip-[A-Za-z0-9_-]+$/);
    expect(names[0]).not.toBe(names[1]);
    const hints = screen.getAllByRole("tooltip", { hidden: true });
    expect(hints[0]!.style.getPropertyValue("--rata-tooltip-anchor")).toBe(names[0]);
  });

  test("the trigger keeps its own handlers, style and description", () => {
    const onFocus = vi.fn();
    const onPointerEnter = vi.fn();
    render(
      <>
        <span id="extra">Extra</span>
        <Tooltip content="Hint">
          <Button
            style={{ marginTop: "4px" }}
            aria-describedby="extra"
            onFocus={onFocus}
            onPointerEnter={onPointerEnter}
          >
            Go
          </Button>
        </Tooltip>
      </>
    );
    const button = screen.getByRole("button", { name: "Go" });
    expect(button.style.marginTop).toBe("4px");
    expect(button.getAttribute("aria-describedby")).toBe(`extra ${hint().id}`);
    act(() => button.focus());
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    expect(onFocus).toHaveBeenCalledOnce();
    expect(onPointerEnter).toHaveBeenCalledOnce();
  });
});
