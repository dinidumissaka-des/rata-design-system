import { describe, expect, test, vi, afterEach, beforeAll } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Button } from "./button.js";
import { MobileNav } from "./mobile-nav.js";
import { installDialogShim } from "./test-support.js";

// jsdom leaves showModal/close undefined. The shim implements the state
// machine and the initial-focus move, and deliberately not the focus trap or
// the inert page — so nothing below asserts those. They come from the
// platform, which is the whole reason this is a native <dialog>.
beforeAll(installDialogShim);

afterEach(cleanup);

const SECTIONS = [
  {
    items: [
      { label: "Invoices", href: "/invoices", current: true },
      { label: "Clients", href: "/clients" },
    ],
  },
];

describe("MobileNav", () => {
  test("the trigger is a named disclosure, and the drawer is shut", () => {
    render(<MobileNav sections={SECTIONS} />);
    const trigger = screen.getByRole("button", { name: "Menu" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-controls")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("opening goes through showModal, not the open attribute", async () => {
    // The distinction is the point: `<dialog open>` is non-modal, with no
    // focus trap, no backdrop, and a live page behind it.
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    render(<MobileNav sections={SECTIONS} />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(showModal).toHaveBeenCalled();
    showModal.mockRestore();
  });

  test("the drawer is named, and holds a named nav landmark", async () => {
    render(<MobileNav sections={SECTIONS} title="Ratā" label="Main" />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const drawer = screen.getByRole("dialog", { name: "Ratā" });
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(drawer.contains(nav)).toBe(true);
  });

  test("its title is a paragraph, not a heading", async () => {
    // The drawer sits in the page's own outline and cannot know its level.
    // Dialog's title is an h2 because modal content starts a fresh outline;
    // a nav drawer is still the page.
    render(<MobileNav sections={SECTIONS} title="Ratā" />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("Ratā").tagName).toBe("P");
  });

  test("it renders a real SideNav rather than a second copy of one", async () => {
    render(<MobileNav sections={SECTIONS} />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    // The rail's own markup: a list of links with the current one announced.
    expect(screen.getByRole("link", { name: "Invoices" }).getAttribute("aria-current")).toBe(
      "page"
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  test("picking a destination closes it", async () => {
    // Under client-side routing nothing else would: the document never
    // unloads, so the drawer would stay open over the page just navigated to.
    render(<MobileNav sections={SECTIONS} />);
    const trigger = screen.getByRole("button", { name: "Menu" });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("link", { name: "Clients" }));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  test("the close control closes it", async () => {
    render(<MobileNav sections={SECTIONS} />);
    const trigger = screen.getByRole("button", { name: "Menu" });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  test("Escape closes it without the platform going behind React's back", async () => {
    render(<MobileNav sections={SECTIONS} />);
    const trigger = screen.getByRole("button", { name: "Menu" });
    await userEvent.click(trigger);
    const drawer = screen.getByRole("dialog") as HTMLDialogElement;
    const cancel = new Event("cancel", { cancelable: true, bubbles: true });
    fireEvent(drawer, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  test("a backdrop click closes it, a click inside does not", async () => {
    render(<MobileNav sections={SECTIONS} title="Ratā" />);
    const trigger = screen.getByRole("button", { name: "Menu" });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByText("Ratā"));
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("dialog"));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  test("a native close is reported, so the page does not stay locked", () => {
    // The bug this guard exists for, and the one Dialog had: the effect is
    // keyed on `open`, so nothing else notices a close it did not cause.
    function Harness() {
      const [open, setOpen] = useState(true);
      return <MobileNav sections={SECTIONS} open={open} onOpenChange={setOpen} />;
    }
    render(<Harness />);
    expect(document.body.style.overflow).toBe("hidden");
    act(() => {
      (document.querySelector("dialog") as HTMLDialogElement).close();
    });
    expect(document.body.style.overflow).toBe("");
  });

  test("the page cannot scroll while it is open, and can again after", async () => {
    const { unmount } = render(<MobileNav sections={SECTIONS} defaultOpen />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  test("its scroll lock is the same one Dialog uses", async () => {
    // Two counters would fight: whichever closed first would unlock the page
    // while the other still covered it.
    const first = render(<MobileNav sections={SECTIONS} defaultOpen />);
    const second = render(<MobileNav sections={SECTIONS} defaultOpen />);
    expect(document.body.style.overflow).toBe("hidden");
    second.unmount();
    expect(document.body.style.overflow).toBe("hidden");
    first.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  test("controlled: the caller owns open and is told when it should change", async () => {
    const onOpenChange = vi.fn();
    render(<MobileNav sections={SECTIONS} open={false} onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("triggerLabel and closeLabel name the icon-only controls", async () => {
    render(<MobileNav sections={SECTIONS} triggerLabel="Open navigation" closeLabel="Dismiss" />);
    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeTruthy();
  });

  test("the footer sits outside the nav landmark", async () => {
    render(<MobileNav sections={SECTIONS} footer={<Button>Sign out</Button>} />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const nav = screen.getByRole("navigation");
    // None of it is navigation — the same split TopNav makes.
    expect(nav.contains(screen.getByRole("button", { name: "Sign out" }))).toBe(false);
  });

  test("passes the rest through, which is how the page decides its breakpoint", () => {
    const { container } = render(
      <MobileNav sections={SECTIONS} className="narrow-only" data-testid="m" />
    );
    const wrap = container.querySelector(".narrow-only")!;
    expect(wrap.getAttribute("data-testid")).toBe("m");
  });
});
