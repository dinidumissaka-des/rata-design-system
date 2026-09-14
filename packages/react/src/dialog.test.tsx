import { describe, expect, test, vi, afterEach, beforeAll } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { Button } from "./button.js";
import { Dialog } from "./dialog.js";
import { installDialogShim } from "./test-support.js";

/**
 * jsdom leaves showModal/close undefined. The shim implements the state
 * machine and the initial-focus move, and deliberately implements neither the
 * focus trap nor the inert page — so nothing below asserts those. They come
 * from the platform, which is the entire reason this component is a native
 * <dialog> rather than a div.
 */
beforeAll(installDialogShim);

afterEach(cleanup);

const Fixture = (props: Record<string, unknown> = {}) => (
  <Dialog title="Delete project" open onClose={() => {}} {...props}>
    This cannot be undone.
  </Dialog>
);

describe("Dialog", () => {
  test("is a dialog named by its title, and described by its description", () => {
    render(<Fixture description="Everything in it goes too." />);
    const dialog = screen.getByRole("dialog", { name: "Delete project" });
    const describedBy = dialog.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)!.textContent).toBe("Everything in it goes too.");
  });

  test("no description means no dangling aria-describedby", () => {
    render(<Fixture />);
    expect(screen.getByRole("dialog").getAttribute("aria-describedby")).toBeNull();
  });

  test("the title is a real heading — a modal is its own outline", () => {
    render(<Fixture />);
    // Unlike Notice, which cannot know its level: everything behind a modal is
    // inert, so the outline inside it starts fresh.
    const heading = screen.getByRole("heading", { name: "Delete project" });
    expect(heading.tagName).toBe("H2");
    expect(screen.getByRole("dialog").getAttribute("aria-labelledby")).toBe(heading.id);
  });

  test("closed renders nothing to the accessibility tree", () => {
    render(<Fixture open={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("opening goes through showModal, not the open attribute", () => {
    // The distinction is the whole component: `<dialog open>` is non-modal,
    // with no focus trap, no backdrop and no inert page behind it.
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    render(<Fixture />);
    expect(showModal).toHaveBeenCalled();
    showModal.mockRestore();
  });

  test("the close button is named and reports its reason", async () => {
    const onClose = vi.fn();
    render(<Fixture onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledWith("close-button");
  });

  test("dismissLabel renames the close button", () => {
    render(<Fixture dismissLabel="Close the delete dialog" />);
    expect(screen.getByRole("button", { name: "Close the delete dialog" })).toBeTruthy();
  });

  test("Escape reports 'escape' and does not close behind React's back", () => {
    const onClose = vi.fn();
    render(<Fixture onClose={onClose} />);
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    const cancel = new Event("cancel", { cancelable: true, bubbles: true });
    fireEvent(dialog, cancel);
    expect(onClose).toHaveBeenCalledWith("escape");
    // Always prevented, so `open` stays the single source of truth — letting
    // the platform close it would leave the prop claiming it is showing.
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(true);
  });

  test("a backdrop click closes, but a click inside does not", async () => {
    const onClose = vi.fn();
    render(<Fixture onClose={onClose} />);
    const dialog = screen.getByRole("dialog");

    await userEvent.click(screen.getByText("This cannot be undone."));
    expect(onClose).not.toHaveBeenCalled();

    // A click landing on the <dialog> itself is a click on the backdrop: the
    // element's box is the surface, and the backdrop is painted outside it.
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledWith("backdrop");
  });

  describe("dismissible={false}", () => {
    test("removes the close button", () => {
      render(<Fixture dismissible={false} />);
      expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    });

    test("blocks Escape, so the footer is the only way out", () => {
      const onClose = vi.fn();
      render(<Fixture dismissible={false} onClose={onClose} />);
      const cancel = new Event("cancel", { cancelable: true, bubbles: true });
      fireEvent(screen.getByRole("dialog"), cancel);
      expect(onClose).not.toHaveBeenCalled();
      expect(cancel.defaultPrevented).toBe(true);
    });

    test("ignores backdrop clicks too", () => {
      const onClose = vi.fn();
      render(<Fixture dismissible={false} onClose={onClose} />);
      fireEvent.click(screen.getByRole("dialog"));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  test("the footer reads after the body it acts on", () => {
    render(<Fixture footer={<Button>Delete</Button>} />);
    const body = screen.getByText("This cannot be undone.");
    const action = screen.getByRole("button", { name: "Delete" });
    // DOCUMENT_POSITION_FOLLOWING
    expect(body.compareDocumentPosition(action) & 4).toBeTruthy();
  });

  test("no footer renders no footer region", () => {
    const { container } = render(<Fixture />);
    expect(container.querySelector(".rata-dialog-footer")).toBeNull();
  });

  test("size picks a width class and defaults to md", () => {
    const { container: def } = render(<Fixture />);
    expect(def.querySelector(".rata-dialog--md")).toBeTruthy();
    const { container: lg } = render(<Fixture size="lg" />);
    expect(lg.querySelector(".rata-dialog--lg")).toBeTruthy();
  });

  test("the page cannot scroll while it is open, and can again after", () => {
    // `inert` stops the page behind being interactive but not from scrolling,
    // and a modal that scrolls the page behind it loses the reader's place.
    const { unmount } = render(<Fixture />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  test("closing it restores the page's scroll", () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog title="T" open={open} onClose={() => setOpen(false)}>
          Body
        </Dialog>
      );
    }
    render(<Harness />);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("dialog"));
    expect(document.body.style.overflow).toBe("");
  });

  test("initialFocus chooses where focus lands, after showModal has had its say", () => {
    function Harness() {
      const cancelRef = useRef<HTMLButtonElement | null>(null);
      return (
        <Dialog
          title="Delete project"
          open
          onClose={() => {}}
          initialFocus={cancelRef}
          footer={
            <>
              <Button ref={cancelRef} variant="secondary">
                Cancel
              </Button>
              <Button variant="destructive">Delete</Button>
            </>
          }
        >
          This cannot be undone.
        </Dialog>
      );
    }
    render(<Harness />);
    // A destructive confirm should open on Cancel, not on Delete and not on
    // the close button, which is what showModal would pick on its own.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  });

  test("without initialFocus, focus is the platform's choice inside the dialog", () => {
    render(<Fixture footer={<Button>Delete</Button>} />);
    // The first focusable descendant — the close button. Documented rather
    // than fought, because `initialFocus` is the way to override it.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
  });

  test("a native close is reported, so the page does not stay locked", () => {
    // `<form method="dialog">` is the documented HTML way to close a dialog,
    // and the platform can close one for its own reasons too. Neither goes
    // through onClose, and the effect is keyed on `open` so it never re-runs
    // to notice — `open` went on claiming the dialog was showing and the
    // scroll lock stayed on the body with nothing open.
    const reasons: string[] = [];
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog
          title="Edit"
          open={open}
          onClose={(reason) => {
            reasons.push(reason);
            setOpen(false);
          }}
        >
          <form method="dialog">
            <button type="submit">Done</button>
          </form>
        </Dialog>
      );
    }
    render(<Harness />);
    expect(document.body.style.overflow).toBe("hidden");

    act(() => {
      (document.querySelector("dialog") as HTMLDialogElement).close();
    });

    expect(reasons).toEqual(["external"]);
    expect(document.body.style.overflow).toBe("");
  });

  test("our own close does not report itself as external", () => {
    const reasons: string[] = [];
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog title="Edit" open={open} onClose={(r) => { reasons.push(r); setOpen(false); }}>
          body
        </Dialog>
      );
    }
    render(<Harness />);
    // The close button's own path. `node.close()` fires the same native event,
    // so the handler has to tell the two apart — it reports only while React
    // still believes the dialog is open.
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(reasons).toEqual(["close-button"]);
  });

  test("role narrows to alertdialog, which a native dialog cannot be on its own", () => {
    render(<Fixture role="alertdialog" description="Everything in it goes too." />);
    expect(screen.getByRole("alertdialog", { name: "Delete project" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("it is a plain dialog by default", () => {
    render(<Fixture />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  test("passes the rest through, so it can be identified by the caller", () => {
    render(<Fixture id="confirm" data-testid="d" />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.id).toBe("confirm");
    expect(dialog.getAttribute("data-testid")).toBe("d");
  });

  test("the page does not shift sideways when the scrollbar is taken away", () => {
    // Hiding the overflow removes the scrollbar and the page reflows into the
    // space it occupied — content jumps as the dialog opens and jumps back as
    // it closes. jsdom reports no scrollbar of its own, so one is simulated.
    const clientWidth = vi
      .spyOn(document.documentElement, "clientWidth", "get")
      .mockReturnValue(window.innerWidth - 15);

    const { unmount } = render(<Fixture />);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.paddingInlineEnd).toBe("15px");

    unmount();
    // Removed, not blanked, so a stylesheet's own padding comes back.
    expect(document.body.style.paddingInlineEnd).toBe("");
    expect(document.body.getAttribute("style")).not.toContain("padding-inline-end");
    clientWidth.mockRestore();
  });

  test("overlay scrollbars take up no width, so nothing is padded", () => {
    // The macOS default: there is no gutter to hold, and adding one would
    // itself be the shift this is meant to prevent. Mocked rather than left
    // to the environment because jsdom does no layout and reports
    // clientWidth as 0 — which would look like a full-viewport gutter.
    const clientWidth = vi
      .spyOn(document.documentElement, "clientWidth", "get")
      .mockReturnValue(window.innerWidth);

    const { unmount } = render(<Fixture />);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.paddingInlineEnd).toBe("");
    unmount();
    clientWidth.mockRestore();
  });

  test("two overlapping dialogs do not leave the page locked", () => {
    // Save-and-restore gets this wrong: the second dialog captures "hidden" as
    // the value to put back, so closing it locks the page with nothing open.
    const first = render(<Dialog title="One" open onClose={() => {}}>A</Dialog>);
    const second = render(<Dialog title="Two" open onClose={() => {}}>B</Dialog>);
    expect(document.body.style.overflow).toBe("hidden");
    second.unmount();
    expect(document.body.style.overflow).toBe("hidden");
    first.unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
