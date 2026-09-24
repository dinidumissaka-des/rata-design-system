import { describe, expect, test, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Disclosure } from "./disclosure.js";

/**
 * Nothing here asserts a computed style — jsdom applies no stylesheet, so an
 * assertion about the chevron's rotation would pass whatever the CSS said,
 * including nothing. What is asserted is the part the contract promises and a
 * caller can observe: which elements exist, what they announce, and where
 * focus lands.
 */
afterEach(cleanup);

const Fixture = (props: Record<string, unknown> = {}) => (
  <Disclosure title="Advanced options" {...props}>
    <a href="/retries">Retry policy</a>
  </Disclosure>
);

describe("Disclosure", () => {
  test("a button that says whether it is expanded and what it controls", () => {
    render(<Fixture />);
    const trigger = screen.getByRole("button", { name: "Advanced options" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // Pointed at always rather than only while open: the relationship is a
    // fact about the markup, not about the state.
    expect(trigger.getAttribute("aria-controls")).toBeTruthy();
  });

  test("aria-controls resolves whether open or shut", async () => {
    const user = userEvent.setup();
    const { container } = render(<Fixture />);
    const trigger = screen.getByRole("button", { name: "Advanced options" });
    const target = () =>
      container.querySelector(`#${CSS.escape(trigger.getAttribute("aria-controls")!)}`);

    // A dangling IDREF is ignored, so a reference that only resolves while
    // open is inert exactly half the time — the opposite of the primitive's
    // reason for pointing at the panel always.
    expect(target()).toBeTruthy();
    await user.click(trigger);
    expect(target()).toBeTruthy();
  });

  test("closed means unmounted, not hidden", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    // Hidden content is still reachable by find-in-page, so a panel claiming
    // to be collapsed could be scrolled to and read. The shell that holds the
    // id stays; everything inside it goes.
    expect(screen.queryByRole("link", { name: "Retry policy" })).toBeNull();
    expect(screen.getByRole("button", { name: "Advanced options" })
      .getAttribute("aria-expanded")).toBe("false");

    await user.click(screen.getByRole("button", { name: "Advanced options" }));
    expect(screen.getByRole("link", { name: "Retry policy" })).toBeTruthy();
  });

  test("the panel is named by the trigger, so the revealed region is not anonymous", async () => {
    const user = userEvent.setup();
    const { container } = render(<Fixture />);
    const trigger = screen.getByRole("button", { name: "Advanced options" });
    await user.click(trigger);

    const panel = container.querySelector(`#${CSS.escape(trigger.getAttribute("aria-controls")!)}`);
    expect(panel).toBeTruthy();
    expect(panel?.getAttribute("aria-labelledby")).toBe(trigger.id);
  });

  test("what is inside stays in the tab order — it is not a menu", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    const trigger = screen.getByRole("button", { name: "Advanced options" });
    await user.click(trigger);

    // A menu would promise one tab stop and arrow-key navigation. This
    // promises nothing beyond "the button reveals that", so Tab reaches the
    // link exactly as it would anywhere else.
    expect(screen.queryByRole("menu")).toBeNull();
    trigger.focus();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Retry policy" }));
  });

  test("Escape closes it from the trigger, where focus actually is", async () => {
    const user = userEvent.setup();
    render(<Fixture defaultOpen />);
    const trigger = screen.getByRole("button", { name: "Advanced options" });
    trigger.focus();

    // A disclosure does not move focus when it opens, so an Escape handler
    // only on the panel would never fire in the commonest case.
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("link", { name: "Retry policy" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  test("Escape closes it from inside the panel, and hands focus back", async () => {
    const user = userEvent.setup();
    render(<Fixture defaultOpen />);
    const link = screen.getByRole("link", { name: "Retry policy" });
    link.focus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("link", { name: "Retry policy" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Advanced options" }));
  });

  test("Escape while closed is left for whatever surrounds it", () => {
    const onOpenChange = vi.fn();
    render(<Fixture onOpenChange={onOpenChange} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Advanced options" }), { key: "Escape" });
    // A collapsed disclosure that swallowed Escape would stop a Dialog around
    // it from closing.
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  test("disabled is aria-disabled: still focusable, still announced, does not open", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Fixture disabled onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole("button", { name: "Advanced options" });

    expect(trigger.getAttribute("aria-disabled")).toBe("true");
    expect(trigger.hasAttribute("disabled")).toBe(false);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    await user.click(trigger);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Retry policy" })).toBeNull();
  });

  test("a disabled one that is open cannot be closed by Escape either", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Fixture open disabled onOpenChange={onOpenChange} />);
    screen.getByRole("button", { name: "Advanced options" }).focus();

    await user.keyboard("{Escape}");
    // Guarding only the click made `disabled` mean two things at once: this
    // would close, and then the trigger would refuse to reopen it.
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Retry policy" })).toBeTruthy();
  });

  test("controlled: the prop decides, and the press only reports", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Fixture open={false} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Advanced options" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    // It did not open itself: something outside owns the state now.
    expect(screen.queryByRole("link", { name: "Retry policy" })).toBeNull();
  });

  test("uncontrolled: defaultOpen starts it open and the trigger closes it", async () => {
    const user = userEvent.setup();
    render(<Fixture defaultOpen />);
    expect(screen.getByRole("link", { name: "Retry policy" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Advanced options" }));
    expect(screen.queryByRole("link", { name: "Retry policy" })).toBeNull();
  });

  test("headingLevel puts the trigger in a heading, so a set is navigable by heading", () => {
    render(<Fixture headingLevel={3} />);
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading.querySelector("button")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Advanced options" })).toBeTruthy();
  });

  test("no headingLevel means no heading — a lone disclosure heads nothing", () => {
    render(<Fixture />);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
