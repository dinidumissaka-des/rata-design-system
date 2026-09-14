import { describe, expect, test, vi, afterEach, beforeAll } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { Button } from "./button.js";
import { Sheet } from "./sheet.js";
import { installDialogShim } from "./test-support.js";

/**
 * jsdom leaves showModal/close undefined. The shim implements the state
 * machine only, and deliberately implements neither the focus trap nor the
 * inert page — so nothing below asserts those. They come from the platform,
 * which is the entire reason this is a native <dialog>.
 *
 * Nothing here asserts geometry either: which edge the sheet is pinned to,
 * how far it comes in and which corners are rounded are all CSS, and jsdom
 * applies no stylesheet. Asserting a computed margin here would pass whatever
 * the CSS said, including nothing at all. What CAN be checked is that the
 * class carrying that geometry is the one the stylesheet targets.
 */
beforeAll(installDialogShim);

afterEach(cleanup);

const Fixture = (props: Record<string, unknown> = {}) => (
  <Sheet title="Filters" open onClose={() => {}} {...props}>
    Body content.
  </Sheet>
);

describe("Sheet", () => {
  test("is a dialog named by its title, and described by its description", () => {
    render(<Fixture description="Narrow the results." />);
    const sheet = screen.getByRole("dialog", { name: "Filters" });
    const describedBy = sheet.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)!.textContent).toBe("Narrow the results.");
  });

  test("no description means no dangling aria-describedby", () => {
    render(<Fixture />);
    expect(screen.getByRole("dialog").getAttribute("aria-describedby")).toBeNull();
  });

  test("the title is a real heading — a modal is its own outline", () => {
    render(<Fixture />);
    expect(screen.getByRole("heading", { level: 2, name: "Filters" })).toBeTruthy();
  });

  test("it is opened with showModal, not the open attribute", () => {
    // The distinction the whole component rests on: `<dialog open>` is
    // NON-modal — no focus trap, no backdrop, a live page behind it — and it
    // looks identical on screen.
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    render(<Fixture />);
    expect(showModal).toHaveBeenCalled();
    showModal.mockRestore();
  });

  test("closed means not in the accessibility tree", () => {
    render(<Fixture open={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("the default edge is the bottom, which is what a sheet usually means", () => {
    render(<Fixture />);
    expect(screen.getByRole("dialog").className).toContain("rata-sheet--block-end");
  });

  test.each(["block-start", "block-end", "inline-start", "inline-end"] as const)(
    "edge %s carries the class the stylesheet pins and rounds by",
    (edge) => {
      render(<Fixture edge={edge} />);
      expect(screen.getByRole("dialog").className).toContain(`rata-sheet--${edge}`);
    },
  );

  test("size is one measure, whichever axis it applies to", () => {
    // One prop rather than two, because a bottom sheet's size is its height
    // and a drawer's is its width. The class is the same either way; the
    // stylesheet reads it against `edge` to know which axis.
    render(<Fixture edge="inline-end" size="lg" />);
    const drawer = screen.getByRole("dialog");
    expect(drawer.className).toContain("rata-sheet--lg");
    expect(drawer.className).toContain("rata-sheet--inline-end");
  });

  test("Escape reports rather than closing, so React stays the source of open", () => {
    const onClose = vi.fn();
    render(<Fixture onClose={onClose} />);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledWith("escape");
    // Still open: the platform would have closed it, leaving `open` lying.
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  test("a click on the sheet itself is a backdrop click", async () => {
    const onClose = vi.fn();
    render(<Fixture onClose={onClose} />);
    // The element's box IS the surface; the backdrop is painted outside it,
    // so a click whose target is the <dialog> landed on the backdrop.
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledWith("backdrop");

    onClose.mockClear();
    await userEvent.click(screen.getByText("Body content."));
    expect(onClose).not.toHaveBeenCalled();
  });

  test("the close button reports its own reason", async () => {
    const onClose = vi.fn();
    render(<Fixture onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledWith("close-button");
  });

  test("not dismissible removes the button and blocks Escape and the backdrop", () => {
    const onClose = vi.fn();
    render(<Fixture dismissible={false} onClose={onClose} />);
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();

    const sheet = screen.getByRole("dialog");
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(sheet, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    fireEvent.click(sheet);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("a native close is reported, so nothing is left claiming to be open", () => {
    // <form method="dialog"> is the documented HTML way to close a dialog and
    // it does not go through onClose. Unreported, `open` went on saying the
    // sheet was showing and the scroll lock stayed on the body.
    const onClose = vi.fn();
    render(<Fixture onClose={onClose} />);
    fireEvent(screen.getByRole("dialog"), new Event("close"));
    expect(onClose).toHaveBeenCalledWith("external");
  });

  test("initialFocus wins over the platform's own choice", async () => {
    const Harness = () => {
      const safe = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Open</Button>
          <Sheet
            title="Discard changes"
            open={open}
            onClose={() => setOpen(false)}
            initialFocus={safe}
            footer={<Button ref={safe}>Keep editing</Button>}
          >
            Nothing is saved yet.
          </Sheet>
        </>
      );
    };
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep editing" }));
  });

  test("the page's scroll is locked while it is open, and released after", () => {
    const { unmount } = render(<Fixture />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  test("a sheet over a dialog does not leave the page locked", () => {
    // The reason the lock counts holders instead of saving and restoring: the
    // second surface would capture "hidden" as the value to put back, so
    // closing it locks the page with nothing open. A sheet over a dialog is
    // an ordinary combination, which is why Sheet shares that lock rather
    // than having its own.
    const first = render(
      <Sheet title="One" open onClose={() => {}}>
        A
      </Sheet>,
    );
    const second = render(
      <Sheet title="Two" open onClose={() => {}}>
        B
      </Sheet>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    second.unmount();
    expect(document.body.style.overflow).toBe("hidden");
    first.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  test("the footer reads after the body it acts on", () => {
    render(<Fixture footer={<Button>Apply</Button>} />);
    const body = screen.getByText("Body content.");
    const footer = screen.getByRole("button", { name: "Apply" });
    // DOCUMENT_POSITION_FOLLOWING: the footer comes after the body in DOM
    // order, which is the order a screen reader and the Tab key both use.
    expect(body.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("no footer means no footer element", () => {
    render(<Fixture />);
    expect(document.querySelector(".rata-sheet-footer")).toBeNull();
  });

  test("the dismiss composes the state layer rather than its own hover", () => {
    render(<Fixture />);
    expect(screen.getByRole("button", { name: "Close" }).className).toContain("rata-state-layer");
  });
});
