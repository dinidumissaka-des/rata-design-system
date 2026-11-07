import { describe, expect, test, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Table } from "./table.js";
import type { TableColumn } from "./table.js";

afterEach(cleanup);

interface Invoice {
  id: string;
  number: string;
  due: string;
  amount: number;
  status: string;
}

const invoices: Invoice[] = [
  { id: "a", number: "INV-204", due: "2026-11-01", amount: 120, status: "Overdue" },
  { id: "b", number: "INV-205", due: "2026-11-20", amount: 80.5, status: "Open" },
];

const columns: TableColumn<Invoice>[] = [
  { key: "number", header: "Invoice", rowHeader: true },
  { key: "due", header: "Due", sortable: true },
  { key: "amount", header: "Amount", align: "end", sortable: true, cell: (i) => i.amount.toFixed(2) },
  { key: "status", header: "Status" },
];

describe("Table", () => {
  test("is a real table named by its caption", () => {
    render(<Table caption="Open invoices" columns={columns} rows={invoices} getRowKey={(i) => i.id} />);
    const table = screen.getByRole("table", { name: "Open invoices" });
    expect(table.querySelector("caption")?.textContent).toBe("Open invoices");
  });

  test("the scroll region is focusable and named by the caption", () => {
    render(<Table caption="Open invoices" columns={columns} rows={invoices} getRowKey={(i) => i.id} />);
    const region = screen.getByRole("region", { name: "Open invoices" });
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(region.className).toContain("rata-table-scroll");
  });

  test("headers are <th scope='col'>", () => {
    render(<Table caption="Invoices" columns={columns} rows={invoices} getRowKey={(i) => i.id} />);
    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual(["Invoice", "Due", "Amount", "Status"]);
    headers.forEach((h) => expect(h.getAttribute("scope")).toBe("col"));
  });

  test("the rowHeader column's cells are <th scope='row'>", () => {
    render(<Table caption="Invoices" columns={columns} rows={invoices} getRowKey={(i) => i.id} />);
    const rowHeaders = screen.getAllByRole("rowheader");
    expect(rowHeaders.map((h) => h.textContent)).toEqual(["INV-204", "INV-205"]);
    rowHeaders.forEach((h) => expect(h.getAttribute("scope")).toBe("row"));
  });

  test("cell renders from the row; without it the field named by key is shown", () => {
    render(<Table caption="Invoices" columns={columns} rows={invoices} getRowKey={(i) => i.id} />);
    const firstRow = screen.getAllByRole("row")[1]!;
    const cells = within(firstRow).getAllByRole("cell");
    expect(cells.map((c) => c.textContent)).toEqual(["2026-11-01", "120.00", "Overdue"]);
  });

  test("rows render in the order given — the table never sorts them", () => {
    const reversed = [...invoices].reverse();
    render(
      <Table
        caption="Invoices"
        columns={columns}
        rows={reversed}
        getRowKey={(i) => i.id}
        sort={{ key: "amount", direction: "ascending" }}
        onSortChange={() => {}}
      />
    );
    expect(screen.getAllByRole("rowheader").map((h) => h.textContent)).toEqual([
      "INV-205",
      "INV-204",
    ]);
  });

  test("aria-sort is on the sorted column's header only", () => {
    render(
      <Table
        caption="Invoices"
        columns={columns}
        rows={invoices}
        getRowKey={(i) => i.id}
        sort={{ key: "amount", direction: "descending" }}
        onSortChange={() => {}}
      />
    );
    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((h) => h.getAttribute("aria-sort"))).toEqual([
      null,
      null,
      "descending",
      null,
    ]);
  });

  test("sortable columns get a real button named by the header, when there is a handler", () => {
    const onSortChange = vi.fn();
    render(
      <Table
        caption="Invoices"
        columns={columns}
        rows={invoices}
        getRowKey={(i) => i.id}
        onSortChange={onSortChange}
      />
    );
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Due", "Amount"]);
    fireEvent.click(screen.getByRole("button", { name: "Due" }));
    expect(onSortChange).toHaveBeenCalledWith({ key: "due", direction: "ascending" });
  });

  test("clicking the sorted column flips its direction", () => {
    const onSortChange = vi.fn();
    render(
      <Table
        caption="Invoices"
        columns={columns}
        rows={invoices}
        getRowKey={(i) => i.id}
        sort={{ key: "amount", direction: "ascending" }}
        onSortChange={onSortChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Amount" }));
    expect(onSortChange).toHaveBeenCalledWith({ key: "amount", direction: "descending" });
  });

  test("without onSortChange no sort buttons are rendered", () => {
    render(<Table caption="Invoices" columns={columns} rows={invoices} getRowKey={(i) => i.id} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  test("the sort control composes the state layer and its indicator is decorative", () => {
    render(
      <Table
        caption="Invoices"
        columns={columns}
        rows={invoices}
        getRowKey={(i) => i.id}
        sort={{ key: "due", direction: "ascending" }}
        onSortChange={() => {}}
      />
    );
    const button = screen.getByRole("button", { name: "Due" });
    expect(button.className).toContain("rata-state-layer");
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  test("hideCaption keeps the name and hides the visible copy", () => {
    render(
      <Table caption="Deploys" hideCaption columns={columns} rows={invoices} getRowKey={(i) => i.id} />
    );
    const table = screen.getByRole("table", { name: "Deploys" });
    expect(table.querySelector("caption")?.className).toContain("rata-visually-hidden");
  });

  test("empty renders in one row spanning every column", () => {
    render(
      <Table
        caption="Deploys"
        columns={columns}
        rows={[]}
        getRowKey={(i) => i.id}
        empty={<p>No deploys yet</p>}
      />
    );
    const cell = screen.getByText("No deploys yet").closest("td")!;
    expect(cell.getAttribute("colspan")).toBe(String(columns.length));
  });

  test("compact is a class on the table; comfortable is the default", () => {
    const { container, rerender } = render(
      <Table caption="Invoices" columns={columns} rows={invoices} getRowKey={(i) => i.id} />
    );
    expect(container.querySelector("table")?.className).not.toContain("rata-table--compact");
    rerender(
      <Table caption="Invoices" density="compact" columns={columns} rows={invoices} getRowKey={(i) => i.id} />
    );
    expect(container.querySelector("table")?.className).toContain("rata-table--compact");
  });

  test("className goes on the scroll region", () => {
    render(
      <Table caption="Invoices" className="extra" columns={columns} rows={invoices} getRowKey={(i) => i.id} />
    );
    expect(screen.getByRole("region").className).toContain("extra");
  });
});
