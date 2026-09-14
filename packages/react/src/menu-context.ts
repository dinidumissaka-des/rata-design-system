import { createContext, useContext } from "react";
import type { MenuItemProps } from "@rata/primitives";

/**
 * How a `MenuItem` learns it is a row in a menu.
 *
 * Context rather than `cloneElement`, for the reason `ToggleButton` uses it:
 * the item writes its ARIA and its click handling *after* spreading `rest`,
 * deliberately, so a caller cannot clobber the accessibility contract with a
 * prop. That same ordering means a cloned prop could never reach those
 * attributes either.
 *
 * It also carries the two things the menu must decide for the whole list:
 * which row holds focus, and how a row hands its DOM node back — the
 * primitive reports *which* value should be focused and leaves the focusing
 * to this wrapper, so the wrapper needs the elements.
 */
export interface MenuContextValue {
  getItemProps: (value: string) => MenuItemProps;
  registerItem: (value: string, element: HTMLButtonElement | null) => void;
  /**
   * Registers an item's descriptor with the menu so the primitive can see it.
   *
   * Items are children, so the menu cannot know their values, text or
   * disabled state until they render. They report it, and the menu re-derives
   * navigation from what it was told.
   */
  registerDescriptor: (
    value: string,
    text: string | undefined,
    disabled: boolean,
    selected?: boolean
  ) => void;
  unregisterDescriptor: (value: string) => void;
  /**
   * Registers a row's `onSelect`.
   *
   * Kept out of the descriptor list and off the render path on purpose: the
   * handler is usually a fresh closure every render, and threading it through
   * the descriptors would re-derive navigation on each one.
   */
  registerSelect: (value: string, handler: (() => void) | undefined) => void;
}

export const MenuContext = createContext<MenuContextValue | null>(null);

/**
 * Throws outside a `Menu`, rather than degrading.
 *
 * A menu item on its own has no list to navigate, no trigger to return focus
 * to and nothing to close — it would render as a plausible-looking button and
 * behave like nothing, which is the failure mode `Radio` refuses for the same
 * reason.
 */
export function useMenuContext(component: string): MenuContextValue {
  const context = useContext(MenuContext);
  if (context === null) {
    throw new Error(
      `<${component}> must be rendered inside a <Menu>. On its own it has no list to ` +
        `navigate and no trigger to return focus to.`
    );
  }
  return context;
}
