import { describe, expect, test, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Panel } from "./panel.js";

/**
 * No dialog shim here, and that absence is the point: a Panel is not a
 * `<dialog>`, is not in the top layer, and needs nothing from the platform
 * that jsdom lacks.
 *
 * Nothing below asserts the panel's measure, because it has none — the page
 * owns the width, the same bargain SideNav makes. And nothing asserts a
 * computed style: jsdom applies no stylesheet, so an assertion about a border
 * or a padding would pass whatever the CSS said, including nothing.
 */
afterEach(cleanup);

const Fixture = (props: Record<string, unknown> = {}) => (
  <Panel title="color.accent.600" {...props}>
    Raw hue ramps.
  </Panel>
);

describe("Panel", () => {
  test("is a complementary landmark named by its own heading", () => {
    render(<Fixture />);
    // An unnamed complementary landmark is listed as "complementary" and
    // nothing else, which is worse than useless on a page with two.
    const panel = screen.getByRole("complementary", { name: "color.accent.600" });
    const labelledBy = panel.getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelledBy)!.tagName).toBe("H2");
  });

  test("the heading level is the caller's, because only they know the depth", () => {
    render(<Fixture headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3, name: "color.accent.600" })).toBeTruthy();
    // And it still names the landmark at whatever level it was given.
    expect(screen.getByRole("complementary", { name: "color.accent.600" })).toBeTruthy();
  });

  test("it is NOT a dialog — that is the whole distinction from Sheet", () => {
    render(<Fixture />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("complementary").tagName).toBe("ASIDE");
  });

  test("no onClose means no close button, which is how a persistent panel is said", () => {
    render(<Fixture />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("onClose renders the button and is called by it", async () => {
    const onClose = vi.fn();
    render(<Fixture onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("closeLabel names the icon-only control", () => {
    render(<Fixture onClose={() => {}} closeLabel="Close token documentation" />);
    expect(screen.getByRole("button", { name: "Close token documentation" })).toBeTruthy();
  });

  test("Escape does NOT close it", () => {
    // Escape dismisses the top layer. This covers nothing, has trapped no
    // focus, and the reader may well be typing in the page beside it — and
    // there would be nowhere to return their focus to.
    const onClose = vi.fn();
    render(<Fixture onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("complementary"), { key: "Escape" });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  test("opening it does not move the reader's focus", () => {
    // Opening a panel adds a region to the page; it does not take the reader
    // anywhere, so moving focus would be a surprise. All three of moving,
    // trapping and restoring focus are modal behaviours.
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    render(<Fixture onClose={() => {}} />);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  test("the default edge is inline-end, where a detail panel is expected", () => {
    render(<Fixture />);
    expect(screen.getByRole("complementary").className).toContain("rata-panel--inline-end");
  });

  test.each(["inline-start", "inline-end"] as const)(
    "edge %s carries the class the stylesheet draws the border from",
    (edge) => {
      render(<Fixture edge={edge} />);
      expect(screen.getByRole("complementary").className).toContain(`rata-panel--${edge}`);
    },
  );

  test("the body is its own scrolling region, so the title stays reachable", () => {
    render(<Fixture onClose={() => {}} />);
    const body = screen.getByText("Raw hue ramps.");
    expect(body.className).toContain("rata-panel-body");
    // The head is a sibling of the scrolling region rather than inside it,
    // which is what keeps the title and the way out in view.
    expect(body.parentElement!.querySelector(".rata-panel-header")).toBeTruthy();
  });

  test("the dismiss composes the state layer rather than its own hover", () => {
    render(<Fixture onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Close" }).className).toContain("rata-state-layer");
  });

  test("it does not lock the page's scroll", () => {
    // A modal locks the page because scrolling behind it loses the reader's
    // place. There is no behind here.
    render(<Fixture onClose={() => {}} />);
    expect(document.body.style.overflow).toBe("");
  });
});
