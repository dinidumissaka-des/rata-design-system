import { describe, expect, it, vi } from "vitest";
import { getToggleButtonGroupProps } from "./toggle-button-group.js";

const values = ["left", "center", "right"] as const;
const key = (name: string) => ({ key: name, preventDefault: vi.fn() });
const clickEvent = () => ({ preventDefault: vi.fn() });

describe("getToggleButtonGroupProps — single mode", () => {
  it("is a radiogroup of radios", () => {
    const props = getToggleButtonGroupProps({ values: [...values], value: "center", label: "Align" });
    expect(props.root.role).toBe("radiogroup");
    expect(props.root["aria-label"]).toBe("Align");
    expect(props.item("center").role).toBe("radio");
    expect(props.item("center")["aria-checked"]).toBe(true);
    expect(props.item("left")["aria-checked"]).toBe(false);
    expect(props.item("center")["aria-pressed"]).toBeUndefined();
  });

  it("puts the single tab stop on the selected option", () => {
    const props = getToggleButtonGroupProps({ values: [...values], value: "right" });
    expect(props.item("right").tabIndex).toBe(0);
    expect(props.item("left").tabIndex).toBe(-1);
  });

  it("enters an empty group at its first option", () => {
    const props = getToggleButtonGroupProps({ values: [...values], value: null });
    expect(props.item("left").tabIndex).toBe(0);
    expect(props.item("center").tabIndex).toBe(-1);
  });

  it("replaces the selection on click", () => {
    const onValueChange = vi.fn();
    const props = getToggleButtonGroupProps({ values: [...values], value: "left", onValueChange });
    props.item("right").onClick(clickEvent());
    expect(onValueChange).toHaveBeenCalledWith("right");
  });

  it("keeps the selection when the selected option is clicked again", () => {
    const onValueChange = vi.fn();
    const props = getToggleButtonGroupProps({ values: [...values], value: "left", onValueChange });
    props.item("left").onClick(clickEvent());
    expect(onValueChange).toHaveBeenCalledWith("left");
  });

  it("clears the selection on re-click only when deselectable", () => {
    const onValueChange = vi.fn();
    const props = getToggleButtonGroupProps({
      values: [...values],
      value: "left",
      deselectable: true,
      onValueChange,
    });
    props.item("left").onClick(clickEvent());
    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  it("moves and selects with the arrow keys, wrapping at both ends", () => {
    const onValueChange = vi.fn();
    const onFocusValue = vi.fn();
    const props = getToggleButtonGroupProps({
      values: [...values],
      value: "left",
      onValueChange,
      onFocusValue,
    });

    const forward = key("ArrowRight");
    props.root.onKeyDown(forward);
    expect(forward.preventDefault).toHaveBeenCalledOnce();
    expect(onFocusValue).toHaveBeenCalledWith("center");
    expect(onValueChange).toHaveBeenCalledWith("center");

    props.root.onKeyDown(key("ArrowLeft"));
    expect(onFocusValue).toHaveBeenLastCalledWith("right");
    expect(onValueChange).toHaveBeenLastCalledWith("right");
  });

  it("jumps to the ends with Home and End", () => {
    const onFocusValue = vi.fn();
    const props = getToggleButtonGroupProps({ values: [...values], value: "center", onFocusValue });
    props.root.onKeyDown(key("End"));
    expect(onFocusValue).toHaveBeenLastCalledWith("right");
    props.root.onKeyDown(key("Home"));
    expect(onFocusValue).toHaveBeenLastCalledWith("left");
  });

  it("ignores keys it does not own", () => {
    const onFocusValue = vi.fn();
    const props = getToggleButtonGroupProps({ values: [...values], value: "left", onFocusValue });
    const event = key("a");
    props.root.onKeyDown(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onFocusValue).not.toHaveBeenCalled();
  });

  it("lets focus reach a disabled option without selecting it", () => {
    const onValueChange = vi.fn();
    const onFocusValue = vi.fn();
    const props = getToggleButtonGroupProps({
      values: [...values],
      value: "left",
      disabledValues: ["center"],
      onValueChange,
      onFocusValue,
    });

    props.root.onKeyDown(key("ArrowRight"));
    expect(onFocusValue).toHaveBeenCalledWith("center");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(props.item("center")["aria-disabled"]).toBe(true);
  });

  it("guards clicks on a disabled option", () => {
    const onValueChange = vi.fn();
    const props = getToggleButtonGroupProps({
      values: [...values],
      value: "left",
      disabledValues: ["right"],
      onValueChange,
    });
    const event = clickEvent();
    props.item("right").onClick(event);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });
});

describe("getToggleButtonGroupProps — multiple mode", () => {
  const multiple = { values: [...values], selectionMode: "multiple" as const };

  it("is a plain group of pressed toggles", () => {
    const props = getToggleButtonGroupProps({ ...multiple, value: ["left"], label: "Style" });
    expect(props.root.role).toBe("group");
    expect(props.item("left").role).toBeUndefined();
    expect(props.item("left")["aria-pressed"]).toBe(true);
    expect(props.item("center")["aria-pressed"]).toBe(false);
    expect(props.item("left")["aria-checked"]).toBeUndefined();
  });

  it("gives every item its own tab stop", () => {
    const props = getToggleButtonGroupProps({ ...multiple, value: ["center"] });
    expect(props.item("left").tabIndex).toBe(0);
    expect(props.item("center").tabIndex).toBe(0);
  });

  it("adds and removes values, always reporting them in DOM order", () => {
    const onValueChange = vi.fn();
    const props = getToggleButtonGroupProps({ ...multiple, value: ["right"], onValueChange });
    props.item("left").onClick(clickEvent());
    expect(onValueChange).toHaveBeenCalledWith(["left", "right"]);

    const withBoth = getToggleButtonGroupProps({
      ...multiple,
      value: ["left", "right"],
      onValueChange,
    });
    withBoth.item("left").onClick(clickEvent());
    expect(onValueChange).toHaveBeenLastCalledWith(["right"]);
  });

  it("leaves the arrow keys alone", () => {
    const onFocusValue = vi.fn();
    const props = getToggleButtonGroupProps({ ...multiple, value: [], onFocusValue });
    const event = key("ArrowRight");
    props.root.onKeyDown(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onFocusValue).not.toHaveBeenCalled();
  });

  it("announces no orientation, since it implements no arrow navigation", () => {
    const props = getToggleButtonGroupProps({ ...multiple, orientation: "vertical" });
    expect(props.root["aria-orientation"]).toBeUndefined();
    expect(props.root["data-orientation"]).toBe("vertical");
  });
});
