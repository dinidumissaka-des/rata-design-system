import { describe, expect, test, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FileText } from "@rata/icons";
import { EmptyState } from "./empty-state.js";

afterEach(cleanup);

const root = (container: HTMLElement) => container.firstElementChild as HTMLElement;

describe("EmptyState", () => {
  test("a div with the title as a paragraph, never a heading", () => {
    const { container } = render(<EmptyState title="No invoices yet" />);
    const el = root(container);
    expect(el.tagName).toBe("DIV");
    expect(el.classList.contains("rata-empty-state")).toBe(true);
    const title = el.querySelector(".rata-empty-state-title")!;
    expect(title.tagName).toBe("P");
    expect(title.textContent).toBe("No invoices yet");
    expect(screen.queryByRole("heading")).toBeNull();
  });

  test("silent by default: no role, so it is read in place", () => {
    const { container } = render(<EmptyState title="No invoices yet" />);
    expect(root(container).hasAttribute("role")).toBe(false);
    expect(root(container).hasAttribute("aria-live")).toBe(false);
  });

  test("live maps to status (polite) or alert (assertive)", () => {
    const { rerender } = render(<EmptyState live="polite" title="No tokens match ‘teal’" />);
    expect(screen.getByRole("status").textContent).toContain("No tokens match");

    rerender(<EmptyState live="assertive" title="No tokens match ‘teal’" />);
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  test("the icon renders at the large step and is aria-hidden", () => {
    const { container } = render(<EmptyState icon={FileText} title="No invoices yet" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.classList.contains("rata-icon--lg")).toBe(true);
    expect(svg.classList.contains("rata-empty-state-icon")).toBe(true);
  });

  test("no icon when it is omitted or false", () => {
    const { container, rerender } = render(<EmptyState title="No invoices yet" />);
    expect(container.querySelector("svg")).toBeNull();
    rerender(<EmptyState icon={false} title="No invoices yet" />);
    expect(container.querySelector("svg")).toBeNull();
  });

  test("description and action render after the title, in reading order, only when given", () => {
    const { container, rerender } = render(<EmptyState title="No invoices yet" />);
    expect(container.querySelector(".rata-empty-state-description")).toBeNull();
    expect(container.querySelector(".rata-empty-state-action")).toBeNull();

    rerender(
      <EmptyState
        title="No invoices yet"
        description="Invoices you send will appear here."
        action={<button type="button">Create invoice</button>}
      />
    );
    const children = Array.from(root(container).children).map((c) => c.className);
    expect(children).toEqual([
      "rata-empty-state-title",
      "rata-empty-state-description",
      "rata-empty-state-action",
    ]);
    expect(screen.getByRole("button", { name: "Create invoice" })).toBeTruthy();
  });

  test("className is added for placement, alongside the component's own class", () => {
    const { container } = render(<EmptyState title="Nothing" className="list-empty" />);
    expect(root(container).classList.contains("list-empty")).toBe(true);
    expect(root(container).classList.contains("rata-empty-state")).toBe(true);
  });
});
