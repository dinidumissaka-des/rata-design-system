import { describe, expect, test, vi } from "vitest";
import { getRadioGroupProps } from "./radio-group.js";

const base = { values: ["a", "b", "c"], name: "choice" } as const;
const props = (o: Partial<Parameters<typeof getRadioGroupProps>[0]> = {}) =>
  getRadioGroupProps({ ...base, ...o });

describe("getRadioGroupProps", () => {
  test("is a radiogroup and announces its orientation", () => {
    const p = props({ label: "Billing" });
    expect(p.root.role).toBe("radiogroup");
    expect(p.root["aria-label"]).toBe("Billing");
    expect(p.root["aria-orientation"]).toBe("vertical");
  });

  test("labelledBy replaces the label rather than joining it", () => {
    const p = props({ label: "ignored", labelledBy: "heading" });
    expect(p.root["aria-labelledby"]).toBe("heading");
    expect(p.root["aria-label"]).toBeUndefined();
  });

  test("every item shares the group's name — that is what makes them exclusive", () => {
    const p = props();
    expect(["a", "b", "c"].map((v) => p.item(v).name)).toEqual(["choice", "choice", "choice"]);
  });

  test("only the chosen value is checked", () => {
    const p = props({ value: "b" });
    expect(["a", "b", "c"].map((v) => p.item(v).checked)).toEqual([false, true, false]);
  });

  test("the checked option is the tab stop", () => {
    const p = props({ value: "b" });
    expect(["a", "b", "c"].map((v) => p.item(v).tabIndex)).toEqual([-1, 0, -1]);
  });

  test("an unanswered group is entered at its first enabled option", () => {
    const p = props({ disabledValues: ["a"] });
    expect(p.item("a").tabIndex).toBe(-1);
    expect(p.item("b").tabIndex).toBe(0);
  });

  test("arrow keys move and select as they go", () => {
    const onValueChange = vi.fn();
    const onFocusValue = vi.fn();
    props({ value: "a", onValueChange, onFocusValue }).root.onKeyDown({
      key: "ArrowDown",
      preventDefault() {},
    });
    expect(onFocusValue).toHaveBeenCalledWith("b");
    expect(onValueChange).toHaveBeenCalledWith("b");
  });

  test("both axes move, so no arrow is a dead end", () => {
    const onFocusValue = vi.fn();
    const p = props({ value: "a", orientation: "vertical", onFocusValue });
    p.root.onKeyDown({ key: "ArrowRight", preventDefault() {} });
    expect(onFocusValue).toHaveBeenCalledWith("b");
  });

  test("arrows wrap at both ends", () => {
    const onFocusValue = vi.fn();
    props({ value: "a", onFocusValue }).root.onKeyDown({ key: "ArrowUp", preventDefault() {} });
    expect(onFocusValue).toHaveBeenCalledWith("c");
  });

  test("Home and End jump to the ends", () => {
    const onFocusValue = vi.fn();
    const p = props({ value: "b", onFocusValue });
    p.root.onKeyDown({ key: "End", preventDefault() {} });
    expect(onFocusValue).toHaveBeenLastCalledWith("c");
    p.root.onKeyDown({ key: "Home", preventDefault() {} });
    expect(onFocusValue).toHaveBeenLastCalledWith("a");
  });

  test("a disabled option takes focus but never becomes the answer", () => {
    const onValueChange = vi.fn();
    const onFocusValue = vi.fn();
    props({ value: "a", disabledValues: ["b"], onValueChange, onFocusValue }).root.onKeyDown({
      key: "ArrowDown",
      preventDefault() {},
    });
    expect(onFocusValue).toHaveBeenCalledWith("b");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("clicking a disabled option is refused", () => {
    const onValueChange = vi.fn();
    const p = props({ disabledValues: ["b"], onValueChange });
    const event = { preventDefault: vi.fn() };
    p.item("b").onChange(event);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(p.item("b")["aria-disabled"]).toBe(true);
  });

  test("a disabled group disables every option but keeps them reachable", () => {
    const onValueChange = vi.fn();
    const p = props({ disabled: true, onValueChange });
    for (const v of ["a", "b", "c"]) expect(p.item(v)["aria-disabled"]).toBe(true);
    p.item("a").onChange({ preventDefault() {} });
    expect(onValueChange).not.toHaveBeenCalled();
    // Still has a tab stop, so the group can be found and read.
    expect(["a", "b", "c"].some((v) => p.item(v).tabIndex === 0)).toBe(true);
  });

  test("re-selecting the current value reports nothing — there is no deselect", () => {
    const onValueChange = vi.fn();
    props({ value: "b", onValueChange }).item("b").onChange({ preventDefault() {} });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("keys it does not handle are left alone", () => {
    const event = { key: "Tab", preventDefault: vi.fn() };
    props({ value: "a" }).root.onKeyDown(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test("an empty group does not throw on arrow keys", () => {
    expect(() =>
      getRadioGroupProps({ values: [], name: "n" }).root.onKeyDown({
        key: "ArrowDown",
        preventDefault() {},
      })
    ).not.toThrow();
  });

  test("required is announced on the group, not on each option", () => {
    expect(props({ required: true }).root["aria-required"]).toBe(true);
    expect(props().root["aria-required"]).toBeUndefined();
  });
});
