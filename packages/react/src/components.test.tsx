import { describe, expect, test, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch } from "./switch.js";
import { ToggleButton } from "./toggle-button.js";
import { ToggleButtonGroup } from "./toggle-button-group.js";
import { TextField } from "./text-field.js";
import { Avatar } from "./avatar.js";
import { Button } from "./button.js";

afterEach(cleanup);

describe("Switch", () => {
  test("announces as a switch, not a checkbox", () => {
    render(<Switch label="Notifications" />);
    expect(screen.getByRole("switch", { name: "Notifications" })).toBeTruthy();
  });

  test("toggles on click and reports where it is going", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch label="Notifications" onCheckedChange={onCheckedChange} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
  });

  test("Space toggles it, because it is a real input underneath", async () => {
    render(<Switch label="Notifications" />);
    const s = screen.getByRole("switch") as HTMLInputElement;
    s.focus();
    await userEvent.keyboard(" ");
    expect(s.checked).toBe(true);
  });

  test("disabled refuses the change but keeps focus and its state readable", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch label="Notifications" checked disabled onCheckedChange={onCheckedChange} />);
    const s = screen.getByRole("switch") as HTMLInputElement;
    await userEvent.click(s);
    expect(onCheckedChange).not.toHaveBeenCalled();
    s.focus();
    expect(document.activeElement).toBe(s);
    // A native checkbox carrying role="switch" conveys the state through its
    // checkedness (HTML-AAM), so there is no aria-checked to go stale. The
    // role query's `checked` filter reads aria-checked only, so assert the
    // property the platform actually exposes.
    expect(s.checked).toBe(true);
    expect(s.getAttribute("aria-disabled")).toBe("true");
  });

  test("a blocked activation leaves the native checkedness intact", async () => {
    // The drawn control paints from data-state and looks right either way.
    // What this guards is the form payload and what a screen reader reads: a
    // canceled checkbox activation toggles rather than restores, so the value
    // has to be re-asserted after the dispatch. See keep-checkedness.ts.
    render(<Switch label="Notifications" checked disabled />);
    const s = screen.getByRole("switch") as HTMLInputElement;
    await userEvent.click(s);
    await Promise.resolve();
    expect(s.checked).toBe(true);
  });

  test("an off, disabled switch does not come back on either", async () => {
    render(<Switch label="Notifications" disabled />);
    const s = screen.getByRole("switch") as HTMLInputElement;
    await userEvent.click(s);
    await Promise.resolve();
    expect(s.checked).toBe(false);
  });
});

describe("ToggleButtonGroup", () => {
  const group = (props: Record<string, unknown> = {}) =>
    render(
      <ToggleButtonGroup label="Alignment" {...props}>
        <ToggleButton value="left">Left</ToggleButton>
        <ToggleButton value="center">Center</ToggleButton>
        <ToggleButton value="right">Right</ToggleButton>
      </ToggleButtonGroup>
    );

  test("single mode is a radiogroup of radios", () => {
    group({ defaultValue: "left" });
    expect(screen.getByRole("radiogroup", { name: "Alignment" })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  test("multiple mode is a group of pressed toggles, with its own tab stops", () => {
    group({ selectionMode: "multiple", defaultValue: ["left"] });
    expect(screen.getByRole("group", { name: "Alignment" })).toBeTruthy();
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.tabIndex)).toEqual([0, 0, 0]);
    expect(buttons[0]!.getAttribute("aria-pressed")).toBe("true");
  });

  test("single mode moves focus with the arrow keys", async () => {
    group({ defaultValue: "left" });
    const items = screen.getAllByRole("radio");
    items[0]!.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(items[1]);
  });

  test("deselectable lets a click clear the answer", async () => {
    const onValueChange = vi.fn();
    group({ defaultValue: "left", deselectable: true, onValueChange });
    await userEvent.click(screen.getByText("Left"));
    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  test("a disabled group reports no change on click", async () => {
    const onValueChange = vi.fn();
    group({ defaultValue: "left", disabled: true, onValueChange });
    await userEvent.click(screen.getByText("Center"));
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("ToggleButton", () => {
  test("standalone, it is a pressed button and not a radio", async () => {
    const onPressedChange = vi.fn();
    render(<ToggleButton pressed={false} onPressedChange={onPressedChange}>Bold</ToggleButton>);
    const b = screen.getByRole("button", { name: "Bold" });
    expect(b.getAttribute("aria-pressed")).toBe("false");
    expect(b.getAttribute("role")).toBeNull();
    await userEvent.click(b);
    expect(onPressedChange).toHaveBeenCalledWith(true, expect.anything());
  });

  test("loading blocks activation while staying focusable", async () => {
    const onPressedChange = vi.fn();
    render(<ToggleButton loading onPressedChange={onPressedChange}>Star</ToggleButton>);
    const b = screen.getByRole("button");
    await userEvent.click(b);
    expect(onPressedChange).not.toHaveBeenCalled();
    expect(b.getAttribute("aria-busy")).toBe("true");
  });
});

describe("Button", () => {
  test("loading refuses the click and says it is busy, not broken", async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const b = screen.getByRole("button");
    await userEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
    expect(b.getAttribute("aria-busy")).toBe("true");
    expect(b).toHaveProperty("disabled", false);
  });
});

describe("TextField", () => {
  test("the label focuses the field, and description precedes message", async () => {
    render(
      <TextField label="Email" description="Format hint" status="invalid" message="Fix it" />
    );
    const input = screen.getByLabelText("Email");
    await userEvent.click(screen.getByText("Email"));
    expect(document.activeElement).toBe(input);
    const ids = input.getAttribute("aria-describedby")!.split(" ");
    const texts = ids.map((id) => document.getElementById(id)?.textContent);
    expect(texts).toEqual(["Format hint", "Fix it"]);
  });

  test("a stale message at idle stays on screen but leaves the description chain", () => {
    render(<TextField label="Email" status="idle" message="left over" />);
    expect(screen.getByText("left over")).toBeTruthy();
    expect(screen.getByLabelText("Email").getAttribute("aria-describedby")).toBeNull();
  });

  test("disabled is readOnly and aria-disabled, so it refuses typing yet keeps focus", async () => {
    render(<TextField label="State" disabled />);
    const input = screen.getByLabelText("State") as HTMLInputElement;
    await userEvent.type(input, "abc");
    expect(input.value).toBe("");
    expect(input).toHaveProperty("disabled", false);
    input.focus();
    expect(document.activeElement).toBe(input);
  });
});

describe("Avatar", () => {
  test("falls back to initials when the image fails, keeping the full name", () => {
    render(<Avatar name="Ada Hartley" src="/nope.png" />);
    fireEvent.error(document.querySelector("img")!);
    // The name is what is announced; "AH" is only what is drawn.
    const el = screen.getByRole("img", { name: "Ada Hartley" });
    expect(el.textContent).toBe("AH");
  });

  test("decorative is hidden from assistive technology", () => {
    render(<Avatar name="Ada Hartley" decorative />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});
