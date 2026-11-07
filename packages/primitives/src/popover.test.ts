import { describe, expect, test, vi } from "vitest";
import {
  getPopoverProps,
  popoverCloseReasonForFocus,
  popoverReturnsFocus,
} from "./popover.js";

const props = (o: Partial<Parameters<typeof getPopoverProps>[0]> = {}) =>
  getPopoverProps({ triggerId: "t", popoverId: "p", titleId: "h", ...o });

const key = (k: string) => ({ key: k, preventDefault: vi.fn() });
const click = () => ({ preventDefault: vi.fn() });

describe("popover core", () => {
  test("only focus reaching a control outside closes it", () => {
    expect(popoverCloseReasonForFocus("outside")).toBe("tab");
    // Shift+Tab back to the trigger, a click on the popover's own text, the
    // window losing focus: none of these is leaving.
    expect(popoverCloseReasonForFocus("inside")).toBeNull();
    expect(popoverCloseReasonForFocus("trigger")).toBeNull();
    expect(popoverCloseReasonForFocus("nowhere")).toBeNull();
  });

  test("only Escape returns focus to the trigger", () => {
    expect(popoverReturnsFocus("escape")).toBe(true);
    // The reader chose a new place; taking focus back would undo it.
    expect(popoverReturnsFocus("tab")).toBe(false);
    expect(popoverReturnsFocus("dismiss")).toBe(false);
    expect(popoverReturnsFocus("trigger")).toBe(false);
  });
});

describe("getPopoverProps", () => {
  test("the trigger says what it controls and whether it is showing", () => {
    const closed = props().trigger;
    expect(closed["aria-expanded"]).toBe(false);
    expect(closed["aria-controls"]).toBe("p");
    expect(props({ open: true }).trigger["aria-expanded"]).toBe(true);
  });

  test("the trigger does not claim aria-haspopup", () => {
    // Announced inconsistently for "dialog" — decided at gate 1.
    expect("aria-haspopup" in props().trigger).toBe(false);
  });

  test("the popover is a non-modal dialog named by its title", () => {
    const surface = props().popover;
    expect(surface.role).toBe("dialog");
    expect(surface.id).toBe("p");
    expect(surface["aria-labelledby"]).toBe("h");
    expect(props().title.id).toBe("h");
    expect("aria-modal" in surface).toBe(false);
  });

  test("the trigger toggles", () => {
    const opening = vi.fn();
    props({ onOpenChange: opening }).trigger.onClick(click());
    expect(opening).toHaveBeenCalledWith(true, "trigger");

    const closing = vi.fn();
    props({ open: true, onOpenChange: closing }).trigger.onClick(click());
    expect(closing).toHaveBeenCalledWith(false, "trigger");
  });

  test("Escape closes it from the popover or from the trigger", () => {
    for (const from of ["trigger", "popover"] as const) {
      const onOpenChange = vi.fn();
      const event = key("Escape");
      props({ open: true, onOpenChange })[from].onKeyDown(event);
      expect(onOpenChange).toHaveBeenCalledWith(false, "escape");
      expect(event.preventDefault).toHaveBeenCalled();
    }
  });

  test("Escape is left alone while closed", () => {
    const onOpenChange = vi.fn();
    const event = key("Escape");
    props({ onOpenChange }).trigger.onKeyDown(event);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test("Tab is not a close in itself — only focus leaving is", () => {
    // Several controls live inside; only the last Tab leaves.
    const onOpenChange = vi.fn();
    const event = key("Tab");
    const p = props({ open: true, onOpenChange });
    p.popover.onKeyDown(event);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();

    p.focusMoved("inside");
    p.focusMoved("trigger");
    p.focusMoved("nowhere");
    expect(onOpenChange).not.toHaveBeenCalled();
    p.focusMoved("outside");
    expect(onOpenChange).toHaveBeenCalledWith(false, "tab");
  });

  test("light-dismiss is reported with its own reason", () => {
    const onOpenChange = vi.fn();
    props({ open: true, onOpenChange }).dismissed();
    expect(onOpenChange).toHaveBeenCalledWith(false, "dismiss");
  });

  test("a closed popover reports nothing for focus moves or dismissal", () => {
    const onOpenChange = vi.fn();
    const p = props({ onOpenChange });
    p.focusMoved("outside");
    p.dismissed();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  test("no focus trap and no roving tabindex", () => {
    const p = props({ open: true });
    expect("tabIndex" in p.popover).toBe(false);
    expect("tabIndex" in p.trigger).toBe(false);
  });
});
