import { describe, expect, test, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Skeleton } from "./skeleton.js";

/**
 * jsdom applies no stylesheet, so the pulse, the reduced-motion stop and the
 * line-box sizing cannot be observed here. What can be is the structure those
 * rules depend on: the element, the shape class, the line count, and that
 * every skeleton is hidden from assistive technology.
 */
afterEach(cleanup);

const root = (container: HTMLElement) => container.firstElementChild as HTMLElement;

describe("Skeleton", () => {
  test("a text skeleton of one line by default, in a span", () => {
    const { container } = render(<Skeleton />);
    const el = root(container);
    expect(el.tagName).toBe("SPAN");
    expect(el.classList.contains("rata-skeleton--text")).toBe(true);
    expect(el.querySelectorAll(".rata-skeleton-line")).toHaveLength(1);
  });

  test("every shape is aria-hidden, and a caller cannot turn that off", () => {
    for (const shape of ["text", "block", "circle"] as const) {
      const { container } = render(<Skeleton shape={shape} />);
      expect(root(container).getAttribute("aria-hidden")).toBe("true");
      cleanup();
    }
    const unhidden = { "aria-hidden": false } as Record<string, unknown>;
    const { container } = render(<Skeleton {...unhidden} />);
    expect(root(container).getAttribute("aria-hidden")).toBe("true");
  });

  test("lines renders one bar per line of text", () => {
    const { container } = render(<Skeleton lines={3} />);
    expect(container.querySelectorAll(".rata-skeleton-line")).toHaveLength(3);
  });

  test("lines below one still renders one line", () => {
    const { container } = render(<Skeleton lines={0} />);
    expect(container.querySelectorAll(".rata-skeleton-line")).toHaveLength(1);
  });

  test("block and circle have no lines, whatever `lines` says", () => {
    const { container, rerender } = render(<Skeleton shape="block" lines={3} />);
    expect(root(container).classList.contains("rata-skeleton--block")).toBe(true);
    expect(container.querySelector(".rata-skeleton-line")).toBeNull();

    rerender(<Skeleton shape="circle" />);
    expect(root(container).classList.contains("rata-skeleton--circle")).toBe(true);
    expect(container.querySelector(".rata-skeleton-line")).toBeNull();
  });

  test("className carries the caller's size, alongside the skeleton's own classes", () => {
    const { container } = render(<Skeleton shape="circle" className="avatar-sized" />);
    const el = root(container);
    expect(el.classList.contains("avatar-sized")).toBe(true);
    expect(el.classList.contains("rata-skeleton")).toBe(true);
  });
});
