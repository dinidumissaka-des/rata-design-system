import { describe, expect, test, vi } from "vitest";
import { getDisclosureProps } from "./disclosure.js";

const props = (o: Partial<Parameters<typeof getDisclosureProps>[0]> = {}) =>
  getDisclosureProps({ triggerId: "t", panelId: "p", ...o });

const key = (k: string) => ({ key: k, preventDefault: vi.fn() });
const click = () => ({ preventDefault: vi.fn() });

describe("getDisclosureProps", () => {
  test("the trigger says what it controls and whether it is showing", () => {
    const closed = props().trigger;
    expect(closed.type).toBe("button");
    expect(closed["aria-expanded"]).toBe(false);
    expect(closed["aria-controls"]).toBe("p");
    expect(props({ open: true }).trigger["aria-expanded"]).toBe(true);
  });

  test("aria-controls is present even while closed", () => {
    // The relationship is a fact about the markup; a reference that appears
    // and disappears is one assistive technology has to re-read to discover.
    expect(props({ open: false }).trigger["aria-controls"]).toBe("p");
  });

  test("the panel is named by its trigger rather than being anonymous", () => {
    expect(props().panel["aria-labelledby"]).toBe("t");
    expect(props().panel.id).toBe("p");
  });

  test("it is NOT a menu: no roving tabindex and no typeahead", () => {
    // The whole point of the pattern. A menu promises a keyboard model that a
    // list of links does not have, and announcing one is how a nav dropdown
    // ends up misdescribing itself.
    const p = props({ open: true });
    expect("tabIndex" in p.trigger).toBe(false);
    expect("role" in p.trigger).toBe(false);
    expect("role" in p.panel).toBe(false);

    const onOpenChange = vi.fn();
    // A printable key is just a keystroke here, not a jump to a matching item.
    props({ open: true, onOpenChange }).panel.onKeyDown(key("d"));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  test("the trigger toggles", () => {
    const onOpenChange = vi.fn();
    props({ onOpenChange }).trigger.onClick(click());
    expect(onOpenChange).toHaveBeenCalledWith(true, "trigger");

    const closing = vi.fn();
    props({ open: true, onOpenChange: closing }).trigger.onClick(click());
    expect(closing).toHaveBeenCalledWith(false, "trigger");
  });

  test("Escape closes the panel from EITHER the trigger or the panel", () => {
    // Both, because a disclosure does not move focus when it opens — that is
    // the difference between it and a menu. After the trigger is pressed,
    // focus is still on the trigger, so a handler only on the panel never runs
    // in the commonest case.
    for (const from of ["trigger", "panel"] as const) {
      const onOpenChange = vi.fn();
      const event = key("Escape");
      props({ open: true, onOpenChange })[from].onKeyDown(event);
      expect(onOpenChange, from).toHaveBeenCalledWith(false, "escape");
      expect(event.preventDefault, from).toHaveBeenCalled();
    }
  });

  test("a closed panel ignores Escape, leaving it for whatever is around it", () => {
    const onOpenChange = vi.fn();
    const event = key("Escape");
    props({ open: false, onOpenChange }).trigger.onKeyDown(event);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test("disabled refuses to open and says so", () => {
    const onOpenChange = vi.fn();
    const event = click();
    const p = props({ disabled: true, onOpenChange });
    p.trigger.onClick(event);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(p.trigger["aria-disabled"]).toBe(true);
  });
});
