import { describe, expect, test, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Radio } from "./radio.js";
import { RadioGroup } from "./radio-group.js";

afterEach(cleanup);

const group = (props: Record<string, unknown> = {}) =>
  render(
    <RadioGroup label="Billing period" {...props}>
      <Radio value="monthly" label="Monthly" />
      <Radio value="annual" label="Annual" />
      <Radio value="lifetime" label="Lifetime" />
    </RadioGroup>
  );

describe("RadioGroup", () => {
  test("is a radiogroup named by its visible label, not by a duplicate", () => {
    group();
    const rg = screen.getByRole("radiogroup", { name: "Billing period" });
    // aria-labelledby pointing at the visible span, never aria-label alongside
    // it — that combination announced the group's name twice.
    expect(rg.getAttribute("aria-labelledby")).toBeTruthy();
    expect(rg.getAttribute("aria-label")).toBeNull();
  });

  test("only the chosen option is the tab stop", () => {
    group({ defaultValue: "annual" });
    const [m, a, l] = screen.getAllByRole("radio") as HTMLElement[];
    expect([m!.tabIndex, a!.tabIndex, l!.tabIndex]).toEqual([-1, 0, -1]);
  });

  test("an unanswered group is entered at its first enabled option", () => {
    render(
      <RadioGroup label="Shipping">
        <Radio value="a" label="A" disabled />
        <Radio value="b" label="B" />
      </RadioGroup>
    );
    const [a, b] = screen.getAllByRole("radio") as HTMLElement[];
    expect(a!.tabIndex).toBe(-1);
    expect(b!.tabIndex).toBe(0);
  });

  test("arrow keys move real focus and select as they move", async () => {
    const onValueChange = vi.fn();
    group({ defaultValue: "monthly", onValueChange });
    const [m, a] = screen.getAllByRole("radio") as HTMLElement[];
    m!.focus();
    await userEvent.keyboard("{ArrowDown}");
    // The primitive reports which value should be focused; the wrapper does the
    // focusing. Only a real DOM can show that it actually happened.
    expect(document.activeElement).toBe(a);
    expect(onValueChange).toHaveBeenCalledWith("annual");
  });

  test("arrows wrap at the ends", async () => {
    group({ defaultValue: "monthly" });
    const radios = screen.getAllByRole("radio");
    radios[0]!.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(radios[2]);
  });

  test("Home and End jump to the ends", async () => {
    group({ defaultValue: "annual" });
    const radios = screen.getAllByRole("radio");
    radios[1]!.focus();
    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(radios[2]);
    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toBe(radios[0]);
  });

  test("a disabled option takes focus but never becomes the answer", async () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup label="Shipping" defaultValue="standard" onValueChange={onValueChange}>
        <Radio value="standard" label="Standard" />
        <Radio value="overnight" label="Overnight" disabled />
      </RadioGroup>
    );
    const [std, over] = screen.getAllByRole("radio");
    std!.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(over);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("every option shares one name, which is what makes them exclusive", () => {
    group();
    const names = new Set(screen.getAllByRole("radio").map((r) => r.getAttribute("name")));
    expect(names.size).toBe(1);
  });

  test("a disabled group refuses to change while staying reachable", async () => {
    const onValueChange = vi.fn();
    group({ defaultValue: "monthly", disabled: true, onValueChange });
    await userEvent.click(screen.getAllByRole("radio")[1]!);
    expect(onValueChange).not.toHaveBeenCalled();
    for (const r of screen.getAllByRole("radio")) {
      expect(r.getAttribute("aria-disabled")).toBe("true");
      expect(r).toHaveProperty("disabled", false);
    }
  });

  test("clicking an option selects it", async () => {
    const onValueChange = vi.fn();
    group({ defaultValue: "monthly", onValueChange });
    await userEvent.click(screen.getByText("Lifetime"));
    expect(onValueChange).toHaveBeenCalledWith("lifetime");
  });
});

describe("Radio", () => {
  test("throws outside a RadioGroup rather than rendering something inert", () => {
    // Deliberate: alone it has no name to share and no siblings to exclude, so
    // it would look right and behave like nothing.
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Radio value="a" label="A" />)).toThrow(/inside a RadioGroup/);
    quiet.mockRestore();
  });
});
