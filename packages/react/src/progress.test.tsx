import { describe, expect, test, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Progress } from "./progress.js";

afterEach(cleanup);

const fill = (bar: HTMLElement) => bar.querySelector<HTMLElement>(".rata-progress-fill")!;

describe("Progress", () => {
  test("is a progressbar named by its visible label", () => {
    render(<Progress label="Uploading assets" value={3} max={7} />);
    const bar = screen.getByRole("progressbar", { name: "Uploading assets" });
    expect(bar.tagName).toBe("DIV");
    const labelId = bar.getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelId)!.textContent).toBe("Uploading assets");
  });

  test("carries its value, range and max", () => {
    render(<Progress label="Import" value={3} max={7} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("3");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("7");
  });

  test("max defaults to 100", () => {
    render(<Progress label="Import" value={40} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(fill(bar).style.inlineSize).toBe("40%");
  });

  test("valueText is shown beside the label and becomes aria-valuetext", () => {
    render(<Progress label="Uploading assets" value={3} max={7} valueText="3 of 7 files" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuetext")).toBe("3 of 7 files");
    expect(bar.querySelector(".rata-progress-value")!.textContent).toBe("3 of 7 files");
  });

  test("without valueText there is no aria-valuetext and no value text", () => {
    render(<Progress label="Import" value={3} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.hasAttribute("aria-valuetext")).toBe(false);
    expect(bar.querySelector(".rata-progress-value")).toBeNull();
  });

  test("value is clamped to the range, so an overshoot never announces past done", () => {
    const { rerender } = render(<Progress label="Import" value={104} />);
    let bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
    expect(fill(bar).style.inlineSize).toBe("100%");

    rerender(<Progress label="Import" value={-5} />);
    bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    expect(fill(bar).style.inlineSize).toBe("0%");
  });

  test("the fill's width is the value as a share of max", () => {
    render(<Progress label="Import" value={1} max={4} />);
    expect(fill(screen.getByRole("progressbar")).style.inlineSize).toBe("25%");
  });

  test("is not a live region", () => {
    render(<Progress label="Import" value={1} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.hasAttribute("aria-live")).toBe(false);
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("className is added for placement, alongside the bar's own class", () => {
    render(<Progress label="Import" value={1} className="upload-bar" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.classList.contains("upload-bar")).toBe(true);
    expect(bar.classList.contains("rata-progress")).toBe(true);
  });
});
