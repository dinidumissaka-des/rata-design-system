import { describe, expect, test, vi } from "vitest";
import {
  comboboxCountMessage,
  filterComboboxOptions,
  getComboboxProps,
  resolveComboboxText,
} from "./combobox.js";
import type { ComboboxOptionDescriptor } from "./combobox.js";

const OPTIONS: ComboboxOptionDescriptor[] = [
  { value: "ny", label: "New York" },
  { value: "lon", label: "London" },
  { value: "cmb", label: "Colombo", disabled: true },
  { value: "lis", label: "Lisbon" },
];

const props = (o: Partial<Parameters<typeof getComboboxProps>[0]> = {}) =>
  getComboboxProps({
    id: "in",
    listboxId: "lb",
    labelId: "lbl",
    options: OPTIONS,
    visible: OPTIONS,
    ...o,
  });

const key = (k: string, extra: Record<string, unknown> = {}) => ({
  key: k,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  ...extra,
});

describe("combobox core", () => {
  test("contains is the default filter, case-insensitive", () => {
    expect(filterComboboxOptions(OPTIONS, "york").map((o) => o.value)).toEqual(["ny"]);
    expect(filterComboboxOptions(OPTIONS, "O").map((o) => o.value)).toEqual(["ny", "lon", "cmb", "lis"]);
    expect(filterComboboxOptions(OPTIONS, "ON").map((o) => o.value)).toEqual(["lon", "lis"]);
  });

  test("starts-with matches only at the start", () => {
    expect(filterComboboxOptions(OPTIONS, "on", "starts-with")).toEqual([]);
    expect(filterComboboxOptions(OPTIONS, "lo", "starts-with").map((o) => o.value)).toEqual(["lon"]);
  });

  test("none never narrows, and an empty query narrows nothing", () => {
    expect(filterComboboxOptions(OPTIONS, "zzz", "none")).toHaveLength(4);
    expect(filterComboboxOptions(OPTIONS, "  ")).toHaveLength(4);
  });

  test("unmatched text reverts to the chosen label, or empties", () => {
    expect(resolveComboboxText({ text: "Lond", value: "lon", options: OPTIONS })).toEqual({
      value: "lon",
      text: "London",
    });
    expect(resolveComboboxText({ text: "Lond", value: null, options: OPTIONS })).toEqual({
      value: null,
      text: "",
    });
  });

  test("text that is an option's label chooses it; a disabled one does not", () => {
    expect(resolveComboboxText({ text: "lisbon ", value: null, options: OPTIONS })).toEqual({
      value: "lis",
      text: "Lisbon",
    });
    expect(resolveComboboxText({ text: "Colombo", value: null, options: OPTIONS }).value).toBeNull();
  });

  test("custom values keep the text as the value", () => {
    expect(
      resolveComboboxText({ text: "Kandy", value: "lon", options: OPTIONS, allowCustomValue: true })
    ).toEqual({ value: "Kandy", text: "Kandy" });
  });

  test("clearing the text clears the value", () => {
    expect(resolveComboboxText({ text: "", value: "lon", options: OPTIONS })).toEqual({
      value: null,
      text: "",
    });
  });

  test("the count is announced in words", () => {
    expect(comboboxCountMessage(1)).toBe("1 result");
    expect(comboboxCountMessage(7)).toBe("7 results");
  });
});

describe("getComboboxProps — ARIA", () => {
  test("the input is an APG combobox with list autocomplete", () => {
    const { input } = props();
    expect(input.role).toBe("combobox");
    expect(input["aria-autocomplete"]).toBe("list");
    expect(input["aria-controls"]).toBe("lb");
    expect(input["aria-expanded"]).toBe(false);
    expect(input.autoComplete).toBe("off");
  });

  test("aria-activedescendant points at the highlighted option only while open", () => {
    expect(props({ highlightedValue: "lon" }).input["aria-activedescendant"]).toBeUndefined();
    const open = props({ open: true, highlightedValue: "lon" });
    expect(open.input["aria-activedescendant"]).toBe(open.option("lon").id);
    expect(open.option("lon")["data-highlighted"]).toBe("");
  });

  test("a highlight that is filtered out points nowhere", () => {
    const p = props({ open: true, highlightedValue: "lon", visible: [OPTIONS[0]!] });
    expect(p.input["aria-activedescendant"]).toBeUndefined();
  });

  test("the listbox shares the field's label and reports loading", () => {
    expect(props().listbox).toMatchObject({ role: "listbox", "aria-labelledby": "lbl" });
    expect(props({ loading: true }).listbox["aria-busy"]).toBe(true);
  });

  test("options say which is chosen and which is unavailable", () => {
    const p = props({ value: "lon" });
    expect(p.option("lon")["aria-selected"]).toBe(true);
    expect(p.option("ny")["aria-selected"]).toBe(false);
    expect(p.option("cmb")["aria-disabled"]).toBe(true);
  });

  test("the toggle is not a tab stop", () => {
    const { toggle } = props();
    expect(toggle.tabIndex).toBe(-1);
    expect(toggle["aria-controls"]).toBe("lb");
    expect(toggle["aria-labelledby"]).toBe("lbl");
  });
});

describe("getComboboxProps — keyboard", () => {
  test("ArrowDown opens on the first option, or the chosen one", () => {
    const onOpenChange = vi.fn();
    const onHighlightChange = vi.fn();
    const event = key("ArrowDown");
    props({ onOpenChange, onHighlightChange }).input.onKeyDown(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(true, "keyboard");
    expect(onHighlightChange).toHaveBeenLastCalledWith("ny");

    props({ value: "lis", onOpenChange, onHighlightChange }).input.onKeyDown(key("ArrowDown"));
    expect(onHighlightChange).toHaveBeenLastCalledWith("lis");
  });

  test("ArrowUp opens on the last option", () => {
    const onHighlightChange = vi.fn();
    props({ onHighlightChange }).input.onKeyDown(key("ArrowUp"));
    expect(onHighlightChange).toHaveBeenLastCalledWith("lis");
  });

  test("Alt+ArrowDown opens without highlighting; Alt+ArrowUp closes", () => {
    const onOpenChange = vi.fn();
    const onHighlightChange = vi.fn();
    props({ onOpenChange, onHighlightChange }).input.onKeyDown(key("ArrowDown", { altKey: true }));
    expect(onOpenChange).toHaveBeenCalledWith(true, "keyboard");
    expect(onHighlightChange).toHaveBeenLastCalledWith(null);

    props({ open: true, onOpenChange }).input.onKeyDown(key("ArrowUp", { altKey: true }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, "toggle");
  });

  test("arrows walk the visible options, through disabled ones, wrapping", () => {
    const onHighlightChange = vi.fn();
    const open = (highlightedValue: string) =>
      props({ open: true, highlightedValue, onHighlightChange }).input;
    open("lon").onKeyDown(key("ArrowDown"));
    expect(onHighlightChange).toHaveBeenLastCalledWith("cmb");
    open("lis").onKeyDown(key("ArrowDown"));
    expect(onHighlightChange).toHaveBeenLastCalledWith("ny");
    open("ny").onKeyDown(key("ArrowUp"));
    expect(onHighlightChange).toHaveBeenLastCalledWith("lis");
  });

  test("arrowing never changes the value — manual selection", () => {
    const onValueChange = vi.fn();
    props({ open: true, highlightedValue: "ny", onValueChange }).input.onKeyDown(key("ArrowDown"));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("Enter commits the highlighted option and closes", () => {
    const onValueChange = vi.fn();
    const onInputChange = vi.fn();
    const onOpenChange = vi.fn();
    const event = key("Enter");
    props({ open: true, highlightedValue: "lon", onValueChange, onInputChange, onOpenChange }).input.onKeyDown(
      event
    );
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onValueChange).toHaveBeenCalledWith("lon");
    expect(onInputChange).toHaveBeenCalledWith("London", false);
    expect(onOpenChange).toHaveBeenCalledWith(false, "select");
  });

  test("Enter on a disabled option does nothing", () => {
    const onValueChange = vi.fn();
    props({ open: true, highlightedValue: "cmb", onValueChange }).input.onKeyDown(key("Enter"));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("Enter with nothing highlighted is left to the form", () => {
    const onValueChange = vi.fn();
    const event = key("Enter");
    props({ inputText: "Lond", onValueChange }).input.onKeyDown(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("Enter with custom values commits the text", () => {
    const onValueChange = vi.fn();
    props({ inputText: "Kandy", allowCustomValue: true, onValueChange }).input.onKeyDown(key("Enter"));
    expect(onValueChange).toHaveBeenCalledWith("Kandy");
  });

  test("Escape closes an open popup first", () => {
    const onOpenChange = vi.fn();
    const onInputChange = vi.fn();
    const event = key("Escape");
    props({ open: true, inputText: "Lon", onOpenChange, onInputChange }).input.onKeyDown(event);
    expect(onOpenChange).toHaveBeenCalledWith(false, "escape");
    expect(onInputChange).not.toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  test("Escape with the popup closed clears the text and the value", () => {
    const onInputChange = vi.fn();
    const onValueChange = vi.fn();
    const event = key("Escape");
    props({ inputText: "London", value: "lon", onInputChange, onValueChange }).input.onKeyDown(event);
    expect(onInputChange).toHaveBeenCalledWith("", false);
    expect(onValueChange).toHaveBeenCalledWith(null);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  test("Escape with nothing to do bubbles", () => {
    const event = key("Escape");
    props().input.onKeyDown(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
  });

  test("typing opens with nothing highlighted and does not change the value", () => {
    const onOpenChange = vi.fn();
    const onHighlightChange = vi.fn();
    const onInputChange = vi.fn();
    const onValueChange = vi.fn();
    props({ value: "lon", onOpenChange, onHighlightChange, onInputChange, onValueChange }).input.onChange({
      target: { value: "Lis" },
    });
    expect(onInputChange).toHaveBeenCalledWith("Lis", true);
    expect(onOpenChange).toHaveBeenCalledWith(true, "input");
    expect(onHighlightChange).toHaveBeenCalledWith(null);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("deleting all the text clears the value", () => {
    const onValueChange = vi.fn();
    props({ value: "lon", onValueChange }).input.onChange({ target: { value: "" } });
    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  test("disabled: the arrows and the toggle never open it", () => {
    const onOpenChange = vi.fn();
    const p = props({ disabled: true, onOpenChange });
    p.input.onKeyDown(key("ArrowDown"));
    p.toggle.onClick();
    p.input.onChange({ target: { value: "x" } });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(p.toggle["aria-disabled"]).toBe(true);
  });

  test("modified keys are left alone", () => {
    const event = key("ArrowDown", { ctrlKey: true });
    props().input.onKeyDown(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

describe("getComboboxProps — pointer and focus", () => {
  test("the toggle opens without a highlight and closes", () => {
    const onOpenChange = vi.fn();
    props({ onOpenChange }).toggle.onClick();
    expect(onOpenChange).toHaveBeenCalledWith(true, "toggle");
    props({ open: true, onOpenChange }).toggle.onClick();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, "toggle");
  });

  test("clicking an option commits it; clicking a disabled one does not", () => {
    const onValueChange = vi.fn();
    const p = props({ open: true, onValueChange });
    p.option("cmb").onClick();
    expect(onValueChange).not.toHaveBeenCalled();
    p.option("lis").onClick();
    expect(onValueChange).toHaveBeenCalledWith("lis");
  });

  test("focus leaving to a control outside closes it and settles the text", () => {
    const onOpenChange = vi.fn();
    const onInputChange = vi.fn();
    props({ open: true, inputText: "Lond", value: "lon", onOpenChange, onInputChange }).focusMoved(
      "outside"
    );
    expect(onOpenChange).toHaveBeenCalledWith(false, "tab");
    expect(onInputChange).toHaveBeenCalledWith("London", false);
  });

  test("focus going nowhere settles the text but leaves dismissal to the press", () => {
    const onOpenChange = vi.fn();
    const onInputChange = vi.fn();
    props({ open: true, inputText: "Lond", onOpenChange, onInputChange }).focusMoved("nowhere");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onInputChange).toHaveBeenCalledWith("", false);
  });

  test("a press outside dismisses an open popup", () => {
    const onOpenChange = vi.fn();
    props({ open: true, onOpenChange }).dismissed();
    expect(onOpenChange).toHaveBeenCalledWith(false, "dismiss");
    onOpenChange.mockClear();
    props({ onOpenChange }).dismissed();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
