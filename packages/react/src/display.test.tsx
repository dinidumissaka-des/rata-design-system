import { describe, expect, test, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Badge } from "./badge.js";
import { Breadcrumbs } from "./breadcrumbs.js";
import { Spinner } from "./spinner.js";
import { ButtonGroup } from "./button-group.js";
import { Button } from "./button.js";

afterEach(cleanup);

describe("Badge", () => {
  test("the text carries the meaning, so it is never colour-only", () => {
    render(<Badge variant="danger">Overdue</Badge>);
    expect(screen.getByText("Overdue")).toBeTruthy();
  });

  test("the dot is decorative and adds nothing to announce", () => {
    const { container } = render(<Badge variant="success" dot>Live</Badge>);
    expect(container.textContent).toBe("Live");
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });
});

describe("Breadcrumbs", () => {
  const items = [
    { label: "Home", href: "/" },
    { label: "Reports", href: "/reports" },
    { label: "Q3", href: "/reports/q3" },
  ];

  test("an ordered list inside a named landmark, so count and order are announced", () => {
    render(<Breadcrumbs items={items} />);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav.querySelector("ol")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  test("the last crumb is the current page: not a link, even with an href", () => {
    render(<Breadcrumbs items={items} />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Home", "Reports"]);
    const current = screen.getByText("Q3");
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(current.tagName).not.toBe("A");
  });

  test("the separator is hidden, so no one hears 'slash' between crumbs", () => {
    const { container } = render(<Breadcrumbs items={items} separator=">" />);
    const seps = [...container.querySelectorAll('[aria-hidden="true"]')];
    expect(seps.length).toBe(2);
    expect(seps.every((s) => s.textContent === ">")).toBe(true);
  });

  test("a distinct label renames the landmark for pages with several", () => {
    render(<Breadcrumbs items={items} label="Report location" />);
    expect(screen.getByRole("navigation", { name: "Report location" })).toBeTruthy();
  });
});

describe("Spinner", () => {
  test("a label makes the loading state its own live announcement", () => {
    render(<Spinner label="Loading results" />);
    expect(screen.getByRole("status", { name: "Loading results" })).toBeTruthy();
  });

  test("unlabelled it leaves the tree entirely, for when a parent already says it", () => {
    const { container } = render(<Spinner />);
    // Not merely unnamed — a second, silent status region would still be a
    // live region competing with the parent's own announcement.
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.querySelector(".rata-spinner")!.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("ButtonGroup", () => {
  test("label names the group", () => {
    render(
      <ButtonGroup label="Text style">
        <Button>Bold</Button>
      </ButtonGroup>
    );
    expect(screen.getByRole("group", { name: "Text style" })).toBeTruthy();
  });

  test("labelledBy wins over label, because it points at visible text", () => {
    render(
      <>
        <h2 id="h">Alignment</h2>
        <ButtonGroup label="Text style" labelledBy="h">
          <Button>Left</Button>
        </ButtonGroup>
      </>
    );
    expect(screen.getByRole("group", { name: "Alignment" })).toBeTruthy();
  });

  test("orientation styles only — it promises no arrow-key navigation", () => {
    render(
      <ButtonGroup label="Text style" orientation="vertical">
        <Button>Bold</Button>
        <Button>Italic</Button>
      </ButtonGroup>
    );
    const group = screen.getByRole("group");
    expect(group.getAttribute("aria-orientation")).toBeNull();
    // Both buttons stay their own tab stop, attached or not.
    expect(screen.getAllByRole("button").map((b) => b.tabIndex)).toEqual([0, 0]);
  });
});
