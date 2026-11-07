/**
 * Headless table behaviour — the sort cycle, and the attributes that make a
 * `<table>` say what it is.
 *
 * Pure function, no DOM and no framework. The wrapper builds the markup; this
 * decides what each part carries, so the web and native tables agree about
 * which column is sorted and what the next click asks for.
 *
 * SORTING IS CONTROLLED. Nothing here reorders data: the caller is the only
 * one who knows whether sorting happens in memory, on the server, or across
 * pages the table never sees. A click reports the request through
 * `onSortChange`, and the table renders whatever order it is then given.
 *
 * THE CYCLE HAS TWO STATES. A column not yet sorted goes to ascending; the
 * sorted column flips between ascending and descending. There is no third
 * click back to "unsorted", which would undo the reader's choice with no
 * visible reason.
 *
 * `aria-sort` goes on the sorted column's header ONLY. On every column it is
 * noise, and "none" on the unsorted ones says nothing a reader needs.
 */

export type TableSortDirection = "ascending" | "descending";

export interface TableSort {
  key: string;
  direction: TableSortDirection;
}

/** The parts of a column definition this reads. */
export interface TableColumnDescriptor {
  key: string;
  sortable?: boolean;
  rowHeader?: boolean;
}

export interface TableOptions {
  /** Id for the caption, which names both the table and its scroll region. */
  captionId: string;
  /** Which column the rows are currently sorted by, if any. */
  sort?: TableSort | null;
  /** Called with the requested sort. Without it, no column offers a control. */
  onSortChange?: (sort: TableSort) => void;
}

export interface TableHeaderProps {
  scope: "col";
  "aria-sort": TableSortDirection | undefined;
}

export interface TableSortButtonProps {
  type: "button";
  onClick: () => void;
}

export interface TableCellProps {
  /** `"row"` on the row-header column, which then renders as a `<th>`. */
  scope: "row" | undefined;
}

export interface TableProps {
  /**
   * The scroll wrapper. Focusable, because a keyboard user has no other way
   * to scroll a table wider than its column, and a region named by the
   * caption, so the tab stop announces which table it is.
   */
  region: { role: "region"; tabIndex: 0; "aria-labelledby": string };
  caption: { id: string };
  getHeaderProps(column: TableColumnDescriptor): TableHeaderProps;
  /**
   * The sort control for a column, or null when there is none: the column is
   * not `sortable`, or there is no `onSortChange` to report to. A header that
   * offered a control which did nothing would be worse than no control.
   */
  getSortButtonProps(column: TableColumnDescriptor): TableSortButtonProps | null;
  getCellProps(column: TableColumnDescriptor): TableCellProps;
}

/** What a click on `key`'s header asks for, given the current sort. */
export function nextTableSort(current: TableSort | null | undefined, key: string): TableSort {
  if (current && current.key === key) {
    return { key, direction: current.direction === "ascending" ? "descending" : "ascending" };
  }
  return { key, direction: "ascending" };
}

export function getTableProps(options: TableOptions): TableProps {
  const { captionId, sort = null, onSortChange } = options;

  return {
    region: { role: "region", tabIndex: 0, "aria-labelledby": captionId },
    caption: { id: captionId },
    getHeaderProps: (column) => ({
      scope: "col",
      "aria-sort": sort && sort.key === column.key ? sort.direction : undefined,
    }),
    getSortButtonProps: (column) => {
      if (!column.sortable || !onSortChange) return null;
      return {
        type: "button",
        onClick: () => onSortChange(nextTableSort(sort, column.key)),
      };
    },
    getCellProps: (column) => ({ scope: column.rowHeader ? "row" : undefined }),
  };
}
