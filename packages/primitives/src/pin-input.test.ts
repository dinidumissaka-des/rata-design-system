import { describe, expect, test, vi } from "vitest";
import { filterCode, getPinInputProps } from "./pin-input.js";

const props = (o: Partial<Parameters<typeof getPinInputProps>[0]> = {}) =>
  getPinInputProps({ id: "code", value: "", length: 6, ...o });

const paste = (text: string, start: number | null = null, end: number | null = start) => ({
  preventDefault: vi.fn(),
  clipboardData: { getData: () => text },
  currentTarget: { selectionStart: start, selectionEnd: end },
});

describe("filterCode", () => {
  test("numeric keeps digits only", () => {
    expect(filterCode("123-456", "numeric", 6)).toBe("123456");
    expect(filterCode("12ab", "numeric", 6)).toBe("12");
  });

  test("alphanumeric uppercases and drops punctuation", () => {
    expect(filterCode("ab-12 cd", "alphanumeric", 8)).toBe("AB12CD");
  });

  test("caps at length", () => {
    expect(filterCode("1234567", "numeric", 6)).toBe("123456");
  });
});

describe("getPinInputProps", () => {
  test("a one-time code is visible, fillable and numeric by default", () => {
    const p = props();
    expect(p.input.type).toBe("text");
    expect(p.input.inputMode).toBe("numeric");
    expect(p.input.autoComplete).toBe("one-time-code");
    expect(p.input.maxLength).toBe(6);
  });

  test("a pin is a password with autofill off", () => {
    const p = props({ purpose: "pin" });
    expect(p.input.type).toBe("password");
    expect(p.input.autoComplete).toBe("off");
  });

  test("alphanumeric asks for the text keyboard", () => {
    expect(props({ characters: "alphanumeric" }).input.inputMode).toBe("text");
  });

  test("the length is stated for a reader who cannot see the boxes", () => {
    expect(props().lengthDescription).toEqual({ id: "code-length", text: "6 characters" });
    expect(props({ length: 1 }).lengthDescription.text).toBe("1 character");
  });

  test("typing is filtered before it is reported", () => {
    const onValueChange = vi.fn();
    props({ onValueChange }).input.onChange({ target: { value: "1a2" } });
    expect(onValueChange).toHaveBeenCalledWith("12");
  });

  test("a dropped character that changes nothing reports nothing", () => {
    const onValueChange = vi.fn();
    props({ value: "12", onValueChange }).input.onChange({ target: { value: "12a" } });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("a paste is filtered whole, before maxLength can truncate it", () => {
    const onValueChange = vi.fn();
    const e = paste("123-456", 0, 0);
    props({ onValueChange }).input.onPaste(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(onValueChange).toHaveBeenCalledWith("123456");
  });

  test("a paste replaces the selection", () => {
    const onValueChange = vi.fn();
    props({ value: "129956", onValueChange }).input.onPaste(paste("34", 2, 4));
    expect(onValueChange).toHaveBeenCalledWith("123456");
  });

  test("completion fires once, when the code reaches length", () => {
    const onComplete = vi.fn();
    props({ value: "12345", onComplete }).input.onChange({ target: { value: "123456" } });
    expect(onComplete).toHaveBeenCalledWith("123456");
    onComplete.mockClear();
    props({ value: "123456", onComplete }).input.onChange({ target: { value: "123456" } });
    expect(onComplete).not.toHaveBeenCalled();
    props({ value: "1234", onComplete }).input.onChange({ target: { value: "12345" } });
    expect(onComplete).not.toHaveBeenCalled();
  });

  test("boxes follow the value and the caret", () => {
    const states = (o: Partial<Parameters<typeof getPinInputProps>[0]>) =>
      props({ length: 4, ...o }).boxes.map((b) => b.state);
    expect(states({ value: "12" })).toEqual(["filled", "filled", "empty", "empty"]);
    expect(states({ value: "12", focused: true })).toEqual(["filled", "filled", "active", "empty"]);
    expect(states({ value: "12", focused: true, selectionStart: 0 })).toEqual([
      "active",
      "filled",
      "empty",
      "empty",
    ]);
    // Full: the caret stays in the last box rather than falling off the end.
    expect(states({ value: "1234", focused: true })).toEqual(["filled", "filled", "filled", "active"]);
  });

  test("the caret is drawn only in an active empty box", () => {
    const boxes = props({ length: 3, value: "1", focused: true }).boxes;
    expect(boxes.map((b) => b.caret)).toEqual([false, true, false]);
    expect(boxes[0]!.char).toBe("1");
  });

  test("a pin draws dots, never characters", () => {
    const boxes = props({ length: 3, value: "12", purpose: "pin" }).boxes;
    expect(boxes.map((b) => b.char)).toEqual([null, null, null]);
    expect(boxes.map((b) => b.masked)).toEqual([true, true, false]);
  });

  test("disabled refuses typing and paste", () => {
    const onValueChange = vi.fn();
    const p = props({ disabled: true, onValueChange });
    p.input.onChange({ target: { value: "1" } });
    const e = paste("123456", 0, 0);
    p.input.onPaste(e);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
  });
});
