import { describe, expect, test, vi } from "vitest";
import { getSegmentedControlProps } from "./segmented-control.js";

const OPTIONS = [{ value: "week" }, { value: "month" }, { value: "quarter" }];

const props = (o: Partial<Parameters<typeof getSegmentedControlProps>[0]> = {}) =>
  getSegmentedControlProps({ options: OPTIONS, value: "week", label: "Range", ...o });

const key = (k: string) => ({ key: k, preventDefault: vi.fn() });
const click = () => ({ preventDefault: vi.fn() });

describe("getSegmentedControlProps", () => {
  test("is a radiogroup of radios — a question, not a set of regions", () => {
    const p = props();
    expect(p.root.role).toBe("radiogroup");
    expect(p.option("week").role).toBe("radio");
    expect(p.option("week")["aria-checked"]).toBe(true);
    // Not tabs: nothing here controls a panel, because the value IS the answer.
    expect("aria-controls" in p.option("week")).toBe(false);
  });

  test("naming: label or labelledBy, never both", () => {
    expect(props().root["aria-label"]).toBe("Range");
    const byId = props({ labelledBy: "heading" }).root;
    expect(byId["aria-labelledby"]).toBe("heading");
    expect(byId["aria-label"]).toBeUndefined();
  });

  test("exactly one option is the tab stop", () => {
    const p = props({ value: "month" });
    expect([
      p.option("week").tabIndex,
      p.option("month").tabIndex,
      p.option("quarter").tabIndex,
    ]).toEqual([-1, 0, -1]);
  });

  test("arrows select as they move, wrapping, on either axis", () => {
    // Both axes accepted deliberately, and no aria-orientation announced: the
    // bar is horizontal by construction, so a reader trying the wrong pair
    // should not be stuck.
    for (const k of ["ArrowRight", "ArrowDown"]) {
      const onValueChange = vi.fn();
      props({ onValueChange }).root.onKeyDown(key(k));
      expect(onValueChange, k).toHaveBeenCalledWith("month");
    }
    for (const k of ["ArrowLeft", "ArrowUp"]) {
      const onValueChange = vi.fn();
      props({ onValueChange }).root.onKeyDown(key(k));
      expect(onValueChange, k).toHaveBeenCalledWith("quarter");
    }
    expect(props().root).not.toHaveProperty("aria-orientation");
  });

  test("Home and End jump to the ends", () => {
    const onValueChange = vi.fn();
    props({ value: "month", onValueChange }).root.onKeyDown(key("End"));
    expect(onValueChange).toHaveBeenLastCalledWith("quarter");
    props({ value: "month", onValueChange }).root.onKeyDown(key("Home"));
    expect(onValueChange).toHaveBeenLastCalledWith("week");
  });

  test("it cannot be cleared — re-picking the answer is not a change", () => {
    // The narrower API is the point: a segmented control with nothing chosen
    // is a different control, and this one cannot express it.
    const onValueChange = vi.fn();
    props({ onValueChange }).option("week").onClick(click());
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("a disabled option is reachable and announced, but never the answer", () => {
    const items = [{ value: "a" }, { value: "b", disabled: true }, { value: "c" }];
    const onFocusValue = vi.fn();
    const onValueChange = vi.fn();
    const p = getSegmentedControlProps({
      options: items,
      value: "a",
      onFocusValue,
      onValueChange,
    });
    p.root.onKeyDown(key("ArrowRight"));
    expect(onFocusValue).toHaveBeenCalledWith("b");
    expect(onValueChange).not.toHaveBeenCalled();

    const event = click();
    p.option("b").onClick(event);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(p.option("b")["aria-disabled"]).toBe(true);
    // Never the native attribute.
    expect("disabled" in p.option("b")).toBe(false);
  });

  test("clicking an option focuses it and makes it the answer", () => {
    const onFocusValue = vi.fn();
    const onValueChange = vi.fn();
    props({ onFocusValue, onValueChange }).option("quarter").onClick(click());
    expect(onFocusValue).toHaveBeenCalledWith("quarter");
    expect(onValueChange).toHaveBeenCalledWith("quarter");
  });

  test("an empty control ignores every key instead of throwing", () => {
    const p = getSegmentedControlProps({ options: [], value: "" });
    p.root.onKeyDown(key("ArrowRight"));
    p.root.onKeyDown(key("Home"));
  });
});
