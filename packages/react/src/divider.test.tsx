import { describe, expect, test, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Divider } from "./divider.js";

afterEach(cleanup);

describe("Divider", () => {
  test("horizontal by default: an <hr>, announced as a separator", () => {
    const { container } = render(<Divider />);
    const rule = container.firstElementChild!;
    expect(rule.tagName).toBe("HR");
    expect(rule.hasAttribute("role")).toBe(false);
    expect(rule.hasAttribute("aria-hidden")).toBe(false);
    expect(rule.classList.contains("rata-divider--horizontal")).toBe(true);
    expect(screen.getByRole("separator")).toBe(rule);
  });

  test("vertical is a div with role=separator and aria-orientation, not an <hr>", () => {
    render(<Divider orientation="vertical" />);
    const rule = screen.getByRole("separator");
    expect(rule.tagName).toBe("DIV");
    expect(rule.getAttribute("aria-orientation")).toBe("vertical");
    expect(rule.classList.contains("rata-divider--vertical")).toBe(true);
  });

  test("decorative hides a horizontal rule and drops its role", () => {
    const { container } = render(<Divider decorative />);
    const rule = container.firstElementChild!;
    expect(rule.tagName).toBe("HR");
    expect(rule.getAttribute("aria-hidden")).toBe("true");
    expect(rule.getAttribute("role")).toBe("none");
    expect(screen.queryByRole("separator")).toBeNull();
  });

  test("decorative hides a vertical rule, keeping the same element", () => {
    const { container } = render(<Divider orientation="vertical" decorative />);
    const rule = container.firstElementChild!;
    expect(rule.tagName).toBe("DIV");
    expect(rule.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("separator")).toBeNull();
  });

  test("className is added for placement, alongside the divider's own classes", () => {
    const { container } = render(<Divider className="page-break" />);
    const rule = container.firstElementChild!;
    expect(rule.classList.contains("page-break")).toBe(true);
    expect(rule.classList.contains("rata-divider")).toBe(true);
  });
});
