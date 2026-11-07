import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PinInput } from "./pin-input.js";

/**
 * Filtering, completion and box states are the primitive's and are tested
 * there. Asserted here: one labelled input and nothing else announced, the
 * length at the head of the description chain, and the boxes following a
 * real DOM's typing and paste.
 */
afterEach(cleanup);

const input = () => screen.getByLabelText("Verification code") as HTMLInputElement;

describe("PinInput", () => {
  test("is one labelled text input; the boxes are hidden from assistive technology", () => {
    const { container } = render(<PinInput label="Verification code" length={6} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(input().maxLength).toBe(6);
    expect(input().getAttribute("autocomplete")).toBe("one-time-code");
    expect(input().getAttribute("inputmode")).toBe("numeric");
    const boxes = container.querySelector(".rata-pin-input-boxes")!;
    expect(boxes.getAttribute("aria-hidden")).toBe("true");
    expect(boxes.children).toHaveLength(6);
  });

  test("states the length ahead of the helper text", () => {
    render(
      <PinInput
        label="Verification code"
        length={6}
        description="We sent it to the number ending 0142."
        status="invalid"
        message="That code did not match."
      />
    );
    const ids = input().getAttribute("aria-describedby")!.split(" ");
    expect(ids.map((id) => document.getElementById(id)?.textContent)).toEqual([
      "6 characters",
      "We sent it to the number ending 0142.",
      "That code did not match.",
    ]);
    expect(input().getAttribute("aria-invalid")).toBe("true");
  });

  test("typing fills the boxes and completion fires once", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const { container } = render(
      <PinInput label="Verification code" length={4} onComplete={onComplete} />
    );
    await user.click(input());
    await user.keyboard("1a23");
    expect(input().value).toBe("123");
    const states = () =>
      [...container.querySelectorAll(".rata-pin-input-box")].map((b) => b.getAttribute("data-state"));
    expect(states()).toEqual(["filled", "filled", "filled", "active"]);
    await user.keyboard("4");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("1234");
  });

  test("a paste is filtered whole", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<PinInput label="Verification code" length={6} onValueChange={onValueChange} />);
    await user.click(input());
    await user.paste("123-456");
    expect(onValueChange).toHaveBeenLastCalledWith("123456");
    expect(input().value).toBe("123456");
  });

  test("alphanumeric is uppercased as typed", async () => {
    const user = userEvent.setup();
    render(<PinInput label="Verification code" length={4} characters="alphanumeric" />);
    await user.click(input());
    await user.keyboard("ab1-");
    expect(input().value).toBe("AB1");
  });

  test("a pin is a password with autofill off, and draws dots", async () => {
    const user = userEvent.setup();
    const { container } = render(<PinInput label="PIN" length={4} purpose="pin" />);
    const pin = screen.getByLabelText("PIN") as HTMLInputElement;
    expect(pin.type).toBe("password");
    expect(pin.getAttribute("autocomplete")).toBe("off");
    await user.click(pin);
    await user.keyboard("12");
    expect(container.querySelectorAll(".rata-pin-input-dot")).toHaveLength(2);
    expect(container.querySelector(".rata-pin-input-boxes")!.textContent).toBe("");
  });

  test("submits the code as one string under name", () => {
    render(<PinInput label="Verification code" length={6} name="otp" defaultValue="12" />);
    expect(input().name).toBe("otp");
    expect(input().value).toBe("12");
  });

  test("controlled: clearing after a failure empties the boxes", () => {
    const { rerender, container } = render(
      <PinInput label="Verification code" length={4} value="1234" />
    );
    rerender(<PinInput label="Verification code" length={4} value="" status="invalid" />);
    expect(input().value).toBe("");
    expect(container.querySelector(".rata-pin-input-boxes")!.textContent).toBe("");
  });

  test("disabled stays focusable and readOnly, and still submits", async () => {
    const user = userEvent.setup();
    render(<PinInput label="Verification code" length={4} disabled defaultValue="12" name="otp" />);
    expect(input().getAttribute("aria-disabled")).toBe("true");
    expect(input().readOnly).toBe(true);
    expect(input().disabled).toBe(false);
    await user.click(input());
    expect(document.activeElement).toBe(input());
    await user.keyboard("3");
    expect(input().value).toBe("12");
  });
});
