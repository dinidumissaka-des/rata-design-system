import { describe, expect, test, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Panel } from "./panel.js";

afterEach(cleanup);

const Fixture = (props: Record<string, unknown> = {}) => (
  <Panel title="color.accent.600" {...props}>
    Raw hue ramps.
  </Panel>
);

describe("Panel", () => {
  test("is a complementary landmark named by its own heading", () => {
    render(<Fixture />);
    // Named, because an unnamed complementary landmark is listed as
    // "complementary" and nothing else — worse than useless on a page with
    // two of them.
    const panel = screen.getByRole("complementary", { name: "color.accent.600" });
    const labelledBy = panel.getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelledBy)!.textContent).toBe("color.accent.600");
  });

  test("the heading level is the caller's, because only they know the depth", () => {
    render(<Fixture headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3, name: "color.accent.600" })).toBeTruthy();
  });

  test("it defaults to h2 rather than refusing to render", () => {
    render(<Fixture />);
    expect(screen.getByRole("heading", { level: 2 })).toBeTruthy();
  });

  test("it is NOT a dialog — that is the whole distinction from Sheet", () => {
    // A panel is in normal flow, so the page beside it stays usable. If this
    // ever reports a dialog role, the two components have collapsed into one
    // and the reason both exist is gone.
    render(<Fixture />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("no onClose means no close button, which is how a panel says it is persistent", () => {
    // Rather than rendering a control the caller has to ignore, or asking
    // them to pass a no-op to get one.
    render(<Fixture />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("an onClose gets a button that calls it", async () => {
    const onClose = vi.fn();
    render(<Fixture onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    // No reason argument, unlike Dialog's and Sheet's: the button is the only
    // way this closes.
    expect(onClose).toHaveBeenCalledWith();
  });

  test("the close button can be named for a page with more than one panel", () => {
    render(<Fixture onClose={() => {}} closeLabel="Close token documentation" />);
    expect(screen.getByRole("button", { name: "Close token documentation" })).toBeTruthy();
  });

  test("Escape does not close it", () => {
    // Escape dismisses the top layer. This covers nothing, nothing has
    // trapped focus, and the reader may well be typing in the page beside it.
    const onClose = vi.fn();
    render(<Fixture onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("complementary"), { key: "Escape" });
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  test("opening it does not move focus", () => {
    // Opening a panel adds a region to the page; it does not take the reader
    // anywhere. Moving their focus would be a surprise.
    const before = document.activeElement;
    render(<Fixture onClose={() => {}} />);
    expect(document.activeElement).toBe(before);
  });

  test("it does not lock the page's scroll", () => {
    // The page beside it is meant to stay usable, scrolling included. This is
    // the assertion that fails first if anyone reaches for Sheet's machinery
    // to implement this one.
    const { unmount } = render(<Fixture onClose={() => {}} />);
    expect(document.body.style.overflow).toBe("");
    unmount();
  });

  test("the default edge is inline-end, where a detail panel is expected", () => {
    render(<Fixture />);
    expect(screen.getByRole("complementary").className).toContain("rata-panel--inline-end");
  });

  test.each(["inline-start", "inline-end"] as const)(
    "edge %s carries the class the stylesheet draws its border from",
    (edge) => {
      // Geometry is CSS and jsdom applies no stylesheet, so asserting a
      // computed border here would pass whatever the CSS said, including
      // nothing. What can be checked is that the class is the one the
      // stylesheet targets.
      render(<Fixture edge={edge} />);
      expect(screen.getByRole("complementary").className).toContain(`rata-panel--${edge}`);
    },
  );

  test("the body is a region of its own, so it can scroll without taking the title", () => {
    render(<Fixture />);
    const body = document.querySelector(".rata-panel-body")!;
    expect(body.textContent).toBe("Raw hue ramps.");
    // The title is outside it, which is what keeps it and the close control
    // in view while the body scrolls.
    expect(body.querySelector(".rata-panel-heading")).toBeNull();
  });

  test("the dismiss composes the state layer rather than its own hover", () => {
    render(<Fixture onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Close" }).className).toContain("rata-state-layer");
  });

  test("extra props reach the element, so the page can place it", () => {
    render(<Fixture className="pg-inspector" id="token-doc" />);
    const panel = screen.getByRole("complementary");
    expect(panel.className).toContain("pg-inspector");
    expect(panel.className).toContain("rata-panel");
    expect(panel.id).toBe("token-doc");
  });
});
