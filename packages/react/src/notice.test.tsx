import { describe, expect, test, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Lock } from "@rata/icons";
import { Notice } from "./notice.js";

afterEach(cleanup);

describe("Notice", () => {
  test("silent by default — no role, because there is no change to announce", () => {
    const { container } = render(<Notice>Read-only while the migration runs.</Notice>);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(container.firstElementChild!.getAttribute("role")).toBeNull();
  });

  test("live maps onto a role, not an aria-live attribute", () => {
    const { unmount } = render(<Notice live="polite">Saved.</Notice>);
    expect(screen.getByRole("status")).toBeTruthy();
    unmount();
    render(<Notice live="assertive" variant="danger">Could not save.</Notice>);
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  test("the severity is never colour-only: each variant carries its own glyph", () => {
    // Four variants, four distinct shapes — the 1.4.1 redundancy.
    const paths = new Set<string>();
    for (const variant of ["info", "success", "warning", "danger"] as const) {
      const { container, unmount } = render(<Notice variant={variant}>Message.</Notice>);
      const svg = container.querySelector(".rata-notice-icon")!;
      paths.add(svg.innerHTML);
      unmount();
    }
    expect(paths.size).toBe(4);
  });

  test("the glyph is hidden, so it cannot disagree with the message", () => {
    const { container } = render(<Notice variant="danger">Could not save.</Notice>);
    const svg = container.querySelector(".rata-notice-icon")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("role")).toBeNull();
    // The text is the whole announcement.
    expect(container.textContent).toBe("Could not save.");
  });

  test("icon overrides the variant's glyph, and false removes it", () => {
    const { container: withOverride } = render(
      <Notice variant="warning" icon={Lock}>You lack permission.</Notice>
    );
    const { container: withDefault } = render(<Notice variant="warning">Expires soon.</Notice>);
    expect(withOverride.querySelector(".rata-notice-icon")!.innerHTML).not.toBe(
      withDefault.querySelector(".rata-notice-icon")!.innerHTML
    );

    const { container: none } = render(<Notice variant="warning" icon={false}>Expires.</Notice>);
    expect(none.querySelector(".rata-notice-icon")).toBeNull();
  });

  test("title is a paragraph, never a heading — a notice cannot know the level", () => {
    render(<Notice title="Could not save" variant="danger">The server refused it.</Notice>);
    expect(screen.queryByRole("heading")).toBeNull();
    const title = screen.getByText("Could not save");
    expect(title.tagName).toBe("P");
  });

  test("no close button until onDismiss is passed", () => {
    render(<Notice>Message.</Notice>);
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("the close button is named, and reports the press without hiding itself", async () => {
    const onDismiss = vi.fn();
    render(<Notice onDismiss={onDismiss}>Message.</Notice>);
    const close = screen.getByRole("button", { name: "Dismiss" });
    await userEvent.click(close);
    expect(onDismiss).toHaveBeenCalledOnce();
    // Visibility belongs to the caller: the notice is still on screen.
    expect(screen.getByText("Message.")).toBeTruthy();
  });

  test("dismissLabel names the control when several notices share a screen", () => {
    render(<Notice onDismiss={() => {}} dismissLabel="Dismiss the payment warning">Pay.</Notice>);
    expect(screen.getByRole("button", { name: "Dismiss the payment warning" })).toBeTruthy();
  });

  test("actions come after the message in DOM order", () => {
    render(
      <Notice variant="danger" actions={<button type="button">Retry</button>}>
        The server refused it.
      </Notice>
    );
    const message = screen.getByText("The server refused it.");
    const retry = screen.getByRole("button", { name: "Retry" });
    // Node.DOCUMENT_POSITION_FOLLOWING — the action is reached after the text
    // that explains it.
    expect(message.compareDocumentPosition(retry) & 4).toBeTruthy();
  });

  test("passes the rest through, so it can be labelled or identified by the caller", () => {
    const { container } = render(<Notice id="mig" data-testid="n">Message.</Notice>);
    const el = container.firstElementChild!;
    expect(el.id).toBe("mig");
    expect(el.getAttribute("data-testid")).toBe("n");
  });
});
