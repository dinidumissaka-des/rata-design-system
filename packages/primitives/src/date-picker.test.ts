import { describe, expect, test, vi } from "vitest";
import { getDatePickerProps, resolveDateText } from "./date-picker.js";

const props = (o: Partial<Parameters<typeof getDatePickerProps>[0]> = {}) =>
  getDatePickerProps({ id: "in", labelId: "lbl", monthId: "month", locale: "en-GB", ...o });

const key = (k: string) => ({ key: k, preventDefault: vi.fn() });

describe("resolveDateText", () => {
  test("empty clears, a date commits and is rewritten, junk reverts", () => {
    expect(resolveDateText("", "2026-11-01", "en-GB")).toEqual({ value: null, text: "" });
    expect(resolveDateText("1/11/2026", null, "en-GB")).toEqual({ value: "2026-11-01", text: "01/11/2026" });
    expect(resolveDateText("31/02/2026", "2026-11-01", "en-GB")).toEqual({
      value: "2026-11-01",
      text: "01/11/2026",
    });
    expect(resolveDateText("soon", null, "en-GB")).toEqual({ value: null, text: "" });
  });
});

describe("getDatePickerProps", () => {
  test("typing changes only the text", () => {
    const onTextChange = vi.fn();
    const onValueChange = vi.fn();
    props({ onTextChange, onValueChange }).input.onChange({ target: { value: "03/1" } });
    expect(onTextChange).toHaveBeenCalledWith("03/1");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("Enter parses, and is prevented only when it changed the value", () => {
    const onValueChange = vi.fn();
    const changed = key("Enter");
    props({ text: "1/11/2026", onValueChange }).input.onKeyDown(changed);
    expect(onValueChange).toHaveBeenCalledWith("2026-11-01");
    expect(changed.preventDefault).toHaveBeenCalled();

    const same = key("Enter");
    props({ text: "01/11/2026", value: "2026-11-01", onValueChange }).input.onKeyDown(same);
    expect(same.preventDefault).not.toHaveBeenCalled();
  });

  test("blur commits through commitText", () => {
    const onValueChange = vi.fn();
    const onTextChange = vi.fn();
    props({ text: "2026-12-25", onValueChange, onTextChange }).commitText();
    expect(onValueChange).toHaveBeenCalledWith("2026-12-25");
    expect(onTextChange).toHaveBeenCalledWith("25/12/2026");
  });

  test("the calendar button names the date it will change", () => {
    expect(props().trigger["aria-label"]).toBe("Choose date");
    expect(props({ value: "2026-11-01" }).trigger["aria-label"]).toBe("Choose date, 1 November 2026");
    expect(props({ calendarLabel: "Elegir fecha" }).trigger["aria-label"]).toBe("Elegir fecha");
  });

  test("the button toggles the calendar, and its click guard refuses while disabled", () => {
    const onOpenChange = vi.fn();
    props({ onOpenChange }).trigger.onClick({ preventDefault: vi.fn() });
    expect(onOpenChange).toHaveBeenCalledWith(true);

    onOpenChange.mockClear();
    const click = { preventDefault: vi.fn() };
    const disabled = props({ disabled: true, onOpenChange });
    disabled.trigger.onClick(click);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(click.preventDefault).toHaveBeenCalled();
    expect(disabled.trigger["aria-disabled"]).toBe(true);
  });

  test("the dialog is labelled by the field and described by the month", () => {
    const p = props();
    expect(p.dialog).toEqual({ "aria-labelledby": "lbl", "aria-describedby": "month" });
    expect(p.monthTitle).toEqual({ id: "month", "aria-live": "polite" });
  });

  test("choosing a day commits, rewrites the text and closes", () => {
    const onValueChange = vi.fn();
    const onTextChange = vi.fn();
    const onOpenChange = vi.fn();
    props({ open: true, onValueChange, onTextChange, onOpenChange }).choose("2026-11-09");
    expect(onValueChange).toHaveBeenCalledWith("2026-11-09");
    expect(onTextChange).toHaveBeenCalledWith("09/11/2026");
    expect(onOpenChange).toHaveBeenCalledWith(false, "choose");
  });

  test("disabled: typing and committing do nothing", () => {
    const onTextChange = vi.fn();
    const onValueChange = vi.fn();
    const p = props({ disabled: true, text: "1/11/2026", onTextChange, onValueChange });
    p.input.onChange({ target: { value: "x" } });
    p.input.onKeyDown(key("Enter"));
    p.commitText();
    expect(onTextChange).not.toHaveBeenCalled();
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
