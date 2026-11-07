import { describe, expect, test, afterEach, beforeAll, vi } from "vitest";
import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Plus } from "@rata/icons";
import { Fab } from "./fab.js";
import { Menu, MenuItem } from "./menu.js";
import { installPopoverShim } from "./test-support.js";

beforeAll(installPopoverShim);
afterEach(cleanup);

describe("Fab", () => {
  test("is a type=button button whose visible label is its name", () => {
    render(<Fab label="New note" icon={Plus} />);
    const fab = screen.getByRole("button", { name: "New note" });
    expect(fab.getAttribute("type")).toBe("button");
    expect(fab.hasAttribute("aria-label")).toBe(false);
    expect(fab.textContent).toBe("New note");
  });

  test("the icon is decorative", () => {
    render(<Fab label="New note" icon={Plus} />);
    expect(screen.getByRole("button").querySelector("svg")!.getAttribute("aria-hidden")).toBe(
      "true"
    );
  });

  test("labelHidden moves the label into aria-label and keeps the name", () => {
    render(<Fab label="Compose" icon={Plus} labelHidden />);
    const fab = screen.getByRole("button", { name: "Compose" });
    expect(fab.getAttribute("aria-label")).toBe("Compose");
    expect(fab.textContent).toBe("");
    expect(fab.className).toContain("rata-fab--label-hidden");
  });

  test("composes the state layer, flush because it has no border", () => {
    render(<Fab label="New note" icon={Plus} />);
    const fab = screen.getByRole("button");
    expect(fab.className).toContain("rata-state-layer");
    expect(fab.className).toContain("rata-state-layer--flush");
  });

  test("placement center adds its modifier; end is the default", () => {
    const { rerender } = render(<Fab label="Shutter" icon={Plus} />);
    expect(screen.getByRole("button").className).not.toContain("rata-fab--center");
    rerender(<Fab label="Shutter" icon={Plus} placement="center" />);
    expect(screen.getByRole("button").className).toContain("rata-fab--center");
  });

  test("activates on click", () => {
    const onClick = vi.fn();
    render(<Fab label="New note" icon={Plus} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("disabled is aria-disabled, stays focusable, and blocks activation", () => {
    const onClick = vi.fn();
    render(<Fab label="New note" icon={Plus} disabled onClick={onClick} />);
    const fab = screen.getByRole("button");
    expect(fab.getAttribute("aria-disabled")).toBe("true");
    expect(fab.hasAttribute("disabled")).toBe(false);
    fab.focus();
    expect(document.activeElement).toBe(fab);
    fireEvent.click(fab);
    expect(onClick).not.toHaveBeenCalled();
  });

  test("loading shows a Spinner in place of the icon, keeps the label and blocks activation", () => {
    const onClick = vi.fn();
    render(<Fab label="Send" icon={Plus} loading onClick={onClick} />);
    const fab = screen.getByRole("button", { name: "Send" });
    expect(fab.getAttribute("aria-disabled")).toBe("true");
    expect(fab.getAttribute("aria-busy")).toBe("true");
    expect(fab.querySelector(".rata-spinner")).not.toBeNull();
    expect(fab.querySelector("svg")).toBeNull();
    fireEvent.click(fab);
    expect(onClick).not.toHaveBeenCalled();
  });

  test("forwards its ref", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Fab ref={ref} label="New note" icon={Plus} />);
    expect(ref.current).toBe(screen.getByRole("button"));
  });

  test("a speed dial is a Menu with the FAB as its trigger", () => {
    render(
      <Menu label="Add" trigger={<Fab label="Add" icon={Plus} />}>
        <MenuItem onSelect={() => {}}>Photo</MenuItem>
        <MenuItem onSelect={() => {}}>Note</MenuItem>
      </Menu>
    );
    const fab = screen.getByRole("button", { name: "Add" });
    expect(fab.getAttribute("aria-haspopup")).toBe("menu");
    expect(fab.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(fab);
    expect(fab.getAttribute("aria-expanded")).toBe("true");
  });
});
