import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Slider } from "./slider.js";

/**
 * Snapping, crossing and the disabled guard are the primitive's and are
 * tested there. Asserted here: native range inputs named the APG way, the
 * drawn thumb taking the state-layer attributes from pointer events on the
 * input, commit from the native change event, and the output.
 */
afterEach(cleanup);

/** What the platform does on release, a key press or an AT adjustment. */
const commitNative = (input: HTMLElement) => input.dispatchEvent(new Event("change", { bubbles: true }));

describe("Slider", () => {
  test("one value is one native range input named by the label", () => {
    render(<Slider label="Volume" defaultValue={40} formatValue={(v) => `${v}%`} />);
    const input = screen.getByRole("slider", { name: "Volume" }) as HTMLInputElement;
    expect(input.type).toBe("range");
    expect(input.value).toBe("40");
    expect(input.getAttribute("aria-valuetext")).toBe("40%");
    expect(screen.queryByRole("group")).toBeNull();
  });

  test("the visible value is an output tied to the input, not a live region", () => {
    const { container } = render(<Slider label="Volume" defaultValue={40} formatValue={(v) => `${v}%`} />);
    const output = container.querySelector("output")!;
    expect(output.textContent).toBe("40%");
    expect(output.getAttribute("aria-live")).toBe("off");
    expect(output.getAttribute("for")).toBe(screen.getByRole("slider").id);
  });

  test("showValue={false} renders no output", () => {
    const { container } = render(<Slider label="Volume" showValue={false} />);
    expect(container.querySelector("output")).toBeNull();
  });

  test("defaults to min", () => {
    render(<Slider label="Volume" min={10} />);
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("10");
  });

  test("a tuple is a group named by the label, with two named thumbs", () => {
    render(
      <Slider
        label="Price"
        defaultValue={[0, 500]}
        max={500}
        step={10}
        thumbLabels={["Minimum price", "Maximum price"]}
        name="price"
      />
    );
    const group = screen.getByRole("group", { name: "Price" });
    const [lo, hi] = screen.getAllByRole("slider") as HTMLInputElement[];
    expect(group.contains(lo!)).toBe(true);
    expect(lo).toBe(screen.getByRole("slider", { name: "Minimum price" }));
    expect(hi).toBe(screen.getByRole("slider", { name: "Maximum price" }));
    expect([lo!.name, hi!.name]).toEqual(["price", "price"]);
  });

  test("moving fires onValueChange; the native change event commits once", () => {
    const onValueChange = vi.fn();
    const onValueCommit = vi.fn();
    render(<Slider label="Volume" onValueChange={onValueChange} onValueCommit={onValueCommit} />);
    const input = screen.getByRole("slider");
    fireEvent.input(input, { target: { value: "30" } });
    fireEvent.input(input, { target: { value: "35" } });
    expect(onValueChange.mock.calls.map((c) => c[0])).toEqual([30, 35]);
    expect(onValueCommit).not.toHaveBeenCalled();
    commitNative(input);
    expect(onValueCommit).toHaveBeenCalledTimes(1);
    expect(onValueCommit).toHaveBeenCalledWith(35);
  });

  test("two thumbs cannot cross", () => {
    const onValueChange = vi.fn();
    render(
      <Slider
        label="Price"
        defaultValue={[20, 60]}
        thumbLabels={["Minimum price", "Maximum price"]}
        onValueChange={onValueChange}
      />
    );
    fireEvent.input(screen.getByRole("slider", { name: "Minimum price" }), { target: { value: "90" } });
    expect(onValueChange).toHaveBeenLastCalledWith([60, 60]);
  });

  test("hover and press on the input are drawn on the thumb through the state layer", () => {
    const { container } = render(<Slider label="Volume" />);
    const input = screen.getByRole("slider");
    const thumb = container.querySelector(".rata-slider-thumb")!;
    expect(thumb.classList.contains("rata-state-layer")).toBe(true);
    expect(thumb.hasAttribute("data-hovered")).toBe(false);
    fireEvent.pointerEnter(input);
    expect(thumb.hasAttribute("data-hovered")).toBe(true);
    fireEvent.pointerDown(input);
    expect(thumb.hasAttribute("data-pressed")).toBe(true);
    fireEvent.pointerUp(input);
    fireEvent.pointerLeave(input);
    expect(thumb.hasAttribute("data-pressed")).toBe(false);
    expect(thumb.hasAttribute("data-hovered")).toBe(false);
  });

  test("PageUp moves ten steps", () => {
    const onValueCommit = vi.fn();
    render(<Slider label="Volume" defaultValue={10} step={2} onValueCommit={onValueCommit} />);
    fireEvent.keyDown(screen.getByRole("slider"), { key: "PageUp" });
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("30");
    expect(onValueCommit).toHaveBeenCalledWith(30);
  });

  test("disabled stays focusable, refuses change and reverts, and still submits", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <Slider label="Volume" defaultValue={40} disabled name="volume" onValueChange={onValueChange} />
    );
    const input = screen.getByRole("slider") as HTMLInputElement;
    expect(input.getAttribute("aria-disabled")).toBe("true");
    expect(input.disabled).toBe(false);
    input.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.input(input, { target: { value: "90" } });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.value).toBe("40");
    expect(input.name).toBe("volume");
    fireEvent.pointerEnter(input);
    expect(container.querySelector(".rata-slider-thumb")!.hasAttribute("data-hovered")).toBe(false);
  });

  test("composes Field: description joins the chain", () => {
    render(<Slider label="Quality" description="Applies to new uploads only." />);
    const ids = screen.getByRole("slider").getAttribute("aria-describedby")!.split(" ");
    expect(document.getElementById(ids[0]!)?.textContent).toBe("Applies to new uploads only.");
  });
});
