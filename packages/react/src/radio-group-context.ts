import { createContext, useContext } from "react";
import type { RadioGroupItemProps } from "@rata/primitives";

/**
 * How a `Radio` learns which group it belongs to.
 *
 * A Radio outside a RadioGroup has no name to share, no siblings to be
 * exclusive with, and no way to be reached by arrow keys — everything that
 * makes it a radio lives in the group. So the context is not optional context
 * with a fallback: its absence is a mistake the component reports.
 */
export interface RadioGroupContextValue {
  getItemProps: (value: string) => RadioGroupItemProps;
  /** Hands the option's node to the group, which needs it to move focus. */
  registerItem: (value: string, element: HTMLInputElement | null) => void;
}

export const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export const useRadioGroup = () => useContext(RadioGroupContext);
