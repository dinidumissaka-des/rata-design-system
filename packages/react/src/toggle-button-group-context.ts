import { createContext, useContext } from "react";
import type { ToggleButtonGroupItemProps } from "@rata/primitives";
import type { ToggleButtonSize } from "./toggle-button.js";

/**
 * How a `ToggleButton` learns it is an option in a group.
 *
 * Context rather than `cloneElement`: `ToggleButton` sets `aria-pressed`,
 * `onClick` and friends *after* spreading `rest`, deliberately, so a caller
 * cannot clobber the accessibility contract by passing a prop. That same
 * ordering means a cloned prop cannot reach those attributes either — so the
 * group has to be something the item reads, not something done to it.
 *
 * The group also owns two decisions the item must not make for itself: `size`,
 * because a bar of options at two heights is ragged, and whether the whole
 * question is disabled.
 */
export interface ToggleButtonGroupContextValue {
  /** Per-option ARIA, tabindex and click handling, from the primitive. */
  getItemProps: (value: string) => ToggleButtonGroupItemProps;
  /** Set on the group, applied to every option. */
  size: ToggleButtonSize;
  /** True when the whole group is unavailable; ORed with the option's own `disabled`. */
  groupDisabled: boolean;
  /**
   * Hands the option's DOM node to the group, which needs it to move focus:
   * the primitive reports *which value* should be focused and leaves the
   * focusing to the wrapper.
   */
  registerItem: (value: string, element: HTMLButtonElement | null) => void;
}

export const ToggleButtonGroupContext = createContext<ToggleButtonGroupContextValue | null>(null);

export const useToggleButtonGroup = () => useContext(ToggleButtonGroupContext);
