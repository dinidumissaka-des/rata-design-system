import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { Button } from "./button.js";
import { Toast, ToastRegion, useToast } from "./toast.js";
import type { ToastProps } from "./toast.js";
import { installPopoverShim } from "./test-support.js";

/**
 * jsdom implements neither the popover API nor a top layer. See
 * test-support.ts for what the shim does and does not pretend to have.
 */
beforeAll(installPopoverShim);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** A button that raises whatever toast the test hands it. */
function Raise({ toast, label = "Raise" }: { toast: () => ReactElement<ToastProps>; label?: string }) {
  const api = useToast();
  return <Button onClick={() => api.show(toast())}>{label}</Button>;
}

const setup = (toast: () => ReactElement<ToastProps>) =>
  render(
    <ToastRegion>
      <Raise toast={toast} />
    </ToastRegion>
  );

const region = () => screen.getByRole("status", { name: "Notifications" });
const raise = () => fireEvent.click(screen.getByRole("button", { name: "Raise" }));

describe("ToastRegion", () => {
  test("one polite live region, named, in the top layer, present before any toast", () => {
    setup(() => <Toast>Saved</Toast>);
    expect(region().getAttribute("popover")).toBe("manual");
    expect(region().matches(":popover-open")).toBe(true);
    expect(region().getAttribute("aria-live")).toBeNull(); // implicit in role=status
    expect(region().getAttribute("aria-atomic")).toBe("false");
    expect(region().children).toHaveLength(0);
  });

  test("show() lands the toast in the region, and focus does not move", () => {
    setup(() => <Toast>Token path copied</Toast>);
    const button = screen.getByRole("button", { name: "Raise" });
    act(() => button.focus());
    raise();
    expect(region().textContent).toContain("Token path copied");
    expect(document.activeElement).toBe(button);
  });

  test("useToast() outside a region says so", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Raise toast={() => <Toast>x</Toast>} />)).toThrow(/ToastRegion/);
    error.mockRestore();
  });

  test("at most three: the oldest leaves early, and is told so", () => {
    const first = vi.fn();
    let n = 0;
    setup(() => {
      n += 1;
      return <Toast onDismiss={n === 1 ? first : undefined}>{`Toast ${n}`}</Toast>;
    });
    raise();
    raise();
    raise();
    expect(region().querySelectorAll(".rata-toast")).toHaveLength(3);
    raise();
    expect(first).toHaveBeenCalledOnce();
    expect(region().textContent).not.toContain("Toast 1");
    expect(region().querySelectorAll(".rata-toast")).toHaveLength(3);
  });
});

describe("Toast", () => {
  test("leaves after the default duration and reports it", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    setup(() => <Toast onDismiss={onDismiss}>Saved</Toast>);
    raise();
    act(() => vi.advanceTimersByTime(5999));
    expect(region().textContent).toContain("Saved");
    act(() => vi.advanceTimersByTime(1));
    expect(region().textContent).not.toContain("Saved");
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  test("duration={null} stays until dismissed", () => {
    vi.useFakeTimers();
    setup(() => <Toast duration={null}>Kept</Toast>);
    raise();
    act(() => vi.advanceTimersByTime(60_000));
    expect(region().textContent).toContain("Kept");
  });

  test("the timer pauses while hovered, and keeps what was left", () => {
    vi.useFakeTimers();
    setup(() => <Toast duration={1000}>Paused</Toast>);
    raise();
    act(() => vi.advanceTimersByTime(600));
    const toast = region().querySelector(".rata-toast")!;
    fireEvent.pointerEnter(toast);
    act(() => vi.advanceTimersByTime(5000));
    expect(region().textContent).toContain("Paused");
    fireEvent.pointerLeave(toast);
    act(() => vi.advanceTimersByTime(399));
    expect(region().textContent).toContain("Paused");
    act(() => vi.advanceTimersByTime(1));
    expect(region().textContent).not.toContain("Paused");
  });

  test("the timer pauses while focus is inside", () => {
    vi.useFakeTimers();
    setup(() => <Toast duration={1000}>Focused</Toast>);
    raise();
    const dismiss = screen.getByRole("button", { name: "Dismiss" });
    act(() => dismiss.focus());
    act(() => vi.advanceTimersByTime(5000));
    expect(region().textContent).toContain("Focused");
  });

  test("the timer pauses while the tab is hidden", () => {
    vi.useFakeTimers();
    setup(() => <Toast duration={1000}>Away</Toast>);
    raise();
    const state = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => vi.advanceTimersByTime(5000));
    expect(region().textContent).toContain("Away");
    state.mockReturnValue("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(region().textContent).not.toContain("Away");
    state.mockRestore();
  });

  test("every toast has a dismiss button, named by dismissLabel", async () => {
    const onDismiss = vi.fn();
    setup(() => (
      <Toast duration={null} dismissLabel="Schließen" onDismiss={onDismiss}>
        Gespeichert
      </Toast>
    ));
    raise();
    await userEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(region().textContent).not.toContain("Gespeichert");
  });

  test("the action is a real button; using it runs it and the toast leaves", async () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    setup(() => (
      <Toast action={{ label: "Undo", onAction }} onDismiss={onDismiss}>
        Row archived
      </Toast>
    ));
    raise();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  test("a toast leaving with focus inside hands it back where it came from", async () => {
    setup(() => (
      <Toast duration={null} action={{ label: "Undo", onAction: () => {} }}>
        Row archived
      </Toast>
    ));
    const raiser = screen.getByRole("button", { name: "Raise" });
    act(() => raiser.focus());
    raise();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Undo" }));
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(raiser);
  });

  test("variants: neutral is the default and has no icon; success and danger do", () => {
    let variant: ToastProps["variant"];
    setup(() => (
      <Toast variant={variant} duration={null}>
        Message
      </Toast>
    ));
    raise();
    variant = "success";
    raise();
    variant = "danger";
    raise();
    const toasts = [...region().querySelectorAll(".rata-toast")];
    expect(toasts.map((t) => t.className)).toEqual([
      "rata-toast rata-toast--neutral",
      "rata-toast rata-toast--success",
      "rata-toast rata-toast--danger",
    ]);
    expect(toasts[0]!.querySelector(".rata-toast-icon")).toBeNull();
    const icon = toasts[1]!.querySelector(".rata-toast-icon")!;
    expect(icon).not.toBeNull();
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  test("the message is a paragraph, never a heading", () => {
    setup(() => <Toast>Invoice sent</Toast>);
    raise();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("Invoice sent").tagName).toBe("P");
  });
});
