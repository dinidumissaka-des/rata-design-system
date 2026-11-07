import { describe, expect, test, afterEach } from "vitest";
import { createRef } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { Link } from "./link.js";

afterEach(cleanup);

describe("Link", () => {
  test("renders a real anchor with its href, so it is a link to assistive technology", () => {
    render(<Link href="/invoices">View invoices</Link>);
    const link = screen.getByRole("link", { name: "View invoices" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/invoices");
  });

  test("inline is the default and does not compose the state layer", () => {
    render(<Link href="/docs">contrast report</Link>);
    const link = screen.getByRole("link");
    expect(link.className).toContain("rata-link--inline");
    expect(link.className).not.toContain("rata-state-layer");
  });

  test("standalone composes the state layer for hover and press", () => {
    render(
      <Link href="/invoices" variant="standalone">
        View all invoices
      </Link>
    );
    const link = screen.getByRole("link");
    expect(link.className).toContain("rata-link--standalone");
    expect(link.className).toContain("rata-state-layer");
  });

  test("without newTab there is no target, rel or announcement", () => {
    render(<Link href="/a">Somewhere</Link>);
    const link = screen.getByRole("link", { name: "Somewhere" });
    expect(link.hasAttribute("target")).toBe(false);
    expect(link.hasAttribute("rel")).toBe(false);
    expect(link.querySelector("svg")).toBeNull();
  });

  test("newTab sets target and rel together and announces itself", () => {
    render(
      <Link href="https://example.com/help" newTab>
        Help with this form
      </Link>
    );
    const link = screen.getByRole("link", {
      // jsdom's name computation trims each child's text, so the space the
      // suffix carries is not visible here; a browser keeps it.
      name: /^Help with this form\s*\(opens in new tab\)$/,
    });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.querySelector(".rata-visually-hidden")?.textContent).toContain(
      "(opens in new tab)"
    );
  });

  test("the new-tab glyph is decorative, so it adds nothing to announce", () => {
    const { container } = render(
      <Link href="https://example.com" newTab>
        Docs
      </Link>
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  test("passes className and other anchor attributes through, and forwards its ref", () => {
    const ref = createRef<HTMLAnchorElement>();
    render(
      <Link ref={ref} href="/x" className="extra" data-testid="l">
        X
      </Link>
    );
    const link = screen.getByTestId("l");
    expect(link.className).toContain("extra");
    expect(ref.current).toBe(link);
  });
});
