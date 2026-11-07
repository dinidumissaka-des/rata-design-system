import { describe, expect, test, vi } from "vitest";
import {
  getTooltipProps,
  tooltipInitialState,
  tooltipIsOpen,
  tooltipOpenIsDelayed,
  tooltipReducer,
  tooltipShowsForPointer,
} from "./tooltip.js";
import type { TooltipEvent, TooltipState } from "./tooltip.js";

const run = (...events: TooltipEvent[]): TooltipState =>
  events.reduce(tooltipReducer, tooltipInitialState);

const hover = (pointerType = "mouse"): TooltipEvent => ({
  type: "pointer-enter",
  target: "trigger",
  pointerType,
});
const keyboardFocus: TooltipEvent = { type: "focus", modality: "keyboard" };

describe("tooltip core", () => {
  test("hover and keyboard focus each open it", () => {
    expect(tooltipIsOpen(run(hover()))).toBe(true);
    expect(tooltipIsOpen(run(keyboardFocus))).toBe(true);
    expect(tooltipIsOpen(tooltipInitialState)).toBe(false);
  });

  test("only the pointer waits for the delay; focus opens immediately", () => {
    expect(tooltipOpenIsDelayed(hover())).toBe(true);
    expect(tooltipOpenIsDelayed(keyboardFocus)).toBe(false);
  });

  test("touch never draws it; a pen that hovers does", () => {
    expect(tooltipShowsForPointer("touch")).toBe(false);
    expect(tooltipShowsForPointer("pen")).toBe(true);
    expect(tooltipIsOpen(run(hover("touch")))).toBe(false);
    expect(tooltipIsOpen(run(hover("pen")))).toBe(true);
  });

  test("focus from a press or a tap is not keyboard focus", () => {
    expect(tooltipIsOpen(run({ type: "focus", modality: "pointer" }))).toBe(false);
    expect(tooltipIsOpen(run({ type: "focus", modality: "touch" }))).toBe(false);
  });

  test("hoverable: crossing between trigger and hint does not close it", () => {
    const onHint = run(hover(), { type: "pointer-leave", to: "tooltip" });
    expect(tooltipIsOpen(onHint)).toBe(true);
    const back = tooltipReducer(onHint, { type: "pointer-leave", to: "trigger" });
    expect(tooltipIsOpen(back)).toBe(true);
    expect(tooltipIsOpen(tooltipReducer(back, { type: "pointer-leave", to: "outside" }))).toBe(
      false
    );
  });

  test("persistent: open while either hover or keyboard focus holds it", () => {
    const both = run(keyboardFocus, hover());
    expect(tooltipIsOpen(tooltipReducer(both, { type: "pointer-leave", to: "outside" }))).toBe(
      true
    );
    expect(tooltipIsOpen(tooltipReducer(both, { type: "blur" }))).toBe(true);
    expect(tooltipIsOpen(run(keyboardFocus, { type: "blur" }))).toBe(false);
  });

  test("dismissible: Escape closes it until a fresh hover or focus", () => {
    const escaped = run(hover(), { type: "escape" });
    expect(tooltipIsOpen(escaped)).toBe(false);
    // Moving onto the hint is not a new request — and it is not painted.
    expect(
      tooltipIsOpen(
        tooltipReducer(escaped, { type: "pointer-enter", target: "tooltip", pointerType: "mouse" })
      )
    ).toBe(false);
    const left = tooltipReducer(escaped, { type: "pointer-leave", to: "outside" });
    expect(tooltipIsOpen(tooltipReducer(left, hover()))).toBe(true);
    expect(tooltipIsOpen(tooltipReducer(escaped, keyboardFocus))).toBe(true);
  });

  test("the platform's own dismissal behaves like Escape", () => {
    expect(tooltipIsOpen(run(keyboardFocus, { type: "dismiss" }))).toBe(false);
  });

  test("entering the hint while it is closed does not open it", () => {
    expect(
      tooltipIsOpen(run({ type: "pointer-enter", target: "tooltip", pointerType: "mouse" }))
    ).toBe(false);
  });
});

describe("getTooltipProps", () => {
  const key = (k: string) => ({ key: k, preventDefault: vi.fn(), stopPropagation: vi.fn() });

  test("description is the default and wires aria-describedby", () => {
    const props = getTooltipProps({ tooltipId: "tip" });
    expect(props.trigger).toEqual({ "aria-describedby": "tip" });
    expect(props.tooltip).toEqual({ id: "tip", role: "tooltip" });
  });

  test("label wires aria-labelledby instead", () => {
    expect(getTooltipProps({ tooltipId: "tip", relationship: "label" }).trigger).toEqual({
      "aria-labelledby": "tip",
    });
  });

  test("Escape while open is consumed and reported", () => {
    const onEvent = vi.fn();
    const event = key("Escape");
    expect(getTooltipProps({ tooltipId: "t", open: true, onEvent }).onKeyDown(event)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(onEvent).toHaveBeenCalledWith({ type: "escape" });
  });

  test("Escape while closed, and other keys, are left alone", () => {
    const onEvent = vi.fn();
    const closed = key("Escape");
    expect(getTooltipProps({ tooltipId: "t", onEvent }).onKeyDown(closed)).toBe(false);
    expect(closed.preventDefault).not.toHaveBeenCalled();
    const other = key("Enter");
    expect(getTooltipProps({ tooltipId: "t", open: true, onEvent }).onKeyDown(other)).toBe(false);
    expect(onEvent).not.toHaveBeenCalled();
  });
});
