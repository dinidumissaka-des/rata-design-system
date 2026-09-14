import { describe, expect, test, vi } from "vitest";
import { getMenuProps } from "./menu.js";
import type { MenuItemDescriptor } from "./menu.js";

const ITEMS: MenuItemDescriptor[] = [
  { value: "dup", text: "Duplicate" },
  { value: "del", text: "Delete" },
  { value: "arch", text: "Archive" },
];

const props = (o: Partial<Parameters<typeof getMenuProps>[0]> = {}) =>
  getMenuProps({ items: ITEMS, triggerId: "t", menuId: "m", ...o });

/** A key event shaped like the part of the DOM event the primitive reads. */
const key = (k: string) => ({ key: k, preventDefault: vi.fn() });
const click = () => ({ preventDefault: vi.fn() });

describe("getMenuProps — trigger", () => {
  test("declares the menu it owns, and whether it is showing", () => {
    const closed = props().trigger;
    expect(closed["aria-haspopup"]).toBe("menu");
    expect(closed["aria-expanded"]).toBe(false);
    expect(closed["aria-controls"]).toBe("m");
    expect(props({ open: true }).trigger["aria-expanded"]).toBe(true);
  });

  test("clicking opens at the first item, so Enter and Space land there too", () => {
    const onOpenChange = vi.fn();
    const onFocusValue = vi.fn();
    props({ onOpenChange, onFocusValue }).trigger.onClick(click());
    expect(onOpenChange).toHaveBeenCalledWith(true, "trigger");
    expect(onFocusValue).toHaveBeenCalledWith("dup");
  });

  test("clicking an open menu's trigger closes it", () => {
    const onOpenChange = vi.fn();
    props({ open: true, onOpenChange }).trigger.onClick(click());
    expect(onOpenChange).toHaveBeenCalledWith(false, "trigger");
  });

  test("ArrowDown opens at the first item, ArrowUp at the last", () => {
    const down = { open: vi.fn(), focus: vi.fn() };
    const e1 = key("ArrowDown");
    props({ onOpenChange: down.open, onFocusValue: down.focus }).trigger.onKeyDown(e1);
    expect(down.focus).toHaveBeenCalledWith("dup");
    // Prevented, or the page scrolls behind the menu that just opened.
    expect(e1.preventDefault).toHaveBeenCalled();

    const onFocusValue = vi.fn();
    props({ onFocusValue }).trigger.onKeyDown(key("ArrowUp"));
    expect(onFocusValue).toHaveBeenCalledWith("arch");
  });

  test("an already-open menu ignores the trigger's arrow keys", () => {
    const onFocusValue = vi.fn();
    props({ open: true, onFocusValue }).trigger.onKeyDown(key("ArrowDown"));
    expect(onFocusValue).not.toHaveBeenCalled();
  });

  test("focus enters at the first item that can do something", () => {
    const onFocusValue = vi.fn();
    const items = [{ value: "a", disabled: true }, { value: "b" }, { value: "c" }];
    getMenuProps({ items, triggerId: "t", menuId: "m", onFocusValue }).trigger.onClick(click());
    // Reachable afterwards, but not the row the menu opens onto.
    expect(onFocusValue).toHaveBeenCalledWith("b");
  });
});

describe("getMenuProps — naming", () => {
  test("the menu is named by its trigger's text by default", () => {
    const m = props().menu;
    expect(m["aria-labelledby"]).toBe("t");
    expect(m["aria-label"]).toBeUndefined();
  });

  test("label wins for an icon-only trigger, which names the button not the list", () => {
    const m = props({ label: "Row actions" }).menu;
    expect(m["aria-label"]).toBe("Row actions");
    // Never both: two names on one node is a 4.1.2 problem, not a fallback.
    expect(m["aria-labelledby"]).toBeUndefined();
  });
});

describe("getMenuProps — keyboard inside the menu", () => {
  const open = (o: Partial<Parameters<typeof getMenuProps>[0]> = {}) =>
    props({ open: true, ...o });

  test("arrows move and wrap in both directions", () => {
    const onFocusValue = vi.fn();
    open({ focusedValue: "dup", onFocusValue }).menu.onKeyDown(key("ArrowDown"));
    expect(onFocusValue).toHaveBeenLastCalledWith("del");

    const up = vi.fn();
    open({ focusedValue: "dup", onFocusValue: up }).menu.onKeyDown(key("ArrowUp"));
    expect(up).toHaveBeenLastCalledWith("arch");

    const wrap = vi.fn();
    open({ focusedValue: "arch", onFocusValue: wrap }).menu.onKeyDown(key("ArrowDown"));
    expect(wrap).toHaveBeenLastCalledWith("dup");
  });

  test("Home and End jump to the ends", () => {
    const home = vi.fn();
    open({ focusedValue: "del", onFocusValue: home }).menu.onKeyDown(key("Home"));
    expect(home).toHaveBeenLastCalledWith("dup");

    const end = vi.fn();
    open({ focusedValue: "del", onFocusValue: end }).menu.onKeyDown(key("End"));
    expect(end).toHaveBeenLastCalledWith("arch");
  });

  test("arrows reach a disabled item, because disabled here stays announced", () => {
    const onFocusValue = vi.fn();
    const items = [{ value: "a" }, { value: "b", disabled: true }, { value: "c" }];
    getMenuProps({ items, triggerId: "t", menuId: "m", open: true, focusedValue: "a", onFocusValue })
      .menu.onKeyDown(key("ArrowDown"));
    expect(onFocusValue).toHaveBeenCalledWith("b");
  });

  test("Escape closes and clears the entry point", () => {
    const onOpenChange = vi.fn();
    const onFocusValue = vi.fn();
    const e = key("Escape");
    open({ focusedValue: "del", onOpenChange, onFocusValue }).menu.onKeyDown(e);
    expect(onOpenChange).toHaveBeenCalledWith(false, "escape");
    // Next opening re-enters at the top rather than where the reader left off.
    expect(onFocusValue).toHaveBeenCalledWith(null);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  test("Tab closes but is not prevented, so focus carries on past the trigger", () => {
    const onOpenChange = vi.fn();
    const e = key("Tab");
    open({ focusedValue: "dup", onOpenChange }).menu.onKeyDown(e);
    expect(onOpenChange).toHaveBeenCalledWith(false, "tab");
    // Trapping focus is a dialog's job, not a menu's.
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test("a closed menu ignores every key", () => {
    const onFocusValue = vi.fn();
    const onOpenChange = vi.fn();
    for (const k of ["ArrowDown", "Home", "Escape", "d"]) {
      props({ onFocusValue, onOpenChange }).menu.onKeyDown(key(k));
    }
    expect(onFocusValue).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("getMenuProps — typeahead", () => {
  const open = (o: Partial<Parameters<typeof getMenuProps>[0]> = {}) =>
    props({ open: true, ...o });

  test("a letter jumps to the next item starting with it, case-insensitively", () => {
    const onFocusValue = vi.fn();
    open({ focusedValue: "dup", onFocusValue }).menu.onKeyDown(key("a"));
    expect(onFocusValue).toHaveBeenCalledWith("arch");
  });

  test("repeating a letter walks the matches instead of sticking on the first", () => {
    const items = [
      { value: "dup", text: "Duplicate" },
      { value: "del", text: "Delete" },
      { value: "down", text: "Download" },
    ];
    const seen: (string | null)[] = [];
    let focused: string | null = "dup";
    for (let i = 0; i < 3; i += 1) {
      getMenuProps({
        items,
        triggerId: "t",
        menuId: "m",
        open: true,
        focusedValue: focused,
        onFocusValue: (v) => {
          focused = v;
          seen.push(v);
        },
      }).menu.onKeyDown(key("d"));
    }
    // Walks the list and wraps, rather than reporting "dup" three times.
    expect(seen).toEqual(["del", "down", "dup"]);
  });

  test("an item with no text is skipped by typeahead but still exists", () => {
    const items = [{ value: "a", text: "Apple" }, { value: "b" }];
    const onFocusValue = vi.fn();
    getMenuProps({ items, triggerId: "t", menuId: "m", open: true, focusedValue: "a", onFocusValue })
      .menu.onKeyDown(key("b"));
    expect(onFocusValue).not.toHaveBeenCalled();
  });

  test("a letter matching nothing changes nothing and is not swallowed", () => {
    const onFocusValue = vi.fn();
    const e = key("z");
    open({ focusedValue: "dup", onFocusValue }).menu.onKeyDown(e);
    expect(onFocusValue).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  test("a modifier held down is a shortcut, not typing", () => {
    // `event.key` for Ctrl+D is just "d", so without the modifier check
    // typeahead both hijacked the browser's binding and preventDefault'd it.
    for (const modifier of ["ctrlKey", "metaKey", "altKey"] as const) {
      const onFocusValue = vi.fn();
      const event = { key: "d", [modifier]: true, preventDefault: vi.fn() };
      open({ focusedValue: "arch", onFocusValue }).menu.onKeyDown(event);
      expect(onFocusValue, modifier).not.toHaveBeenCalled();
      expect(event.preventDefault, modifier).not.toHaveBeenCalled();
    }
  });

  test("Space is not typeahead — it activates the focused item", () => {
    const onFocusValue = vi.fn();
    open({ focusedValue: "dup", onFocusValue }).menu.onKeyDown(key(" "));
    expect(onFocusValue).not.toHaveBeenCalled();
  });
});

describe("getMenuProps — a checkable row is a different role", () => {
  test("a plain row is a menuitem with no checked state", () => {
    const p = props({ open: true });
    expect(p.item("dup").role).toBe("menuitem");
    // ARIA does not support aria-checked on menuitem, so it must be absent
    // rather than false — a screen reader is free to ignore an unsupported
    // attribute, which would leave the row distinguished by colour alone.
    expect(p.item("dup")["aria-checked"]).toBeUndefined();
  });

  test("stating `selected` at all makes the row a menuitemradio", () => {
    const items = [
      { value: "name", selected: true },
      { value: "date", selected: false },
      { value: "other" },
    ];
    const p = getMenuProps({ items, triggerId: "t", menuId: "m", open: true });
    expect(p.item("name").role).toBe("menuitemradio");
    expect(p.item("name")["aria-checked"]).toBe(true);
    // False, not absent: every row of a radio set carries the state, or the
    // set is not announced as a set.
    expect(p.item("date").role).toBe("menuitemradio");
    expect(p.item("date")["aria-checked"]).toBe(false);
    // A row that says nothing stays a plain action.
    expect(p.item("other").role).toBe("menuitem");
    expect(p.item("other")["aria-checked"]).toBeUndefined();
  });
});

describe("getMenuProps — items", () => {
  test("exactly one item is the tab stop", () => {
    const p = props({ open: true, focusedValue: "del" });
    expect([p.item("dup").tabIndex, p.item("del").tabIndex, p.item("arch").tabIndex]).toEqual([
      -1, 0, -1,
    ]);
  });

  test("with nothing focused yet, the entry point is the tab stop", () => {
    const p = props({ open: true });
    expect(p.item("dup").tabIndex).toBe(0);
  });

  test("selecting closes before the handler runs", () => {
    const order: string[] = [];
    const p = props({
      open: true,
      onOpenChange: () => order.push("close"),
      onSelect: () => order.push("select"),
    });
    p.item("del").onClick(click());
    // So the wrapper has restored focus to the trigger before onSelect can
    // navigate away or open something else.
    expect(order).toEqual(["close", "select"]);
  });

  test("a disabled item refuses activation without closing the menu", () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    const items = [{ value: "a" }, { value: "b", disabled: true }];
    const p = getMenuProps({ items, triggerId: "t", menuId: "m", open: true, onSelect, onOpenChange });
    const e = click();
    p.item("b").onClick(e);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
    expect(p.item("b")["aria-disabled"]).toBe(true);
  });

  test("every item is a menuitem, and only disabled ones say so", () => {
    const p = props({ open: true });
    expect(p.item("dup").role).toBe("menuitem");
    expect(p.item("dup")["aria-disabled"]).toBeUndefined();
  });

  test("an empty menu reports no entry point instead of throwing", () => {
    const p = getMenuProps({ items: [], triggerId: "t", menuId: "m" });
    expect(p.firstValue).toBeNull();
    expect(p.lastValue).toBeNull();
    p.trigger.onClick(click());
    p.menu.onKeyDown(key("ArrowDown"));
  });
});
