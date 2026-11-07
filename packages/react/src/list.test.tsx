import { describe, expect, test, vi, afterEach, beforeAll } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { Archive, Trash2 } from "@rata/icons";
import { List } from "./list.js";
import { ListItem } from "./list-item.js";
import { installPopoverShim } from "./test-support.js";

beforeAll(installPopoverShim);
afterEach(cleanup);

describe("List", () => {
  test("is a ul with role=list restored, its rows the listitems", () => {
    render(
      <List label="Recent orders">
        <ListItem>One</ListItem>
        <ListItem>Two</ListItem>
      </List>
    );
    const list = screen.getByRole("list", { name: "Recent orders" });
    expect(list.tagName).toBe("UL");
    expect(list.getAttribute("role")).toBe("list");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  test("labelledBy names the list from a visible heading and wins over label", () => {
    render(
      <>
        <h2 id="n">Notifications</h2>
        <List labelledBy="n" label="ignored">
          <ListItem>Email</ListItem>
        </List>
      </>
    );
    const list = screen.getByRole("list", { name: "Notifications" });
    expect(list.getAttribute("aria-labelledby")).toBe("n");
    expect(list.hasAttribute("aria-label")).toBe(false);
  });

  test("appearance and dividers are classes; the defaults are plain and divided", () => {
    const { container, rerender } = render(
      <List label="x">
        <ListItem>One</ListItem>
      </List>
    );
    const ul = container.querySelector("ul")!;
    expect(ul.className).toContain("rata-list--plain");
    expect(ul.className).not.toContain("rata-list--undivided");
    rerender(
      <List label="x" appearance="inset" dividers={false}>
        <ListItem>One</ListItem>
      </List>
    );
    expect(ul.className).toContain("rata-list--inset");
    expect(ul.className).toContain("rata-list--undivided");
  });
});

describe("ListItem", () => {
  const inList = (row: ReactElement) => render(<List label="Rows">{row}</List>);

  test("a static row has no link, no button and no state layer", () => {
    const { container } = inList(<ListItem description="10 pm – 7 am">Quiet hours</ListItem>);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("li")!.className).not.toContain("rata-state-layer");
  });

  test("href makes a link named by the text alone, described by the description", () => {
    const { container } = inList(
      <ListItem href="/settings/quiet-hours" description="10 pm – 7 am">
        Quiet hours
      </ListItem>
    );
    const link = screen.getByRole("link", { name: "Quiet hours" });
    expect(link.getAttribute("href")).toBe("/settings/quiet-hours");
    expect(link.getAttribute("aria-describedby")).toBe(
      container.querySelector(".rata-list-item-description")!.id
    );
    // The state layer goes on the row; the stretch is on the link.
    const li = container.querySelector("li")!;
    expect(li.className).toContain("rata-state-layer");
    expect(li.contains(link)).toBe(true);
    // The decorative chevron is shown only for href rows, hidden from AT.
    expect(container.querySelector(".rata-list-item-chevron")!.getAttribute("aria-hidden")).toBe(
      "true"
    );
  });

  test("onClick alone makes a type=button button, not a link", async () => {
    const onClick = vi.fn();
    const { container } = inList(<ListItem onClick={onClick}>Open sheet</ListItem>);
    const button = screen.getByRole("button", { name: "Open sheet" });
    expect(button.getAttribute("type")).toBe("button");
    expect(container.querySelector(".rata-list-item-chevron")).toBeNull();
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("href with onClick stays a link and hands the click to the router", () => {
    const onClick = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    inList(
      <ListItem href="/people/ada" onClick={onClick}>
        Ada
      </ListItem>
    );
    fireEvent.click(screen.getByRole("link", { name: "Ada" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("the row element is never the li with a role bolted on", () => {
    const { container } = inList(<ListItem onClick={() => {}}>Row</ListItem>);
    expect(container.querySelector("li")!.hasAttribute("role")).toBe(false);
  });

  test("actions render a Menu behind a trigger named after its row", async () => {
    const archive = vi.fn();
    const remove = vi.fn();
    inList(
      <ListItem
        href="/mail/42"
        actions={[
          { label: "Archive", icon: Archive, onSelect: archive },
          { label: "Delete", icon: Trash2, destructive: true, onSelect: remove },
        ]}
      >
        Invoice 42
      </ListItem>
    );
    const trigger = screen.getByRole("button", { name: "More actions Invoice 42" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    // The link's name is still the row text alone.
    expect(screen.getByRole("link", { name: "Invoice 42" })).toBeTruthy();
    await userEvent.click(trigger);
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Archive", "Delete"]);
    expect(items[1]!.className).toContain("rata-menu-item--destructive");
    await userEvent.click(items[0]!);
    expect(archive).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });

  test("actionsLabel replaces the trigger's own part of the name", () => {
    inList(
      <ListItem actionsLabel="Plus d’actions" actions={[{ label: "Archiver", onSelect: () => {} }]}>
        Facture 42
      </ListItem>
    );
    expect(screen.getByRole("button", { name: "Plus d’actions Facture 42" })).toBeTruthy();
  });

  test("disabled blocks the row and its actions, and keeps both focusable", async () => {
    const onClick = vi.fn();
    const onSelect = vi.fn();
    const { container } = inList(
      <ListItem href="/files/1" onClick={onClick} disabled actions={[{ label: "Delete", onSelect }]}>
        report.pdf
      </ListItem>
    );
    const link = screen.getByRole("link", { name: "report.pdf" });
    expect(link.getAttribute("aria-disabled")).toBe("true");
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(onClick).not.toHaveBeenCalled();

    const trigger = screen.getByRole("button", { name: "More actions report.pdf" });
    expect(trigger.getAttribute("aria-disabled")).toBe("true");
    expect(trigger.hasAttribute("disabled")).toBe(false);
    await userEvent.click(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(container.querySelector("li")!.className).toContain("rata-list-item--disabled");

    link.focus();
    expect(document.activeElement).toBe(link);
  });

  test("a disabled button row refuses clicks but stays in the tab order", async () => {
    const onClick = vi.fn();
    inList(
      <ListItem onClick={onClick} disabled>
        Upload
      </ListItem>
    );
    const button = screen.getByRole("button", { name: "Upload" });
    expect(button.hasAttribute("disabled")).toBe(false);
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  test("a leading slot marks the row so its divider starts at the text column", () => {
    const { container } = inList(<ListItem leading={<span>A</span>}>Ada</ListItem>);
    expect(container.querySelector("li")!.className).toContain("rata-list-item--leading");
    expect(container.querySelector(".rata-list-item-leading")).toBeTruthy();
  });
});
