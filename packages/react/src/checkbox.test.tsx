import { describe, expect, test, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Checkbox } from "./checkbox.js";

afterEach(cleanup);

describe("Checkbox", () => {
  test("clicking the label toggles the box — the binding is the hit target", async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Agree" onCheckedChange={onCheckedChange} />);
    await userEvent.click(screen.getByText("Agree"));
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
  });

  test("uncontrolled, it holds its own state", async () => {
    render(<Checkbox label="Agree" defaultChecked />);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(box.checked).toBe(true);
    await userEvent.click(box);
    expect(box.checked).toBe(false);
  });

  test("controlled, it renders the value it is given and nothing else", async () => {
    render(<Checkbox label="Agree" checked={false} onCheckedChange={() => {}} />);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    await userEvent.click(box);
    // Still false: the caller owns it and did not change it. A component that
    // drifted here would look like it worked and then disagree with the page.
    expect(box.checked).toBe(false);
  });

  test("`indeterminate` reaches the DOM as a property", () => {
    // The reason this component exists rather than a styled input: HTML has no
    // `indeterminate` attribute, so this cannot be asserted on markup at all.
    render(<Checkbox label="Select all" indeterminate />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).indeterminate).toBe(true);
  });

  test("clearing `indeterminate` clears the property too, not only on mount", () => {
    function Host() {
      const [mixed, setMixed] = useState(true);
      return (
        <>
          <Checkbox label="Select all" indeterminate={mixed} />
          <button type="button" onClick={() => setMixed(false)}>
            settle
          </button>
        </>
      );
    }
    const { rerender } = render(<Host />);
    const box = () => screen.getByRole("checkbox") as HTMLInputElement;
    expect(box().indeterminate).toBe(true);
    screen.getByRole("button", { name: "settle" }).click();
    rerender(<Host />);
    // The effect re-runs on the value, so this is not a mount-only assignment.
    expect(box().indeterminate).toBe(false);
  });

  test("activating an indeterminate box resolves to checked", async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Select all" indeterminate checked={false} onCheckedChange={onCheckedChange} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
  });

  test("disabled refuses activation but stays focusable and announced", async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Agree" disabled onCheckedChange={onCheckedChange} />);
    const box = screen.getByRole("checkbox");
    await userEvent.click(box);
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(box).toHaveProperty("disabled", false);
    expect(box.getAttribute("aria-disabled")).toBe("true");
    // The whole point of aria-disabled over the native attribute.
    box.focus();
    expect(document.activeElement).toBe(box);
  });

  test("the description joins the accessible description", () => {
    render(<Checkbox label="Agree" description="Roughly monthly." />);
    const box = screen.getByRole("checkbox");
    const id = box.getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)?.textContent).toBe("Roughly monthly.");
  });

  test("labelHidden keeps the accessible name", () => {
    render(<Checkbox label="Notify me" labelHidden />);
    // Found by its name, which is the only thing that matters: hidden, not gone.
    expect(screen.getByRole("checkbox", { name: /Notify me/ })).toBeTruthy();
  });

  test("a blocked activation leaves the native checkedness intact", async () => {
    // Same repair as Switch: a canceled checkbox activation toggles rather
    // than restores, and React writes the controlled value back mid-dispatch,
    // so the toggle lands on the corrected value. Invisible on screen — the
    // box paints from data-state — but wrong in the submitted value and wrong
    // to a screen reader. See keep-checkedness.ts.
    render(<Checkbox label="Ship it" checked disabled />);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    await userEvent.click(box);
    await Promise.resolve();
    expect(box.checked).toBe(true);
  });
});
