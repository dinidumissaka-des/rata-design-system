import { describe, expect, test, vi } from "vitest";
import {
  clamp,
  formatForEditing,
  formatNumber,
  getNumberFieldProps,
  parseNumber,
  stepValue,
} from "./number-field.js";

const props = (o: Partial<Parameters<typeof getNumberFieldProps>[0]> = {}) =>
  getNumberFieldProps({ value: null, draft: null, locale: "en-US", ...o });

const key = (k: string) => ({ key: k, preventDefault: vi.fn() });

describe("parseNumber", () => {
  test("empty is null and broken is undefined — the difference type=number cannot tell", () => {
    expect(parseNumber("", "en-US")).toBeNull();
    expect(parseNumber("   ", "en-US")).toBeNull();
    expect(parseNumber("1.2.3", "en-US")).toBeUndefined();
    expect(parseNumber("-", "en-US")).toBeUndefined();
    expect(parseNumber("abc", "en-US")).toBeUndefined();
  });

  test("does not accept exponent notation", () => {
    expect(parseNumber("1e5", "en-US")).toBeUndefined();
  });

  test("follows the locale's separators", () => {
    expect(parseNumber("1,234.5", "en-US")).toBe(1234.5);
    expect(parseNumber("1.234,5", "de-DE")).toBe(1234.5);
    expect(parseNumber("12,5", "de-DE")).toBe(12.5);
  });

  test("reads its own formatted output back", () => {
    const eur = { style: "currency", currency: "EUR" } as const;
    expect(parseNumber(formatNumber(1250, "en-US", eur), "en-US", eur)).toBe(1250);
    expect(parseNumber("−3", "en-US")).toBe(-3);
  });

  test("a percent is edited as its hundredfold", () => {
    expect(parseNumber("45", "en-US", { style: "percent" })).toBe(0.45);
  });
});

describe("stepping and clamping", () => {
  test("clamps to whichever limits are set", () => {
    expect(clamp(5, 1, 3)).toBe(3);
    expect(clamp(-1, 0)).toBe(0);
    expect(clamp(7)).toBe(7);
  });

  test("steps without floating-point residue", () => {
    expect(stepValue(0.1, 1, { step: 0.2 })).toBe(0.3);
    expect(stepValue(1.01, 1, { step: 0.01 })).toBe(1.02);
  });

  test("an off-grid value moves by step, not to the grid", () => {
    expect(stepValue(12.37, 1, { step: 0.1 })).toBe(12.47);
  });

  test("empty steps from the floor, or zero", () => {
    expect(stepValue(null, 1, { min: 5 })).toBe(5);
    expect(stepValue(null, 1)).toBe(0);
  });
});

describe("formatting", () => {
  test("rest shows the format; editing shows a plain number with the format's decimals", () => {
    const eur = { style: "currency", currency: "EUR" } as const;
    expect(formatNumber(1250, "en-US", eur)).toBe("€1,250.00");
    expect(formatForEditing(1250, "en-US", eur)).toBe("1250.00");
    expect(formatForEditing(1250.5, "de-DE")).toBe("1250,5");
    expect(formatForEditing(null, "en-US")).toBe("");
  });
});

describe("getNumberFieldProps", () => {
  test("is a spinbutton over a text input, carrying the APG values", () => {
    const p = props({ value: 3, min: 1, max: 9 });
    expect(p.input.type).toBe("text");
    expect(p.input.role).toBe("spinbutton");
    expect(p.input.inputMode).toBe("decimal");
    expect(p.input["aria-valuenow"]).toBe(3);
    expect(p.input["aria-valuemin"]).toBe(1);
    expect(p.input["aria-valuemax"]).toBe(9);
    expect(p.input["aria-valuetext"]).toBe("3");
  });

  test("empty has no valuenow", () => {
    expect(props().input["aria-valuenow"]).toBeUndefined();
    expect(props().input.value).toBe("");
  });

  test("valuetext is the formatted text", () => {
    const p = props({ value: 12.5, formatOptions: { style: "currency", currency: "EUR" } });
    expect(p.input["aria-valuetext"]).toBe("€12.50");
    expect(p.input.value).toBe("€12.50");
  });

  test("typing changes the draft only", () => {
    const onValueChange = vi.fn();
    const onDraftChange = vi.fn();
    props({ value: 1, draft: "1", onValueChange, onDraftChange }).input.onChange({
      target: { value: "1." },
    });
    expect(onDraftChange).toHaveBeenCalledWith("1.");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("blur commits, clamps and leaves editing", () => {
    const onValueChange = vi.fn();
    const onDraftChange = vi.fn();
    props({ value: 1, draft: "12", max: 10, onValueChange, onDraftChange }).input.onBlur();
    expect(onValueChange).toHaveBeenCalledWith(10);
    expect(onDraftChange).toHaveBeenLastCalledWith(null);
  });

  test("blur on unparseable text keeps the last good value", () => {
    const onValueChange = vi.fn();
    props({ value: 4, draft: "4..", onValueChange }).input.onBlur();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("clearing the text commits null, not zero", () => {
    const onValueChange = vi.fn();
    props({ value: 4, draft: "", onValueChange }).input.onBlur();
    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  test("Enter commits and keeps editing", () => {
    const onValueChange = vi.fn();
    const onDraftChange = vi.fn();
    const e = key("Enter");
    props({ value: 1, draft: "7", onValueChange, onDraftChange }).input.onKeyDown(e);
    expect(onValueChange).toHaveBeenCalledWith(7);
    expect(onDraftChange).toHaveBeenLastCalledWith("7");
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test("arrows step one, PageUp/PageDown ten, Home/End to the limits", () => {
    const onValueChange = vi.fn();
    const p = props({ value: 20, min: 0, max: 100, onValueChange });
    p.input.onKeyDown(key("ArrowUp"));
    p.input.onKeyDown(key("ArrowDown"));
    p.input.onKeyDown(key("PageUp"));
    p.input.onKeyDown(key("PageDown"));
    p.input.onKeyDown(key("Home"));
    p.input.onKeyDown(key("End"));
    expect(onValueChange.mock.calls.map((c) => c[0])).toEqual([21, 19, 30, 10, 0, 100]);
  });

  test("Home and End keep their caret meaning without a limit", () => {
    const e = key("Home");
    props({ value: 2 }).input.onKeyDown(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test("arrows step from the typed draft", () => {
    const onValueChange = vi.fn();
    const onDraftChange = vi.fn();
    props({ value: 1, draft: "5", onValueChange, onDraftChange }).input.onKeyDown(key("ArrowUp"));
    expect(onValueChange).toHaveBeenCalledWith(6);
    expect(onDraftChange).toHaveBeenCalledWith("6");
  });

  test("at a limit the button is aria-disabled and the step is refused", () => {
    const onValueChange = vi.fn();
    const p = props({ value: 1, min: 1, max: 3, onValueChange });
    expect(p.decrement["aria-disabled"]).toBe(true);
    expect(p.increment["aria-disabled"]).toBeUndefined();
    p.stepBy(-1);
    expect(onValueChange).not.toHaveBeenCalled();
    p.stepBy(1);
    expect(onValueChange).toHaveBeenCalledWith(2);
  });

  test("the buttons are not tab stops, and are named", () => {
    const p = props();
    expect(p.decrement.tabIndex).toBe(-1);
    expect(p.increment.tabIndex).toBe(-1);
    expect(p.decrement["aria-label"]).toBe("Decrease");
    expect(p.increment["aria-label"]).toBe("Increase");
    expect(props({ incrementLabel: "Mehr" }).increment["aria-label"]).toBe("Mehr");
  });

  test("disabled refuses keys, typing and buttons", () => {
    const onValueChange = vi.fn();
    const onDraftChange = vi.fn();
    const p = props({ value: 2, disabled: true, onValueChange, onDraftChange });
    const e = key("ArrowUp");
    p.input.onKeyDown(e);
    expect(e.preventDefault).toHaveBeenCalled();
    p.input.onChange({ target: { value: "9" } });
    p.stepBy(1);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onDraftChange).not.toHaveBeenCalled();
    expect(p.increment["aria-disabled"]).toBe(true);
    expect(p.decrement["aria-disabled"]).toBe(true);
  });

  test("the hidden input submits the plain number, and exists only with a name", () => {
    expect(props({ value: 1250 }).hidden).toBeNull();
    expect(
      props({ value: 1250, name: "budget", formatOptions: { style: "currency", currency: "EUR" } })
        .hidden
    ).toEqual({ type: "hidden", name: "budget", value: "1250" });
    expect(props({ value: null, name: "n" }).hidden?.value).toBe("");
  });

  test("press-and-hold is a schedule, not a timer", () => {
    expect(props().repeat).toEqual({ delay: 400, interval: 60 });
  });
});
