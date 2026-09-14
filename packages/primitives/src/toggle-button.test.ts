import { describe, expect, it, vi } from "vitest";
import { getToggleButtonProps } from "./toggle-button.js";

const clickEvent = () => ({ preventDefault: vi.fn() });

describe("getToggleButtonProps", () => {
  it("asks for the opposite state on activation", () => {
    const onPressedChange = vi.fn();
    const props = getToggleButtonProps({ pressed: false, onPressedChange });
    const event = clickEvent();
    props.onClick(event);
    expect(onPressedChange).toHaveBeenCalledWith(true, event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("asks to turn off when it is on", () => {
    const onPressedChange = vi.fn();
    getToggleButtonProps({ pressed: true, onPressedChange }).onClick(clickEvent());
    expect(onPressedChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it("never flips the state itself", () => {
    const props = getToggleButtonProps({ pressed: true });
    props.onClick(clickEvent());
    expect(props["aria-pressed"]).toBe(true);
  });

  it("announces aria-pressed in both states", () => {
    expect(getToggleButtonProps({ pressed: false })["aria-pressed"]).toBe(false);
    expect(getToggleButtonProps({ pressed: true })["aria-pressed"]).toBe(true);
  });

  it("inherits the button's disabled contract rather than reimplementing it", () => {
    const onPressedChange = vi.fn();
    const props = getToggleButtonProps({ disabled: true, onPressedChange });
    const event = clickEvent();
    props.onClick(event);
    expect(onPressedChange).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(props["aria-disabled"]).toBe(true);
    expect(props["aria-pressed"]).toBe(false);
  });

  it("blocks activation while loading and stays a toggle", () => {
    const onPressedChange = vi.fn();
    const props = getToggleButtonProps({ pressed: true, loading: true, onPressedChange });
    props.onClick(clickEvent());
    expect(onPressedChange).not.toHaveBeenCalled();
    expect(props["aria-busy"]).toBe(true);
    expect(props["data-loading"]).toBe("");
    expect(props["aria-pressed"]).toBe(true);
  });
});
