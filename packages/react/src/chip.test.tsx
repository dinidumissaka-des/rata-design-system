import { describe, expect, test, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { User } from "@rata/icons";
import { Chip } from "./chip.js";

afterEach(cleanup);

describe("Chip", () => {
  test("the chip is not focusable; its remove button is the one tab stop", () => {
    const { container } = render(<Chip onRemove={() => {}}>Ada Lovelace</Chip>);
    const chip = container.querySelector(".rata-chip")!;
    expect(chip.tagName).toBe("SPAN");
    expect(chip.hasAttribute("tabindex")).toBe(false);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  test("the remove button is named after the value by default", () => {
    render(<Chip onRemove={() => {}}>Ada Lovelace</Chip>);
    const button = screen.getByRole("button", { name: "Remove Ada Lovelace" });
    expect(button.getAttribute("type")).toBe("button");
  });

  test("removeLabel replaces the whole phrase, not a prefix", () => {
    render(
      <Chip onRemove={() => {}} removeLabel="Clear colour filter: Blue">
        Blue
      </Chip>
    );
    expect(screen.getByRole("button", { name: "Clear colour filter: Blue" })).toBeTruthy();
  });

  test("pressing the button removes", () => {
    const onRemove = vi.fn();
    render(<Chip onRemove={onRemove}>Ada</Chip>);
    fireEvent.click(screen.getByRole("button"));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test("Backspace and Delete on the focused button also remove", () => {
    const onRemove = vi.fn();
    render(<Chip onRemove={onRemove}>Ada</Chip>);
    const button = screen.getByRole("button");
    fireEvent.keyDown(button, { key: "Backspace" });
    fireEvent.keyDown(button, { key: "Delete" });
    fireEvent.keyDown(button, { key: "a" });
    expect(onRemove).toHaveBeenCalledTimes(2);
  });

  test("disabled blocks removal by every path and keeps the button focusable", () => {
    const onRemove = vi.fn();
    const { container } = render(
      <Chip onRemove={onRemove} disabled>
        Ada
      </Chip>
    );
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: "Backspace" });
    fireEvent.keyDown(button, { key: "Delete" });
    expect(onRemove).not.toHaveBeenCalled();
    expect(container.querySelector(".rata-chip")!.className).toContain("rata-chip--disabled");
  });

  test("the full value is the chip's title, so a truncated value stays reachable", () => {
    const value = "a.very.long.address@example.com";
    const { container } = render(<Chip onRemove={() => {}}>{value}</Chip>);
    expect(container.querySelector(".rata-chip")!.getAttribute("title")).toBe(value);
  });

  test("the glyphs are decorative", () => {
    const { container } = render(
      <Chip onRemove={() => {}} icon={User}>
        ada@example.com
      </Chip>
    );
    const glyphs = container.querySelectorAll("svg");
    expect(glyphs).toHaveLength(2);
    for (const glyph of glyphs) expect(glyph.getAttribute("aria-hidden")).toBe("true");
  });

  test("the remove button composes the state layer, flush because it has no border", () => {
    render(<Chip onRemove={() => {}}>Ada</Chip>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("rata-state-layer");
    expect(button.className).toContain("rata-state-layer--flush");
  });
});
