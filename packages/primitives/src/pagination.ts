/**
 * Headless pagination behaviour — which items a page row shows.
 *
 * A pure function from `page` and `pageCount` to the list of items, with no
 * DOM and no framework. It is a primitive rather than a loop inside the React
 * component because the native package needs exactly the same window, and two
 * copies of "which numbers are visible" is how the web and native rows would
 * come to disagree about where the gaps are.
 *
 * THE WINDOW IS FIXED: the first page, the last page, the current page and one
 * either side of it, with an ellipsis wherever pages are skipped. That is
 * "1 … 4 5 6 … 20" — at most seven numbers-and-gaps whatever `pageCount` is, so
 * the row cannot grow with the result set. There is deliberately no
 * `siblingCount`: a row whose width each page picks for itself gains nothing.
 *
 * PREVIOUS AND NEXT ARE ALWAYS PRESENT. On the first page Previous is
 * `unavailable`, and on the last page Next is; neither is removed, so the row
 * keeps its shape and a screen-reader user hears the same count on every page.
 */

/** One entry in the pagination row, in reading order. */
export type PaginationItem =
  | {
      type: "previous" | "next";
      /** The page this goes to. Meaningless when `unavailable`. */
      page: number;
      /** First page's Previous, last page's Next: announced, not actionable. */
      unavailable: boolean;
    }
  | {
      type: "page";
      page: number;
      /** The page the reader is on — `aria-current="page"`. */
      current: boolean;
    }
  | {
      type: "ellipsis";
      /** Which gap: before or after the current page's neighbours. */
      position: "start" | "end";
    };

export interface PaginationOptions {
  /** The current page, counting from 1. Clamped into `1..pageCount`. */
  page: number;
  /** How many pages there are. */
  pageCount: number;
}

/**
 * The items to render, or an empty list when there is nothing to page — a
 * count of one or fewer, where a landmark with nowhere to go is noise.
 */
export function getPaginationItems(options: PaginationOptions): PaginationItem[] {
  const pageCount = Math.floor(options.pageCount);
  if (!Number.isFinite(pageCount) || pageCount <= 1) return [];
  const page = Math.min(Math.max(1, Math.floor(options.page) || 1), pageCount);

  // The fixed window: first, last, current, and one either side of current.
  const shown = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  const numbers = [...shown].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);

  const items: PaginationItem[] = [
    { type: "previous", page: Math.max(1, page - 1), unavailable: page === 1 },
  ];
  numbers.forEach((n, index) => {
    const before = numbers[index - 1];
    if (before !== undefined && n - before > 1) {
      items.push({ type: "ellipsis", position: n <= page ? "start" : "end" });
    }
    items.push({ type: "page", page: n, current: n === page });
  });
  items.push({ type: "next", page: Math.min(pageCount, page + 1), unavailable: page === pageCount });
  return items;
}
