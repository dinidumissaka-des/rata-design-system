import { describe, expect, test, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Field } from "./field.js";

/**
 * Field renders no control of its own, so every test here stages one and
 * spreads the argument onto it — which is also the only supported way to use
 * the component, and the reason `children` is a function.
 */
afterEach(cleanup);

const Fixture = (props: Record<string, unknown> = {}) => (
  <Field label="Billing email" {...props}>
    {(control) => <input {...control} />}
  </Field>
);

describe("Field", () => {
  test("the label names the control, and clicking it focuses the control", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    const control = screen.getByLabelText("Billing email");
    expect(control).toBeTruthy();

    await user.click(screen.getByText("Billing email"));
    expect(document.activeElement).toBe(control);
  });

  test("description and message both describe the control, hint first", () => {
    render(<Fixture description="Where receipts go." status="invalid" message="Check this." />);
    const control = screen.getByLabelText("Billing email");
    const ids = control.getAttribute("aria-describedby")!.split(" ");

    // A constraint should be heard before a failure.
    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[0]!)?.textContent).toBe("Where receipts go.");
    expect(document.getElementById(ids[1]!)?.textContent).toBe("Check this.");
  });

  test("an idle message stays on the page but leaves the description chain", () => {
    render(<Fixture message="Check this." />);
    const control = screen.getByLabelText("Billing email");
    // So a stale message from a previous attempt is not announced again.
    expect(screen.getByText("Check this.")).toBeTruthy();
    expect(control.getAttribute("aria-describedby")).toBeNull();
  });

  test("status drives what is announced, not just what is painted", () => {
    const { rerender } = render(<Fixture status="invalid" message="Check this." />);
    expect(screen.getByLabelText("Billing email").getAttribute("aria-invalid")).toBe("true");

    rerender(<Fixture status="validating" message="Checking…" />);
    expect(screen.getByLabelText("Billing email").getAttribute("aria-busy")).toBe("true");
  });

  test("required is announced once, and the marker is not the second time", () => {
    const { container } = render(<Fixture required />);
    expect(screen.getByLabelText(/Billing email/).getAttribute("aria-required")).toBe("true");
    const marker = container.querySelector(".rata-field-required")!;
    expect(marker.getAttribute("aria-hidden")).toBe("true");
  });

  test("disabled keeps the control reachable and readable", async () => {
    const user = userEvent.setup();
    render(<Fixture disabled />);
    const control = screen.getByLabelText("Billing email") as HTMLInputElement;

    // aria-disabled + readOnly, never the native attribute: the field stays in
    // the tab order and the accessibility tree.
    expect(control.getAttribute("aria-disabled")).toBe("true");
    expect(control.hasAttribute("disabled")).toBe(false);
    expect(control.readOnly).toBe(true);

    await user.click(control);
    expect(document.activeElement).toBe(control);
  });

  test("labelHidden concedes the pixels, never the name", () => {
    const { container } = render(<Fixture labelHidden />);
    // The label element is still rendered and still bound by `for`.
    expect(screen.getByLabelText("Billing email")).toBeTruthy();
    expect(container.querySelector("label")?.className).toContain("rata-visually-hidden");
  });

  test("a caller's own aria-describedby is kept, and comes last", () => {
    render(
      <>
        <span id="external">Also see the policy.</span>
        <Fixture description="Where receipts go." aria-describedby="external" />
      </>
    );
    const ids = screen.getByLabelText("Billing email").getAttribute("aria-describedby")!.split(" ");
    expect(ids[ids.length - 1]).toBe("external");
  });

  test("every id under the field derives from one, so nothing can be hand-wired wrong", () => {
    render(<Fixture id="billing" description="Where receipts go." status="invalid" message="Check this." />);
    const control = screen.getByLabelText("Billing email");
    expect(control.id).toBe("billing");
    expect(control.getAttribute("aria-describedby")).toBe("billing-description billing-message");
  });
});
