import { describe, expect, test } from "vitest";
import { getPaginationItems } from "./pagination.js";
import type { PaginationItem } from "./pagination.js";

/** The row as a reader sees it: "‹ 1 … 4 [5] 6 … 20 ›". */
function shape(items: PaginationItem[]): string {
  return items
    .map((item) => {
      if (item.type === "previous") return item.unavailable ? "(‹)" : "‹";
      if (item.type === "next") return item.unavailable ? "(›)" : "›";
      if (item.type === "ellipsis") return "…";
      return item.current ? `[${item.page}]` : String(item.page);
    })
    .join(" ");
}

describe("getPaginationItems", () => {
  test("the window is first, last, current and one either side", () => {
    expect(shape(getPaginationItems({ page: 5, pageCount: 20 }))).toBe(
      "‹ 1 … 4 [5] 6 … 20 ›"
    );
  });

  test("never more than seven numbers and gaps, whatever the count", () => {
    for (const pageCount of [2, 5, 7, 8, 20, 1000]) {
      for (let page = 1; page <= pageCount; page += Math.max(1, Math.floor(pageCount / 13))) {
        const middle = getPaginationItems({ page, pageCount }).filter(
          (item) => item.type === "page" || item.type === "ellipsis"
        );
        expect(middle.length).toBeLessThanOrEqual(7);
      }
    }
  });

  test("Previous stays on the first page, unavailable rather than removed", () => {
    expect(shape(getPaginationItems({ page: 1, pageCount: 20 }))).toBe("(‹) [1] 2 … 20 ›");
  });

  test("Next stays on the last page, unavailable rather than removed", () => {
    expect(shape(getPaginationItems({ page: 20, pageCount: 20 }))).toBe("‹ 1 … 19 [20] (›)");
  });

  test("Previous and Next point at the neighbouring pages", () => {
    const items = getPaginationItems({ page: 5, pageCount: 20 });
    expect(items[0]).toEqual({ type: "previous", page: 4, unavailable: false });
    expect(items[items.length - 1]).toEqual({ type: "next", page: 6, unavailable: false });
  });

  test("no ellipsis where no page is skipped", () => {
    expect(shape(getPaginationItems({ page: 2, pageCount: 4 }))).toBe("‹ 1 [2] 3 4 ›");
    expect(shape(getPaginationItems({ page: 3, pageCount: 20 }))).toBe("‹ 1 2 [3] 4 … 20 ›");
  });

  test("the ellipses say which side of the current page they are on", () => {
    const gaps = getPaginationItems({ page: 10, pageCount: 20 }).filter(
      (item) => item.type === "ellipsis"
    );
    expect(gaps).toEqual([
      { type: "ellipsis", position: "start" },
      { type: "ellipsis", position: "end" },
    ]);
  });

  test("exactly one page is current", () => {
    const current = getPaginationItems({ page: 7, pageCount: 9 }).filter(
      (item) => item.type === "page" && item.current
    );
    expect(current).toEqual([{ type: "page", page: 7, current: true }]);
  });

  test("a count of one or fewer has nothing to page", () => {
    expect(getPaginationItems({ page: 1, pageCount: 1 })).toEqual([]);
    expect(getPaginationItems({ page: 1, pageCount: 0 })).toEqual([]);
  });

  test("a page outside the range is clamped rather than rendering no current page", () => {
    expect(shape(getPaginationItems({ page: 99, pageCount: 3 }))).toBe("‹ 1 2 [3] (›)");
    expect(shape(getPaginationItems({ page: 0, pageCount: 3 }))).toBe("(‹) [1] 2 3 ›");
  });
});
