import { describe, expect, test, vi } from "vitest";
import { getTableProps, nextTableSort } from "./table.js";

const props = (o: Partial<Parameters<typeof getTableProps>[0]> = {}) =>
  getTableProps({ captionId: "cap", ...o });

describe("nextTableSort", () => {
  test("an unsorted column starts ascending", () => {
    expect(nextTableSort(null, "amount")).toEqual({ key: "amount", direction: "ascending" });
  });

  test("the sorted column flips between ascending and descending", () => {
    expect(nextTableSort({ key: "amount", direction: "ascending" }, "amount")).toEqual({
      key: "amount",
      direction: "descending",
    });
    expect(nextTableSort({ key: "amount", direction: "descending" }, "amount")).toEqual({
      key: "amount",
      direction: "ascending",
    });
  });

  test("there is no third state: it never returns to unsorted", () => {
    let sort = nextTableSort(null, "due");
    for (let i = 0; i < 5; i += 1) {
      sort = nextTableSort(sort, "due");
      expect(sort).not.toBeNull();
    }
  });

  test("a different column starts ascending, whatever the current direction", () => {
    expect(nextTableSort({ key: "amount", direction: "descending" }, "due")).toEqual({
      key: "due",
      direction: "ascending",
    });
  });
});

describe("getTableProps", () => {
  test("the scroll region is focusable and named by the caption", () => {
    const p = props();
    expect(p.region).toEqual({ role: "region", tabIndex: 0, "aria-labelledby": "cap" });
    expect(p.caption.id).toBe("cap");
  });

  test("headers are column headers", () => {
    expect(props().getHeaderProps({ key: "due" }).scope).toBe("col");
  });

  test("aria-sort is on the sorted column only", () => {
    const p = props({ sort: { key: "amount", direction: "descending" } });
    expect(p.getHeaderProps({ key: "amount" })["aria-sort"]).toBe("descending");
    expect(p.getHeaderProps({ key: "due" })["aria-sort"]).toBeUndefined();
    expect(props().getHeaderProps({ key: "amount" })["aria-sort"]).toBeUndefined();
  });

  test("a sortable column gets a button that reports the next sort", () => {
    const onSortChange = vi.fn();
    const p = props({ sort: { key: "amount", direction: "ascending" }, onSortChange });
    const button = p.getSortButtonProps({ key: "amount", sortable: true })!;
    expect(button.type).toBe("button");
    button.onClick();
    expect(onSortChange).toHaveBeenCalledWith({ key: "amount", direction: "descending" });
  });

  test("no control without onSortChange, even on a sortable column", () => {
    expect(props().getSortButtonProps({ key: "amount", sortable: true })).toBeNull();
  });

  test("no control on a column that is not sortable", () => {
    expect(props({ onSortChange: vi.fn() }).getSortButtonProps({ key: "status" })).toBeNull();
  });

  test("the row-header column's cells are row headers; others are plain cells", () => {
    const p = props();
    expect(p.getCellProps({ key: "number", rowHeader: true }).scope).toBe("row");
    expect(p.getCellProps({ key: "amount" }).scope).toBeUndefined();
  });
});
