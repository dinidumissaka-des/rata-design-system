import { describe, expect, test, vi } from "vitest";
import { getSwitchProps } from "./switch.js";

const props = (o: Partial<Parameters<typeof getSwitchProps>[0]> = {}) =>
  getSwitchProps({ id: "notify", ...o });

describe("getSwitchProps", () => {
  test("is a switch, not a checkbox, in how it is announced", () => {
    const p = props();
    expect(p.input.role).toBe("switch");
    expect(p.input.type).toBe("checkbox");
  });

  test("reports its state as on/off rather than checked/unchecked", () => {
    expect(props().root["data-state"]).toBe("off");
    expect(props({ checked: true }).root["data-state"]).toBe("on");
  });

  test("binds the label and derives the description id", () => {
    const p = props({ hasDescription: true });
    expect(p.label.htmlFor).toBe("notify");
    expect(p.description.id).toBe("notify-description");
    expect(p.input["aria-describedby"]).toBe("notify-description");
  });

  test("appends an outside describedBy after its own", () => {
    expect(props({ hasDescription: true, describedBy: "outside" }).input["aria-describedby"]).toBe(
      "notify-description outside"
    );
  });

  test("omits aria-describedby when nothing describes it", () => {
    expect(props().input["aria-describedby"]).toBeUndefined();
  });

  test("activation reports the state it should move to", () => {
    const onCheckedChange = vi.fn();
    props({ checked: false, onCheckedChange }).input.onChange({ preventDefault() {} });
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
  });

  test("disabled refuses activation but stays focusable and announced", () => {
    const onCheckedChange = vi.fn();
    const p = props({ disabled: true, onCheckedChange });
    const event = { preventDefault: vi.fn() };
    p.input.onChange(event);
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(p.input["aria-disabled"]).toBe(true);
    // aria-disabled, never the native attribute.
    expect("disabled" in p.input).toBe(false);
    expect(p.root["data-disabled"]).toBe("");
  });

  test("a disabled click is guarded too, not only the change", () => {
    const event = { preventDefault: vi.fn() };
    props({ disabled: true }).input.onClick(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  test("has no indeterminate state — a setting is on or off", () => {
    expect("indeterminate" in props()).toBe(false);
  });
});
