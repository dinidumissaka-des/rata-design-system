import { describe, expect, test, vi } from "vitest";
import { getCheckboxProps } from "./checkbox.js";

const props = (o: Parameters<typeof getCheckboxProps>[0]) => getCheckboxProps(o);

describe("getCheckboxProps", () => {
  test("binds the label to the input and derives the description id", () => {
    const p = props({ id: "agree", hasDescription: true });
    expect(p.label.htmlFor).toBe("agree");
    expect(p.input.id).toBe("agree");
    expect(p.description.id).toBe("agree-description");
    expect(p.input["aria-describedby"]).toBe("agree-description");
  });

  test("omits aria-describedby when there is nothing describing it", () => {
    expect(props({ id: "a" }).input["aria-describedby"]).toBeUndefined();
  });

  test("appends an outside describedBy after the component's own", () => {
    const p = props({ id: "a", hasDescription: true, describedBy: "outside" });
    expect(p.input["aria-describedby"]).toBe("a-description outside");
  });

  test("data-state reports the three appearances", () => {
    expect(props({ id: "a" }).root["data-state"]).toBe("unchecked");
    expect(props({ id: "a", checked: true }).root["data-state"]).toBe("checked");
    expect(props({ id: "a", indeterminate: true }).root["data-state"]).toBe("indeterminate");
  });

  test("indeterminate outranks checked in what is shown", () => {
    const p = props({ id: "a", checked: true, indeterminate: true });
    expect(p.root["data-state"]).toBe("indeterminate");
    // ...but the underlying checked value is untouched, so clearing
    // indeterminate reveals it rather than inventing one.
    expect(p.input.checked).toBe(true);
    expect(p.indeterminate).toBe(true);
  });

  test("activating an indeterminate box resolves to checked", () => {
    const onCheckedChange = vi.fn();
    props({ id: "a", checked: false, indeterminate: true, onCheckedChange }).input.onChange({
      preventDefault() {},
    });
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
  });

  test("activation toggles from the current value otherwise", () => {
    const onCheckedChange = vi.fn();
    props({ id: "a", checked: true, onCheckedChange }).input.onChange({ preventDefault() {} });
    expect(onCheckedChange).toHaveBeenCalledWith(false, expect.anything());
  });

  test("disabled refuses activation but stays focusable and announced", () => {
    const onCheckedChange = vi.fn();
    const p = props({ id: "a", disabled: true, onCheckedChange });
    const event = { preventDefault: vi.fn() };
    p.input.onChange(event);
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
    // aria-disabled, never the native attribute — there is no `disabled` here.
    expect(p.input["aria-disabled"]).toBe(true);
    expect("disabled" in p.input).toBe(false);
    expect(p.root["data-disabled"]).toBe("");
  });

  test("a disabled click is guarded too, not only the change", () => {
    const event = { preventDefault: vi.fn() };
    props({ id: "a", disabled: true }).input.onClick(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  test("required is announced and absent when not set", () => {
    expect(props({ id: "a", required: true }).input["aria-required"]).toBe(true);
    expect(props({ id: "a" }).input["aria-required"]).toBeUndefined();
  });
});
