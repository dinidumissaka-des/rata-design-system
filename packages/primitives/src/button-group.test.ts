import { describe, expect, it } from "vitest";
import { getButtonGroupProps, hasAccessibleName } from "./button-group.js";

describe("getButtonGroupProps", () => {
  it("is a named group by default, horizontal", () => {
    const props = getButtonGroupProps({ label: "Row actions" });
    expect(props.role).toBe("group");
    expect(props["aria-label"]).toBe("Row actions");
    expect(props["aria-labelledby"]).toBeUndefined();
    expect(props["data-orientation"]).toBe("horizontal");
  });

  it("prefers labelledBy over label when both are given", () => {
    const props = getButtonGroupProps({ label: "Row actions", labelledBy: "heading-1" });
    expect(props["aria-labelledby"]).toBe("heading-1");
    expect(props["aria-label"]).toBeUndefined();
  });

  it("emits no empty name attributes when unnamed", () => {
    const props = getButtonGroupProps();
    expect(props["aria-label"]).toBeUndefined();
    expect(props["aria-labelledby"]).toBeUndefined();
  });

  it("carries orientation as data, not as aria-orientation", () => {
    const props = getButtonGroupProps({ label: "Filters", orientation: "vertical" });
    expect(props["data-orientation"]).toBe("vertical");
    expect(props).not.toHaveProperty("aria-orientation");
  });

  it("reports whether the group is named", () => {
    expect(hasAccessibleName({ label: "Actions" })).toBe(true);
    expect(hasAccessibleName({ labelledBy: "heading-1" })).toBe(true);
    expect(hasAccessibleName({ label: "   " })).toBe(false);
    expect(hasAccessibleName()).toBe(false);
  });
});
