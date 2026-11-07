import { describe, expect, test, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Card } from "./card.js";
import { Heading } from "./heading.js";

/**
 * Nothing below asserts a computed style: jsdom applies no stylesheet, so the
 * stretched link, the :has()-driven hover and the moved focus ring cannot be
 * observed here. What can be is the structure those rules depend on — the
 * element, the classes, where the media lands, and that the card itself never
 * becomes a control.
 */
afterEach(cleanup);

describe("Card", () => {
  test("is a div by default, claiming no role", () => {
    const { container } = render(<Card>Revenue</Card>);
    const card = container.firstElementChild!;
    expect(card.tagName).toBe("DIV");
    expect(card.hasAttribute("role")).toBe(false);
    expect(card.classList.contains("rata-card")).toBe(true);
  });

  test("`as` chooses the element, and adds no ARIA on top of it", () => {
    render(
      <ul>
        <Card as="li">One</Card>
        <Card as="li">Two</Card>
      </ul>
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    for (const item of screen.getAllByRole("listitem")) {
      expect(item.hasAttribute("role")).toBe(false);
    }

    cleanup();
    render(<Card as="article">Post</Card>);
    expect(screen.getByRole("article")).toBeTruthy();
  });

  test("a section card is a region named by its heading through aria-labelledby", () => {
    render(
      <Card as="section" aria-labelledby="billing-heading">
        <Heading level={2} id="billing-heading">
          Billing
        </Heading>
      </Card>
    );
    expect(screen.getByRole("region", { name: "Billing" })).toBeTruthy();
  });

  test("outlined by default; raised is the one alternative", () => {
    const { container, rerender } = render(<Card>Item</Card>);
    const card = container.firstElementChild!;
    expect(card.classList.contains("rata-card--outlined")).toBe(true);
    expect(card.classList.contains("rata-card--raised")).toBe(false);

    rerender(<Card variant="raised">Item</Card>);
    expect(container.firstElementChild!.classList.contains("rata-card--raised")).toBe(true);
  });

  test("composes the state layer, which card.css drives from the heading link", () => {
    const { container } = render(<Card>Item</Card>);
    expect(container.firstElementChild!.classList.contains("rata-state-layer")).toBe(true);
  });

  test("media renders first, in its own slot, and only when given", () => {
    const { container, rerender } = render(<Card>Body</Card>);
    expect(container.querySelector(".rata-card-media")).toBeNull();
    expect(container.firstElementChild!.classList.contains("rata-card--media")).toBe(false);

    rerender(
      <Card media={<img src="preview.png" alt="" />}>
        <p>Body</p>
      </Card>
    );
    const card = container.firstElementChild!;
    expect(card.classList.contains("rata-card--media")).toBe(true);
    expect(card.firstElementChild!.classList.contains("rata-card-media")).toBe(true);
    expect(card.firstElementChild!.querySelector("img")).toBeTruthy();
  });

  test("the card is never the control: the heading link is the one tab stop, named by its own text", () => {
    render(
      <Card as="article">
        <Heading level={3}>
          <a href="/projects/atlas">Atlas</a>
        </Heading>
        <p>A long summary that must not become part of the link's name.</p>
      </Card>
    );
    const link = screen.getByRole("link");
    expect(link.textContent).toBe("Atlas");
    const card = screen.getByRole("article");
    expect(card.hasAttribute("tabindex")).toBe(false);
    expect(card.hasAttribute("href")).toBe(false);
    expect(card.closest("a")).toBeNull();
  });

  test("className is added for placement, not instead of the card's own classes", () => {
    const { container } = render(<Card className="span-2">Item</Card>);
    const card = container.firstElementChild!;
    expect(card.classList.contains("span-2")).toBe(true);
    expect(card.classList.contains("rata-card")).toBe(true);
  });
});
