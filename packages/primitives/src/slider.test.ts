import { describe, expect, test, vi } from "vitest";
import { getSliderProps, snapToStep } from "./slider.js";

const props = (o: Partial<Parameters<typeof getSliderProps>[0]> = {}) =>
  getSliderProps({ id: "s", value: 40, ...o });

const key = (k: string) => ({ key: k, preventDefault: vi.fn() });

describe("snapToStep", () => {
  test("snaps from min onto the grid and clamps", () => {
    expect(snapToStep(37, 0, 100, 5)).toBe(35);
    expect(snapToStep(38, 0, 100, 5)).toBe(40);
    expect(snapToStep(0.30000000000000004, 0, 1, 0.1)).toBe(0.3);
    expect(snapToStep(120, 0, 100, 1)).toBe(100);
    expect(snapToStep(3, 1, 10, 2)).toBe(3);
  });
});

describe("getSliderProps", () => {
  test("one thumb is one native range input with the bounds and step", () => {
    const p = props({ min: 0, max: 200, step: 10 });
    expect(p.range).toBe(false);
    expect(p.group).toBeNull();
    expect(p.thumbs).toHaveLength(1);
    const input = p.thumbs[0]!.input;
    expect(input.type).toBe("range");
    expect(input.id).toBe("s");
    expect([input.min, input.max, input.step, input.value]).toEqual([0, 200, 10, "40"]);
    expect(input["aria-label"]).toBeUndefined();
  });

  test("defaults to 0..100 by 1", () => {
    const input = props().thumbs[0]!.input;
    expect([input.min, input.max, input.step]).toEqual([0, 100, 1]);
  });

  test("formatValue is the valuetext and the output", () => {
    const p = props({ formatValue: (v) => `${v}%` });
    expect(p.thumbs[0]!.input["aria-valuetext"]).toBe("40%");
    expect(p.output).toBe("40%");
    expect(props().thumbs[0]!.input["aria-valuetext"]).toBeUndefined();
    expect(props().output).toBe("40");
  });

  test("a tuple is a labelled group of two named thumbs", () => {
    const p = props({ value: [10, 90], thumbLabels: ["Minimum price", "Maximum price"] });
    expect(p.range).toBe(true);
    expect(p.group).toEqual({ role: "group" });
    expect(p.thumbs.map((t) => t.input["aria-label"])).toEqual(["Minimum price", "Maximum price"]);
    expect(p.thumbs.map((t) => t.input.id)).toEqual(["s", "s-end"]);
    expect(p.output).toBe("10 – 90");
  });

  test("the fill runs from min to the thumb, or between two", () => {
    expect(props({ value: 25 }).fill).toEqual({ start: 0, end: 0.25 });
    expect(props({ value: [20, 60] }).fill).toEqual({ start: 0.2, end: 0.6 });
    expect(props({ value: [20, 60] }).split).toBe(0.4);
  });

  test("a change is snapped to the step", () => {
    const onValueChange = vi.fn();
    props({ step: 5, onValueChange }).thumbs[0]!.input.onChange({ target: { value: "52" } });
    expect(onValueChange).toHaveBeenCalledWith(50);
  });

  test("two thumbs cannot cross: each is limited by the other's value", () => {
    const onValueChange = vi.fn();
    const p = props({ value: [30, 60], onValueChange });
    p.thumbs[0]!.input.onChange({ target: { value: "80" } });
    p.thumbs[1]!.input.onChange({ target: { value: "10" } });
    expect(onValueChange.mock.calls.map((c) => c[0])).toEqual([
      [60, 60],
      [30, 30],
    ]);
  });

  test("PageUp and PageDown move ten steps and commit", () => {
    const onValueChange = vi.fn();
    const onValueCommit = vi.fn();
    const p = props({ value: 40, step: 2, onValueChange, onValueCommit });
    const up = key("PageUp");
    p.thumbs[0]!.input.onKeyDown(up);
    expect(up.preventDefault).toHaveBeenCalled();
    expect(onValueChange).toHaveBeenLastCalledWith(60);
    expect(onValueCommit).toHaveBeenLastCalledWith(60);
    p.thumbs[0]!.input.onKeyDown(key("PageDown"));
    expect(onValueCommit).toHaveBeenLastCalledWith(20);
  });

  test("arrow keys are left to the platform", () => {
    const e = key("ArrowRight");
    props().thumbs[0]!.input.onKeyDown(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test("the native change event commits once, with the whole value", () => {
    const onValueCommit = vi.fn();
    props({ value: [10, 50], onValueCommit }).thumbs[1]!.input.onCommit("70");
    expect(onValueCommit).toHaveBeenCalledWith([10, 70]);
  });

  test("hover and press on the input are reported, and drawn on the thumb", () => {
    const onHoveredChange = vi.fn();
    const onPressedChange = vi.fn();
    const p = props({ onHoveredChange, onPressedChange });
    p.thumbs[0]!.input.onPointerEnter();
    p.thumbs[0]!.input.onPointerDown({ preventDefault: vi.fn() });
    p.thumbs[0]!.input.onPointerUp();
    p.thumbs[0]!.input.onPointerLeave();
    expect(onHoveredChange.mock.calls).toEqual([
      [0, true],
      [0, false],
    ]);
    expect(onPressedChange.mock.calls).toEqual([
      [0, true],
      [0, false],
    ]);
    const drawn = props({ hovered: [true, false], pressed: [true, false] }).thumbs[0]!.thumb;
    expect(drawn).toEqual({ "data-hovered": "", "data-pressed": "" });
  });

  test("disabled: aria-disabled, keys and pointer refused, a slipped change reverted", () => {
    const onValueChange = vi.fn();
    const onValueCommit = vi.fn();
    const onPressedChange = vi.fn();
    const p = props({ disabled: true, onValueChange, onValueCommit, onPressedChange, hovered: [true, false] });
    const input = p.thumbs[0]!.input;
    expect(input["aria-disabled"]).toBe(true);
    const e = key("ArrowRight");
    input.onKeyDown(e);
    expect(e.preventDefault).toHaveBeenCalled();
    const down = { preventDefault: vi.fn() };
    input.onPointerDown(down);
    expect(down.preventDefault).toHaveBeenCalled();
    expect(onPressedChange).not.toHaveBeenCalled();
    input.onChange({ target: { value: "90" } });
    input.onCommit("90");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onValueCommit).not.toHaveBeenCalled();
    // No feedback on a control that will not move.
    expect(p.thumbs[0]!.thumb["data-hovered"]).toBeUndefined();
  });

  test("a range submits two values under one name, lower first", () => {
    const p = props({ value: [10, 90], name: "price" });
    expect(p.thumbs.map((t) => [t.input.name, t.input.value])).toEqual([
      ["price", "10"],
      ["price", "90"],
    ]);
  });
});
