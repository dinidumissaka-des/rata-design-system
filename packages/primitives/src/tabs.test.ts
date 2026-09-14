import { describe, expect, test, vi } from "vitest";
import { getTabsProps } from "./tabs.js";

const TABS = [{ value: "details" }, { value: "history" }, { value: "notes" }];

const props = (o: Partial<Parameters<typeof getTabsProps>[0]> = {}) =>
  getTabsProps({ tabs: TABS, value: "details", idBase: "t", label: "Invoice", ...o });

const key = (k: string) => ({ key: k, preventDefault: vi.fn() });
const click = () => ({ preventDefault: vi.fn() });

describe("getTabsProps", () => {
  test("is a tablist, not a radiogroup", () => {
    // The distinction the primitive exists to hold: a radiogroup answers a
    // question and gets submitted; a tablist reveals a region.
    const p = props();
    expect(p.tablist.role).toBe("tablist");
    expect(p.tab("details").role).toBe("tab");
    expect(p.panel("details").role).toBe("tabpanel");
    expect("aria-checked" in p.tab("details")).toBe(false);
  });

  test("each tab names its panel, and each panel names its tab", () => {
    const p = props();
    const tab = p.tab("history");
    const panel = p.panel("history");
    expect(tab["aria-controls"]).toBe(panel.id);
    expect(panel["aria-labelledby"]).toBe(tab.id);
  });

  test("only the selected panel is shown", () => {
    const p = props({ value: "history" });
    expect(p.panel("history").hidden).toBe(false);
    expect(p.panel("details").hidden).toBe(true);
    expect(p.tab("history")["aria-selected"]).toBe(true);
    expect(p.tab("details")["aria-selected"]).toBe(false);
  });

  test("a panel is in the tab order even with nothing focusable inside", () => {
    // Without this, Tab from the tablist skips a panel of plain text and the
    // reader never reaches the content the tab promised.
    expect(props().panel("details").tabIndex).toBe(0);
  });

  test("exactly one tab is the tab stop", () => {
    const p = props({ value: "history" });
    expect([p.tab("details").tabIndex, p.tab("history").tabIndex, p.tab("notes").tabIndex]).toEqual(
      [-1, 0, -1]
    );
  });

  test("naming: label or labelledBy, never both", () => {
    expect(props().tablist["aria-label"]).toBe("Invoice");
    const byId = props({ labelledBy: "heading" }).tablist;
    expect(byId["aria-labelledby"]).toBe("heading");
    expect(byId["aria-label"]).toBeUndefined();
  });

  describe("automatic activation — the default", () => {
    test("arrows move focus AND select, wrapping", () => {
      const onFocusValue = vi.fn();
      const onValueChange = vi.fn();
      props({ onFocusValue, onValueChange }).tablist.onKeyDown(key("ArrowRight"));
      expect(onFocusValue).toHaveBeenCalledWith("history");
      expect(onValueChange).toHaveBeenCalledWith("history");

      const wrap = vi.fn();
      props({ value: "details", onValueChange: wrap }).tablist.onKeyDown(key("ArrowLeft"));
      expect(wrap).toHaveBeenCalledWith("notes");
    });

    test("Home and End jump to the ends", () => {
      const onValueChange = vi.fn();
      props({ value: "history", onValueChange }).tablist.onKeyDown(key("End"));
      expect(onValueChange).toHaveBeenLastCalledWith("notes");
      props({ value: "history", onValueChange }).tablist.onKeyDown(key("Home"));
      expect(onValueChange).toHaveBeenLastCalledWith("details");
    });

    test("the vertical axis uses the vertical arrows, and ignores the others", () => {
      const onFocusValue = vi.fn();
      const vertical = props({ orientation: "vertical", onFocusValue });
      expect(vertical.tablist["aria-orientation"]).toBe("vertical");
      vertical.tablist.onKeyDown(key("ArrowDown"));
      expect(onFocusValue).toHaveBeenCalledWith("history");

      const ignored = vi.fn();
      props({ orientation: "vertical", onFocusValue: ignored }).tablist.onKeyDown(
        key("ArrowRight")
      );
      expect(ignored).not.toHaveBeenCalled();
    });
  });

  describe("manual activation", () => {
    test("arrows move focus WITHOUT selecting", () => {
      // Correct when a panel fetches something: automatic activation would
      // fire a request for every tab arrowed past.
      const onFocusValue = vi.fn();
      const onValueChange = vi.fn();
      props({ activation: "manual", onFocusValue, onValueChange }).tablist.onKeyDown(
        key("ArrowRight")
      );
      expect(onFocusValue).toHaveBeenCalledWith("history");
      expect(onValueChange).not.toHaveBeenCalled();
    });

    test("Enter and Space select the focused tab", () => {
      for (const k of ["Enter", " "]) {
        const onValueChange = vi.fn();
        const event = key(k);
        props({
          activation: "manual",
          focusedValue: "notes",
          onValueChange,
        }).tablist.onKeyDown(event);
        expect(onValueChange, k).toHaveBeenCalledWith("notes");
        expect(event.preventDefault, k).toHaveBeenCalled();
      }
    });

    test("automatic ignores Enter, since the focused tab is already selected", () => {
      const onValueChange = vi.fn();
      props({ focusedValue: "notes", onValueChange }).tablist.onKeyDown(key("Enter"));
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe("a disabled tab", () => {
    const withDisabled = [{ value: "a" }, { value: "b", disabled: true }, { value: "c" }];

    test("is reachable and announced, but selection does not follow", () => {
      const onFocusValue = vi.fn();
      const onValueChange = vi.fn();
      getTabsProps({
        tabs: withDisabled,
        value: "a",
        idBase: "t",
        label: "x",
        onFocusValue,
        onValueChange,
      }).tablist.onKeyDown(key("ArrowRight"));
      // Focus moves — this system's disabled controls stay focusable.
      expect(onFocusValue).toHaveBeenCalledWith("b");
      // Selection does not.
      expect(onValueChange).not.toHaveBeenCalled();
    });

    test("refuses a click, and says it is disabled", () => {
      const onValueChange = vi.fn();
      const p = getTabsProps({ tabs: withDisabled, value: "a", idBase: "t", onValueChange });
      const event = click();
      p.tab("b").onClick(event);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
      expect(p.tab("b")["aria-disabled"]).toBe(true);
      // Never the native attribute.
      expect("disabled" in p.tab("b")).toBe(false);
    });
  });

  test("clicking a tab focuses and selects it", () => {
    const onFocusValue = vi.fn();
    const onValueChange = vi.fn();
    props({ onFocusValue, onValueChange }).tab("notes").onClick(click());
    expect(onFocusValue).toHaveBeenCalledWith("notes");
    expect(onValueChange).toHaveBeenCalledWith("notes");
  });

  test("an empty tablist ignores every key instead of throwing", () => {
    const p = getTabsProps({ tabs: [], value: "", idBase: "t" });
    p.tablist.onKeyDown(key("ArrowRight"));
    p.tablist.onKeyDown(key("Home"));
  });
});
