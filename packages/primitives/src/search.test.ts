import { describe, expect, test, vi } from "vitest";
import { getSearchProps } from "./search.js";

const props = (o: Partial<Parameters<typeof getSearchProps>[0]> = {}) =>
  getSearchProps({ id: "q", value: "", ...o });

const key = (k: string) => ({
  key: k,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
});

describe("getSearchProps", () => {
  test("is a searchbox the platform provides, bound to its label", () => {
    const p = props();
    expect(p.input.type).toBe("search");
    expect(p.input.id).toBe("q");
    expect(p.label.htmlFor).toBe("q");
  });

  test("typing reports the new value", () => {
    const onValueChange = vi.fn();
    props({ onValueChange }).input.onChange({ target: { value: "inv" } });
    expect(onValueChange).toHaveBeenCalledWith("inv");
  });

  test("the clear control does not exist until there is something to clear", () => {
    // Absent, not disabled: a present-but-dead button would be a permanent
    // stop in the tab order of every empty search box in the product.
    expect(props({ value: "" }).clear).toBeNull();
    expect(props({ value: "inv" }).clear).not.toBeNull();
    expect(props({ value: "inv" }).clear?.["aria-label"]).toBe("Clear search");
    expect(props({ value: "inv", clearLabel: "Clear the filter" }).clear?.["aria-label"]).toBe(
      "Clear the filter"
    );
  });

  test("clearing empties the value and says so separately", () => {
    const onValueChange = vi.fn();
    const onCleared = vi.fn();
    props({ value: "inv", onValueChange, onCleared }).clear?.onClick();
    expect(onValueChange).toHaveBeenCalledWith("");
    // Its own callback, because the wrapper has a DOM job a value change does
    // not imply: the control vanishes, so focus has to go back to the input.
    expect(onCleared).toHaveBeenCalledOnce();
  });

  describe("Escape", () => {
    test("clears the field when there is a query", () => {
      const onValueChange = vi.fn();
      const event = key("Escape");
      props({ value: "inv", onValueChange }).input.onKeyDown(event);
      expect(onValueChange).toHaveBeenCalledWith("");
      expect(event.preventDefault).toHaveBeenCalled();
      // Stopped too: an ancestor overlay listens on the way up, and this
      // keypress meant "clear the field", not "close the dialog".
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    test("is left entirely alone when the field is empty", () => {
      // The reason this behaviour is in a primitive at all. Swallowing Escape
      // unconditionally stops every Dialog and Menu a search sits inside from
      // closing.
      const onValueChange = vi.fn();
      const event = key("Escape");
      props({ value: "", onValueChange }).input.onKeyDown(event);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(event.stopPropagation).not.toHaveBeenCalled();
    });

    test("survives a wrapper that passes no stopPropagation", () => {
      const event = { key: "Escape", preventDefault: vi.fn() };
      const onValueChange = vi.fn();
      expect(() =>
        props({ value: "inv", onValueChange }).input.onKeyDown(event)
      ).not.toThrow();
      expect(onValueChange).toHaveBeenCalledWith("");
    });
  });

  describe("Enter", () => {
    test("commits the query", () => {
      const onSearch = vi.fn();
      const event = key("Enter");
      props({ value: "inv", onSearch }).input.onKeyDown(event);
      expect(onSearch).toHaveBeenCalledWith("inv");
      expect(event.preventDefault).toHaveBeenCalled();
    });

    test("is left alone with no onSearch, so a form's own submit still works", () => {
      // Without a handler the field may well be inside a form whose submit IS
      // the search, and swallowing Enter there would break it.
      const event = key("Enter");
      props({ value: "inv" }).input.onKeyDown(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe("disabled", () => {
    test("blocks editing while staying in the tab order", () => {
      const p = props({ value: "inv", disabled: true });
      expect(p.input["aria-disabled"]).toBe(true);
      expect(p.input.readOnly).toBe(true);
      // Never the native attribute: the field stays focusable and announced.
      expect("disabled" in p.input).toBe(false);
    });

    test("refuses every way of changing the value", () => {
      const onValueChange = vi.fn();
      const onSearch = vi.fn();
      const p = props({ value: "inv", disabled: true, onValueChange, onSearch });
      p.input.onChange({ target: { value: "x" } });
      p.input.onKeyDown(key("Escape"));
      p.input.onKeyDown(key("Enter"));
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onSearch).not.toHaveBeenCalled();
      // And offers no clear control, since it could not honour it.
      expect(p.clear).toBeNull();
    });
  });

  test("loading says a query is in flight and nothing about the result", () => {
    expect(props({ loading: true }).input["aria-busy"]).toBe(true);
    expect(props().input["aria-busy"]).toBeUndefined();
    expect(props({ loading: true }).root["data-loading"]).toBe("");
  });

  test("the root reports its states, so the CSS need not re-derive them", () => {
    expect(props().root["data-empty"]).toBe("");
    expect(props({ value: "inv" }).root["data-empty"]).toBeUndefined();
    expect(props({ disabled: true }).root["data-disabled"]).toBe("");
  });
});
