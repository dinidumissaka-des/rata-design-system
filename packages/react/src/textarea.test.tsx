import { describe, expect, test, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Textarea } from "./textarea.js";

/**
 * Most of what a Textarea promises is Field's and is tested there. What is
 * asserted here is the part that is this component's: that it is a textarea
 * rather than an input, that `rows` is the height, and that composing Field
 * actually delivers the wiring rather than merely claiming to.
 */
afterEach(cleanup);

const Fixture = (props: Record<string, unknown> = {}) => (
  <Textarea label="Release notes" {...props} />
);

describe("Textarea", () => {
  test("is a textarea, which is the whole reason it is not a TextField prop", () => {
    render(<Fixture />);
    const control = screen.getByLabelText("Release notes");
    // Enter inserts a newline here where it submits on an input, which is the
    // difference a `multiline` boolean would have hidden.
    expect(control.tagName).toBe("TEXTAREA");
  });

  test("rows is the height, and defaults to three", () => {
    const { rerender } = render(<Fixture />);
    expect(screen.getByLabelText("Release notes").getAttribute("rows")).toBe("3");

    rerender(<Fixture rows={8} />);
    expect(screen.getByLabelText("Release notes").getAttribute("rows")).toBe("8");
  });

  test("resize is vertical unless the layout cannot take it", () => {
    const { rerender } = render(<Fixture />);
    expect(screen.getByLabelText("Release notes").className).toContain("resize-vertical");

    rerender(<Fixture resize="none" />);
    expect(screen.getByLabelText("Release notes").className).toContain("resize-none");
  });

  test("composing Field delivers the description chain, hint before failure", () => {
    render(
      <Fixture description="Around 500 characters." status="invalid" message="Too long." />
    );
    const control = screen.getByLabelText("Release notes");
    const ids = control.getAttribute("aria-describedby")!.split(" ");

    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[0]!)?.textContent).toBe("Around 500 characters.");
    expect(document.getElementById(ids[1]!)?.textContent).toBe("Too long.");
    expect(control.getAttribute("aria-invalid")).toBe("true");
  });

  test("disabled keeps it reachable and readable, via aria-disabled and readOnly", async () => {
    const user = userEvent.setup();
    render(<Fixture disabled defaultValue="Shipped on Tuesday." />);
    const control = screen.getByLabelText("Release notes") as HTMLTextAreaElement;

    expect(control.getAttribute("aria-disabled")).toBe("true");
    expect(control.hasAttribute("disabled")).toBe(false);
    expect(control.readOnly).toBe(true);
    expect(control.value).toBe("Shipped on Tuesday.");

    await user.click(control);
    expect(document.activeElement).toBe(control);
  });

  test("typing reaches it, and the label keeps naming it", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    const control = screen.getByLabelText("Release notes") as HTMLTextAreaElement;

    await user.type(control, "One line{enter}Another");
    // Enter inserted a newline rather than submitting anything.
    expect(control.value).toBe("One line\nAnother");
  });

  test("labelHidden concedes the pixels, never the name", () => {
    const { container } = render(<Fixture labelHidden />);
    expect(screen.getByLabelText("Release notes")).toBeTruthy();
    expect(container.querySelector("label")?.className).toContain("rata-visually-hidden");
  });
});
