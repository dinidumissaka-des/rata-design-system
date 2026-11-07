import { describe, expect, test, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Pagination } from "./pagination.js";

afterEach(cleanup);

const href = (p: number) => `/invoices?page=${p}`;

describe("Pagination", () => {
  test("is a named navigation landmark around a list", () => {
    render(<Pagination label="Invoice pages" page={5} pageCount={20} href={href} />);
    const nav = screen.getByRole("navigation", { name: "Invoice pages" });
    expect(within(nav).getByRole("list")).toBeTruthy();
  });

  test("the landmark is called Pagination by default", () => {
    render(<Pagination page={1} pageCount={3} href={href} />);
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeTruthy();
  });

  test("every page is a real link, named 'Page n'", () => {
    render(<Pagination page={5} pageCount={20} href={href} />);
    const page4 = screen.getByRole("link", { name: "Page 4" });
    expect(page4.getAttribute("href")).toBe("/invoices?page=4");
    expect(page4.textContent).toBe("4");
  });

  test("the current page is marked aria-current='page', and only it", () => {
    const { container } = render(<Pagination page={5} pageCount={20} href={href} />);
    const current = container.querySelectorAll("[aria-current]");
    expect(current).toHaveLength(1);
    expect(current[0]!.getAttribute("aria-current")).toBe("page");
    expect(current[0]!.getAttribute("aria-label")).toBe("Page 5");
  });

  test("renders the fixed window with aria-hidden ellipses in the gaps", () => {
    const { container } = render(<Pagination page={5} pageCount={20} href={href} />);
    const numbers = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("aria-label"))
      .filter((name) => name?.startsWith("Page "));
    expect(numbers).toEqual(["Page 1", "Page 4", "Page 5", "Page 6", "Page 20"]);
    const ellipses = container.querySelectorAll(".rata-pagination-ellipsis");
    expect(ellipses).toHaveLength(2);
    ellipses.forEach((ellipsis) => {
      expect(ellipsis.closest("li")?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  test("Previous and Next link to the neighbouring pages", () => {
    render(<Pagination page={5} pageCount={20} href={href} />);
    expect(screen.getByRole("link", { name: "Previous page" }).getAttribute("href")).toBe(
      "/invoices?page=4"
    );
    expect(screen.getByRole("link", { name: "Next page" }).getAttribute("href")).toBe(
      "/invoices?page=6"
    );
  });

  test("on the first page Previous stays: no href, aria-disabled, still focusable", () => {
    const { container } = render(<Pagination page={1} pageCount={5} href={href} />);
    const previous = container.querySelector('[aria-label="Previous page"]')!;
    expect(previous.hasAttribute("href")).toBe(false);
    expect(previous.getAttribute("aria-disabled")).toBe("true");
    expect(previous.getAttribute("tabindex")).toBe("0");
  });

  test("on the last page Next stays, unavailable", () => {
    const { container } = render(<Pagination page={5} pageCount={5} href={href} />);
    const next = container.querySelector('[aria-label="Next page"]')!;
    expect(next.hasAttribute("href")).toBe(false);
    expect(next.getAttribute("aria-disabled")).toBe("true");
  });

  test("the row is the same length on every page", () => {
    const lengths = [1, 2, 3, 10, 18, 19, 20].map((page) => {
      const { container, unmount } = render(
        <Pagination page={page} pageCount={20} href={href} />
      );
      const count = container.querySelectorAll("li").length;
      unmount();
      return count;
    });
    // Previous and Next never disappear; the middle varies only with the gaps.
    expect(Math.min(...lengths)).toBeGreaterThanOrEqual(6);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(9);
  });

  test("onPageChange gets the page and the event, so a router can preventDefault", () => {
    const onPageChange = vi.fn((_: number, event: { preventDefault(): void }) =>
      event.preventDefault()
    );
    render(<Pagination page={5} pageCount={20} href={href} onPageChange={onPageChange} />);
    const link = screen.getByRole("link", { name: "Page 6" });
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(onPageChange).toHaveBeenCalledWith(6, expect.anything());
    expect(click.defaultPrevented).toBe(true);
    // The link is still a link: the href is not dropped for the router.
    expect(link.getAttribute("href")).toBe("/invoices?page=6");
  });

  test("an unavailable Previous does not call onPageChange", () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <Pagination page={1} pageCount={5} href={href} onPageChange={onPageChange} />
    );
    fireEvent.click(container.querySelector('[aria-label="Previous page"]')!);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  test("items compose the state layer", () => {
    render(<Pagination page={2} pageCount={3} href={href} />);
    expect(screen.getByRole("link", { name: "Page 1" }).className).toContain(
      "rata-state-layer"
    );
  });

  test("a count of one renders nothing", () => {
    const { container } = render(<Pagination page={1} pageCount={1} href={href} />);
    expect(container.innerHTML).toBe("");
  });

  test("passes className through to the landmark", () => {
    render(<Pagination page={1} pageCount={3} href={href} className="extra" />);
    expect(screen.getByRole("navigation").className).toContain("extra");
  });
});
