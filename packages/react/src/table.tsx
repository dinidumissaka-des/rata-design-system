import { useId } from "react";
import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import { getTableProps } from "@rata/primitives";
import type { TableSort, TableSortDirection } from "@rata/primitives";
import { Icon, ChevronUp, ChevronDown } from "@rata/icons";
import { cx } from "./cx.js";

export type { TableSort, TableSortDirection };

/** How a column's content lines up. `end` for numbers, so digits align. */
export type TableAlign = "start" | "end";

/** How tall each row is. */
export type TableDensity = "comfortable" | "compact";

export interface TableColumn<Row> {
  /** The column's identity, and the field read from each row when there is no `cell`. */
  key: string;
  /** The column header. Never empty — an unnamed column is announced as nothing. */
  header: ReactNode;
  /** Renders the cell from the row: a Badge, a Link, a formatted number. */
  cell?: (row: Row) => ReactNode;
  /** `end` on numeric columns. */
  align?: TableAlign;
  /** Offers a sort control in the header — only when the table has `onSortChange`. */
  sortable?: boolean;
  /** The column that identifies each record; its cells become `<th scope="row">`. */
  rowHeader?: boolean;
}

export interface TableProps<Row>
  extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "role" | "tabIndex"> {
  /** The table's name. Required. */
  caption: string;
  /** Keeps the caption as the accessible name but hides it visually. */
  hideCaption?: boolean;
  /** The columns, in reading order. */
  columns: TableColumn<Row>[];
  /** The records, in the order they are shown. */
  rows: Row[];
  /** A stable identity for each row. */
  getRowKey: (row: Row) => string;
  /** Which column the rows are currently sorted by, if any. */
  sort?: TableSort | null;
  /** Called when the reader asks to sort by a column. */
  onSortChange?: (sort: TableSort) => void;
  /** How tall each row is. */
  density?: TableDensity;
  /** What to show in place of the rows when there are none. */
  empty?: ReactNode;
  /** Extra classes on the scroll region, for placement. */
  className?: string;
}

/** The row's own field, when a column has no `cell` renderer. */
function defaultCell(row: unknown, key: string): ReactNode {
  const value = (row as Record<string, unknown> | null)?.[key];
  if (value == null || typeof value === "boolean") return null;
  if (typeof value === "string" || typeof value === "number") return value;
  return String(value);
}

/**
 * Rows of records compared column by column.
 *
 * A real `<table>` with a `<caption>`, `<th scope="col">` headers, `<th
 * scope="row">` for the `rowHeader` column and `aria-sort` on the sorted
 * column only, inside a focusable `role="region"` named by the caption — the
 * one way a keyboard user can scroll a table wider than its column.
 *
 * Data-driven, like Breadcrumbs and SideNav, because hand-assembled
 * `<tr>`/`<td>` markup is where scope, header association and sort state go
 * missing.
 *
 * SORTING IS CONTROLLED: a header's `<button>` reports the request through
 * `onSortChange` (ascending first, then flipping) and the table renders
 * `rows` in exactly the order it is given. Rows are never clickable — a row
 * that leads somewhere puts a Link in its row-header cell.
 *
 * Out of this version: row selection, sticky headers, column resizing and
 * virtualisation.
 */
export function Table<Row>(props: TableProps<Row>): ReactElement;
// The implementation signature is not generic: overloads let callers keep
// `Row` while the parser that derives this component's props and defaults
// reads the plain destructuring below.
export function Table({
  caption,
  hideCaption = false,
  columns,
  rows,
  getRowKey,
  sort = null,
  onSortChange,
  density = "comfortable",
  empty,
  className,
  ...rest
}: TableProps<any>): ReactElement {
  const captionId = useId();
  const table = getTableProps({ captionId, sort, onSortChange });

  return (
    <div {...rest} {...table.region} className={cx("rata-table-scroll", className)}>
      <table className={cx("rata-table", density === "compact" && "rata-table--compact")}>
        <caption
          {...table.caption}
          className={cx("rata-table-caption", hideCaption && "rata-visually-hidden")}
        >
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const button = table.getSortButtonProps(column);
              const headerProps = table.getHeaderProps(column);
              const direction = headerProps["aria-sort"];
              return (
                <th
                  key={column.key}
                  {...headerProps}
                  className={cx(
                    "rata-table-header",
                    column.align === "end" && "rata-table-header--end",
                    button && "rata-table-header--sortable"
                  )}
                >
                  {button ? (
                    <button
                      {...button}
                      className="rata-table-sort rata-state-layer rata-state-layer--flush"
                    >
                      {column.header}
                      {direction && (
                        <Icon icon={direction === "ascending" ? ChevronUp : ChevronDown} />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty != null ? (
            <tr>
              <td className="rata-table-cell rata-table-empty" colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((column) => {
                  const Cell = column.rowHeader ? "th" : "td";
                  return (
                    <Cell
                      key={column.key}
                      {...table.getCellProps(column)}
                      className={cx(
                        "rata-table-cell",
                        column.align === "end" && "rata-table-cell--end"
                      )}
                    >
                      {column.cell ? column.cell(row) : defaultCell(row, column.key)}
                    </Cell>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
