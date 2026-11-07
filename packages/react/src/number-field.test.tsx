import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumberField } from "./number-field.js";

/**
 * The number rules are the primitive's and are tested there. Asserted here:
 * that Field's wiring arrives, that the draft/commit split survives a real
 * DOM, that the buttons step without taking focus, and that the hidden input
 * carries the plain number.
 */
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const spin = () => screen.getByRole("spinbutton") as HTMLInputElement;

describe("NumberField", () => {
  test("is a text spinbutton named by its label, never type=number", () => {
    render(<NumberField label="Seats" defaultValue={2} min={1} max={9} />);
    const input = screen.getByRole("spinbutton", { name: "Seats" }) as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.getAttribute("inputmode")).toBe("decimal");
    expect(input.getAttribute("aria-valuenow")).toBe("2");
    expect(input.getAttribute("aria-valuemin")).toBe("1");
    expect(input.getAttribute("aria-valuemax")).toBe("9");
  });

  test("typing does not commit until blur, which clamps", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<NumberField label="Seats" defaultValue={1} max={10} onValueChange={onValueChange} />);
    await user.click(spin());
    await user.clear(spin());
    await user.type(spin(), "12");
    expect(onValueChange).not.toHaveBeenCalled();
    await user.tab();
    expect(onValueChange).toHaveBeenLastCalledWith(10);
    expect(spin().value).toBe("10");
  });

  test("Enter commits", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<NumberField label="Seats" onValueChange={onValueChange} />);
    await user.click(spin());
    await user.type(spin(), "4{Enter}");
    expect(onValueChange).toHaveBeenCalledWith(4);
  });

  test("arrow keys step", async () => {
    const user = userEvent.setup();
    render(<NumberField label="Seats" defaultValue={3} />);
    await user.click(spin());
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowDown}");
    expect(spin().getAttribute("aria-valuenow")).toBe("4");
  });

  test("formats at rest and edits a plain number", async () => {
    const user = userEvent.setup();
    render(
      <div lang="en-US">
        <NumberField label="Budget" defaultValue={1250} formatOptions={{ style: "currency", currency: "EUR" }} />
      </div>
    );
    expect(spin().value).toBe("€1,250.00");
    expect(spin().getAttribute("aria-valuetext")).toBe("€1,250.00");
    await user.click(spin());
    expect(spin().value).toBe("1250.00");
  });

  test("reads the locale from the nearest lang attribute", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <div lang="de-DE">
        <NumberField label="Gewicht" onValueChange={onValueChange} />
      </div>
    );
    await user.click(spin());
    await user.type(spin(), "1.234,5");
    await user.tab();
    expect(onValueChange).toHaveBeenCalledWith(1234.5);
  });

  test("the buttons are named, not tab stops, and step without taking focus", async () => {
    const user = userEvent.setup();
    render(<NumberField label="Seats" defaultValue={1} min={1} />);
    const inc = screen.getByRole("button", { name: "Increase" });
    const dec = screen.getByRole("button", { name: "Decrease" });
    expect(inc.getAttribute("tabindex")).toBe("-1");
    expect(dec.getAttribute("aria-disabled")).toBe("true");

    await user.click(spin());
    await user.click(inc);
    expect(spin().getAttribute("aria-valuenow")).toBe("2");
    expect(document.activeElement).toBe(spin());
    expect(dec.getAttribute("aria-disabled")).toBeNull();
  });

  test("press and hold repeats on the primitive's schedule", () => {
    vi.useFakeTimers();
    render(<NumberField label="Seats" defaultValue={0} />);
    const inc = screen.getByRole("button", { name: "Increase" });
    fireEvent.pointerDown(inc, { button: 0 });
    expect(spin().getAttribute("aria-valuenow")).toBe("1");
    act(() => {
      vi.advanceTimersByTime(400 + 60 * 2);
    });
    expect(spin().getAttribute("aria-valuenow")).toBe("4");
    fireEvent.pointerUp(inc);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(spin().getAttribute("aria-valuenow")).toBe("4");
  });

  test("a click with no press before it — assistive technology — steps once", () => {
    render(<NumberField label="Seats" defaultValue={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Increase" }));
    expect(spin().getAttribute("aria-valuenow")).toBe("1");
  });

  test("stepButtons={false} renders no buttons", () => {
    render(<NumberField label="Budget" stepButtons={false} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("disabled stays focusable, refuses keys and buttons, and still submits", async () => {
    const user = userEvent.setup();
    const { container } = render(<NumberField label="Seats" defaultValue={2} disabled name="seats" />);
    expect(spin().getAttribute("aria-disabled")).toBe("true");
    expect(spin().readOnly).toBe(true);
    expect(spin().disabled).toBe(false);
    await user.click(spin());
    await user.keyboard("{ArrowUp}");
    await user.click(screen.getByRole("button", { name: "Increase" }));
    expect(spin().getAttribute("aria-valuenow")).toBe("2");
    expect(screen.getByRole("button", { name: "Increase" }).getAttribute("aria-disabled")).toBe("true");
    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.name).toBe("seats");
    expect(hidden.value).toBe("2");
  });

  test("the hidden input carries the unformatted number", () => {
    const { container } = render(
      <NumberField
        label="Budget"
        name="budget"
        defaultValue={1250}
        formatOptions={{ style: "currency", currency: "EUR" }}
      />
    );
    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.value).toBe("1250");
    // The visible box has no name, so the form posts the number only once.
    expect(spin().getAttribute("name")).toBeNull();
  });

  test("composes Field: description, invalid status and message", () => {
    render(
      <NumberField
        label="Team size"
        description="Whole people."
        status="invalid"
        message="Teams on this plan have at most 10 people."
      />
    );
    const ids = spin().getAttribute("aria-describedby")!.split(" ");
    expect(document.getElementById(ids[0]!)?.textContent).toBe("Whole people.");
    expect(document.getElementById(ids[1]!)?.textContent).toContain("at most 10");
    expect(spin().getAttribute("aria-invalid")).toBe("true");
  });

  test("controlled: follows value, and empty is null", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(<NumberField label="Seats" value={5} onValueChange={onValueChange} />);
    expect(spin().value).toBe("5");
    rerender(<NumberField label="Seats" value={null} onValueChange={onValueChange} />);
    expect(spin().value).toBe("");
    rerender(<NumberField label="Seats" value={5} onValueChange={onValueChange} />);
    await user.click(spin());
    await user.clear(spin());
    await user.tab();
    expect(onValueChange).toHaveBeenCalledWith(null);
  });
});
