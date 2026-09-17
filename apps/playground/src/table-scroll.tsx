import type { ReactNode } from "react";

/**
 * A dense table, in a region that scrolls sideways when it does not fit.
 *
 * This repo's frame guidance sends dense, scannable rows to a `<table>` rather
 * than to cards, and that is still right on a phone — a contrast pairing is
 * four columns whichever device is reading it, and stacking each row into a
 * definition list stops the columns lining up, which is the entire reason the
 * table was chosen. What a narrow screen cannot do is make the table narrower:
 * a table will not lay out below its content's minimum width, so the widest
 * one here (`Verified contrast`, four columns of token paths) measured 543px
 * against a 390px viewport and took the whole page into horizontal scroll with
 * it — every page of prose beside it dragged sideways by one table.
 *
 * So the table keeps its width and this takes the overflow. `tabIndex` is not
 * decoration: a scrollable region has to be reachable by keyboard, because a
 * reader who cannot swipe it has no other way to see the columns that are off
 * the edge. It is a plain scroll container rather than `role="region"`, which
 * would need a name of its own — the heading above each table is already that,
 * and a second, unnamed landmark per table is worse than none.
 */
export function TableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="pg-table-scroll" tabIndex={0}>
      {children}
    </div>
  );
}
