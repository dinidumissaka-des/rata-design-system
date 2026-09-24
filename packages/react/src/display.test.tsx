import { describe, expect, test, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Badge } from "./badge.js";
import { Heading } from "./heading.js";
import { Text } from "./text.js";
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

describe("Heading", () => {
  test("level decides the element, and nothing else does", () => {
    const { container } = render(<Heading level={3}>Known gaps</Heading>);
    expect(container.querySelector("h3")).toBeTruthy();
  });

  test("role moves the size and leaves the outline alone", () => {
    const { container } = render(
      <Heading level={2} role="display-1">
        Design tokens
      </Heading>
    );
    const el = container.querySelector("h2");
    expect(el).toBeTruthy();
    expect(el?.className).toContain("rata-heading--display-1");
  });

  test("role defaults to the matching heading step, so the common case says it once", () => {
    const { container } = render(<Heading level={4}>Contrast</Heading>);
    expect(container.querySelector("h4")?.className).toContain("rata-heading--heading-4");
  });

  test("the type step never leaks out as ARIA's role attribute", () => {
    const { container } = render(
      <Heading level={1} role="display-3">
        Design tokens
      </Heading>
    );
    // A heading's role in the accessibility tree comes from its level. If this
    // prop reached the DOM it would overwrite exactly that, which is the one
    // thing the component exists to keep correct.
    expect(container.querySelector("h1")?.hasAttribute("role")).toBe(false);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });
});

describe("Text", () => {
  test("a block by default, a run when asked", () => {
    const { container } = render(<Text>Last synced</Text>);
    expect(container.querySelector("p")).toBeTruthy();

    cleanup();
    const run = render(<Text as="span">four minutes ago</Text>);
    expect(run.container.querySelector("span")).toBeTruthy();
  });

  test("body and primary are the defaults, so plain text needs no props", () => {
    const { container } = render(<Text>Every value comes from a token.</Text>);
    const el = container.querySelector("p");
    expect(el?.className).toContain("rata-text--body");
    expect(el?.className).toContain("rata-text--primary");
  });

  test("role and tone are separate: smaller is not dimmer", () => {
    const { container } = render(
      <Text role="supporting" tone="secondary">
        Used for billing receipts only.
      </Text>
    );
    const el = container.querySelector("p");
    expect(el?.className).toContain("rata-text--supporting");
    expect(el?.className).toContain("rata-text--secondary");
  });

  test("the label role capitalises in CSS, so the text stays as typed", () => {
    render(<Text role="label">Notifications</Text>);
    // Typed in capitals, a screen reader may spell it out letter by letter.
    // text-transform leaves the accessibility tree holding the original.
    expect(screen.getByText("Notifications").textContent).toBe("Notifications");
  });

  test("the type step never leaks out as ARIA's role attribute", () => {
    const { container } = render(<Text role="label">Notifications</Text>);
    expect(container.querySelector("p")?.hasAttribute("role")).toBe(false);
  });
});
