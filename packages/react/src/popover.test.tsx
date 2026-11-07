import { describe, expect, test, vi, afterEach, beforeAll } from "vitest";
import { useRef, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button.js";
import { Popover } from "./popover.js";
import { installPopoverShim } from "./test-support.js";

/**
 * jsdom implements neither the popover API nor a top layer, and its UA sheet
 * hides `[popover]` unconditionally. See test-support.ts for what the shim
 * does and, more importantly, what it deliberately does not pretend to have.
 */
beforeAll(installPopoverShim);

afterEach(cleanup);

const Fixture = (props: Partial<Parameters<typeof Popover>[0]> = {}) => (
  <>
    <Popover title="Share link" trigger={<Button>Share</Button>} {...props}>
      <a href="/help">How sharing works</a>
      <button type="button">Copy link</button>
    </Popover>
    <button type="button">After</button>
  </>
);

const trigger = () => screen.getByRole("button", { name: "Share" });

describe("Popover", () => {
  test("the trigger declares what it controls and whether it is showing", async () => {
    render(<Fixture />);
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    // Deliberately not aria-haspopup="dialog" — announced inconsistently.
    expect(trigger().getAttribute("aria-haspopup")).toBeNull();
    await userEvent.click(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(trigger().getAttribute("aria-controls")).toBe(screen.getByRole("dialog").id);
  });

  test("it is a non-modal dialog named by its title", async () => {
    render(<Fixture />);
    await userEvent.click(trigger());
    const dialog = screen.getByRole("dialog", { name: "Share link" });
    expect(dialog.getAttribute("aria-modal")).toBeNull();
    expect(dialog.getAttribute("popover")).toBe("auto");
  });

  test("the title is a styled paragraph, never a heading", async () => {
    render(<Fixture />);
    await userEvent.click(trigger());
    expect(screen.queryByRole("heading")).toBeNull();
    const title = screen.getByText("Share link");
    expect(title.tagName).toBe("P");
    expect(title.className).toBe("rata-popover-title");
  });

  test("opening moves focus to the first focusable control", async () => {
    render(<Fixture />);
    await userEvent.click(trigger());
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "How sharing works" }));
  });

  test("initialFocus overrides where focus lands", async () => {
    function WithInitialFocus() {
      const copy = useRef<HTMLButtonElement | null>(null);
      return (
        <Popover title="Share link" trigger={<Button>Share</Button>} initialFocus={copy}>
          <a href="/help">How sharing works</a>
          <button type="button" ref={copy}>
            Copy link
          </button>
        </Popover>
      );
    }
    render(<WithInitialFocus />);
    await userEvent.click(trigger());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Copy link" }));
  });

  test("Escape closes and hands focus back to the trigger", async () => {
    render(<Fixture />);
    await userEvent.click(trigger());
    await userEvent.keyboard("{Escape}");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger());
  });

  test("focus is not trapped: Tab past the last control leaves and closes", async () => {
    render(<Fixture />);
    await userEvent.click(trigger());
    await userEvent.tab(); // Copy link
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    await userEvent.tab(); // After
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  test("Shift+Tab back to the trigger leaves it open, and Escape there closes it", async () => {
    render(<Fixture />);
    await userEvent.click(trigger());
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    await userEvent.keyboard("{Escape}");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  test("the trigger toggles it shut", async () => {
    render(<Fixture />);
    await userEvent.click(trigger());
    await userEvent.click(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  test("light-dismiss updates aria-expanded and does not take focus back", async () => {
    render(<Fixture />);
    await userEvent.click(trigger());
    // The platform's light-dismiss, as the shim reports it.
    act(() => screen.getByRole("dialog").hidePopover());
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).not.toBe(trigger());
  });

  test("focus moving to a control outside closes it, and stays there", async () => {
    render(<Fixture />);
    await userEvent.click(trigger());
    const after = screen.getByRole("button", { name: "After" });
    act(() => after.focus());
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(after);
  });

  test("a press that light-dismissed it does not reopen it on click", async () => {
    render(<Fixture />);
    await userEvent.click(trigger());
    const surface = screen.getByRole("dialog");
    // pointerdown on the trigger, then the platform dismisses, then click.
    fireEvent.pointerDown(trigger());
    act(() => surface.hidePopover());
    fireEvent.click(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  test("controlled: the caller owns open, and is told when it should change", async () => {
    const onOpenChange = vi.fn();
    render(<Fixture open={false} onOpenChange={onOpenChange} />);
    await userEvent.click(trigger());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  test("closing from inside via the controlled prop returns focus to the trigger", async () => {
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <Popover title="Status" trigger={<Button>Share</Button>} open={open} onOpenChange={setOpen}>
          <button type="button" onClick={() => setOpen(false)}>
            Done
          </button>
        </Popover>
      );
    }
    render(<Controlled />);
    await userEvent.click(trigger());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Done" }));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    // Not dropped on the body when the surface holding it hides.
    expect(document.activeElement).toBe(trigger());
  });

  test("defaultOpen starts it open", () => {
    render(<Fixture defaultOpen />);
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("dialog", { name: "Share link" })).toBeTruthy();
  });

  test("placement is a modifier class; block-end is the default and has none", () => {
    const { rerender } = render(<Fixture />);
    const surface = () => screen.getByRole("dialog", { hidden: true });
    expect(surface().className).toBe("rata-popover");
    rerender(<Fixture placement="inline-end" />);
    expect(surface().className).toBe("rata-popover rata-popover--inline-end");
  });

  test("each popover gets its own anchor name, shared by trigger and surface", () => {
    render(
      <>
        <Popover title="One" trigger={<Button>First</Button>}>
          <p>a</p>
        </Popover>
        <Popover title="Two" trigger={<Button>Second</Button>}>
          <p>b</p>
        </Popover>
      </>
    );
    const names = screen
      .getAllByRole("button")
      .map((b) => b.style.getPropertyValue("--rata-popover-anchor"));
    expect(names[0]).toMatch(/^--rata-popover-[A-Za-z0-9_-]+$/);
    expect(names[0]).not.toBe(names[1]);
    const surfaces = screen.getAllByRole("dialog", { hidden: true });
    expect(surfaces[0]!.style.getPropertyValue("--rata-popover-anchor")).toBe(names[0]);
  });

  test("the trigger keeps its own style and pointer handler", () => {
    const onPointerDown = vi.fn();
    render(
      <Popover
        title="Share link"
        trigger={
          <Button style={{ marginTop: "4px" }} onPointerDown={onPointerDown}>
            Share
          </Button>
        }
      >
        <p>a</p>
      </Popover>
    );
    expect(trigger().style.marginTop).toBe("4px");
    fireEvent.pointerDown(trigger());
    expect(onPointerDown).toHaveBeenCalledOnce();
  });
});
