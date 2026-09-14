/**
 * Headless tabs behavior.
 *
 * Pure function, no framework hooks and no timers. Nothing here touches the
 * DOM: where the pattern requires focus to move, this reports which value
 * should receive it and leaves the focusing to the wrapper, as
 * `getToggleButtonGroupProps` and `getMenuProps` do.
 *
 * WHY THIS IS NOT getToggleButtonGroupProps, when both are "one of several":
 * a segmented control picks a VALUE, and tabs pick which of several panels is
 * SHOWN. That difference is in the ARIA, in the keyboard model, and in what
 * the reader is told:
 *
 *   radiogroup   Answers a question. Every option is announced as a choice,
 *                and the answer is submitted with the rest of the form.
 *   tablist      Reveals a region. Each tab says which panel it controls,
 *                each panel says which tab named it, and moving between them
 *                changes what is on screen rather than what will be sent.
 *
 * Using a radiogroup for tabs tells a screen reader a form is being filled
 * in; using tabs for a form control hides the answer inside a region nobody
 * submits. They look alike and they are not the same control.
 *
 * ACTIVATION IS A CHOICE the caller has to make, and the reason it is a prop
 * rather than a default is cost. Automatic activation — the arrow keys select
 * as they move — is what APG recommends and what a reader expects, but it
 * means arrowing past four tabs renders four panels. Manual activation moves
 * focus and waits for Enter or Space, which is correct when a panel fetches
 * something. The wrong one is not a style error: automatic over an expensive
 * panel fires requests nobody asked for.
 */

/** The part of a keyboard event this reads. */
export interface TabsKeyEvent {
  key: string;
  preventDefault(): void;
}

export type TabsOrientation = "horizontal" | "vertical";

/** Whether the arrow keys select as they move, or only move. */
export type TabsActivation = "automatic" | "manual";

export interface TabDescriptor {
  value: string;
  /** Unavailable, but still focusable and announced — activation is guarded. */
  disabled?: boolean;
}

export interface TabsOptions {
  /** Tabs in DOM order. Order matters: the arrow keys walk this list. */
  tabs: readonly TabDescriptor[];
  /** Which panel is showing. */
  value: string;
  /** Which tab holds focus. Defaults to the selected one. */
  focusedValue?: string | null;
  /** Prefix for the generated tab and panel ids, so each pair can point at the other. */
  idBase: string;
  orientation?: TabsOrientation;
  activation?: TabsActivation;
  /** Accessible name for the tablist. Required unless `labelledBy` names an existing element. */
  label?: string;
  labelledBy?: string;
  onValueChange?: (value: string) => void;
  /** Called with the value whose tab should take DOM focus — the wrapper focuses it. */
  onFocusValue?: (value: string) => void;
}

export interface TabProps {
  id: string;
  role: "tab";
  type: "button";
  "aria-selected": boolean;
  /** The panel this tab reveals. Half of the pair that makes a tablist a tablist. */
  "aria-controls": string;
  "aria-disabled": true | undefined;
  tabIndex: number;
  onClick: (event: { preventDefault(): void }) => void;
}

export interface TabPanelProps {
  id: string;
  role: "tabpanel";
  /** The tab that named this panel — the other half of the pair. */
  "aria-labelledby": string;
  /**
   * In the tab order even with nothing focusable inside it.
   *
   * Without this, Tab from the tablist skips a panel of plain text entirely
   * and the reader never reaches the content the tab promised.
   */
  tabIndex: 0;
  hidden: boolean;
}

export interface TabsProps {
  tablist: {
    role: "tablist";
    "aria-label": string | undefined;
    "aria-labelledby": string | undefined;
    "aria-orientation": TabsOrientation;
    onKeyDown: (event: TabsKeyEvent) => void;
  };
  tab: (value: string) => TabProps;
  panel: (value: string) => TabPanelProps;
}

const HORIZONTAL_PREVIOUS = "ArrowLeft";
const HORIZONTAL_NEXT = "ArrowRight";
const VERTICAL_PREVIOUS = "ArrowUp";
const VERTICAL_NEXT = "ArrowDown";

export function getTabsProps(options: TabsOptions): TabsProps {
  const {
    tabs,
    value,
    focusedValue = null,
    idBase,
    orientation = "horizontal",
    activation = "automatic",
    label,
    labelledBy,
    onValueChange,
    onFocusValue,
  } = options;

  const values = tabs.map((tab) => tab.value);
  const byValue = new Map(tabs.map((tab) => [tab.value, tab]));
  const isDisabled = (candidate: string) => byValue.get(candidate)?.disabled === true;

  const tabId = (candidate: string) => `${idBase}-tab-${candidate}`;
  const panelId = (candidate: string) => `${idBase}-panel-${candidate}`;

  /** The tab the arrow keys move from: wherever focus is, or the selected one. */
  const current = focusedValue !== null && byValue.has(focusedValue) ? focusedValue : value;

  function select(candidate: string) {
    if (isDisabled(candidate)) return;
    onValueChange?.(candidate);
  }

  function moveTo(index: number) {
    const target = values[index];
    if (target === undefined) return;
    onFocusValue?.(target);
    // Automatic activation selects as focus moves, which is what APG
    // recommends and what a reader expects. A disabled tab can still be
    // REACHED — this system's disabled controls stay focusable and
    // announced — so focus moves there and selection does not follow.
    if (activation === "automatic" && !isDisabled(target)) select(target);
  }

  return {
    tablist: {
      role: "tablist",
      "aria-label": labelledBy ? undefined : label || undefined,
      "aria-labelledby": labelledBy || undefined,
      // Announced because it is a promise this component keeps: the arrow keys
      // that move between tabs are the ones for this axis.
      "aria-orientation": orientation,
      onKeyDown: (event) => {
        if (values.length === 0) return;
        const previous = orientation === "vertical" ? VERTICAL_PREVIOUS : HORIZONTAL_PREVIOUS;
        const next = orientation === "vertical" ? VERTICAL_NEXT : HORIZONTAL_NEXT;
        const index = values.indexOf(current);

        if (event.key === previous) {
          event.preventDefault();
          moveTo((index - 1 + values.length) % values.length);
          return;
        }
        if (event.key === next) {
          event.preventDefault();
          moveTo((index + 1) % values.length);
          return;
        }
        if (event.key === "Home") {
          event.preventDefault();
          moveTo(0);
          return;
        }
        if (event.key === "End") {
          event.preventDefault();
          moveTo(values.length - 1);
          return;
        }
        // Manual activation only: with automatic, the tab under focus is
        // already selected, and Enter on a button would fire a click anyway.
        if (activation === "manual" && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          select(current);
        }
      },
    },

    tab: (candidate: string) => ({
      id: tabId(candidate),
      role: "tab",
      type: "button",
      "aria-selected": candidate === value,
      "aria-controls": panelId(candidate),
      "aria-disabled": isDisabled(candidate) || undefined,
      // Roving tabindex: the tablist is one stop from outside, and the arrow
      // keys move within it. Derived from focus-or-selection rather than
      // stored, so the two can never disagree.
      tabIndex: candidate === current ? 0 : -1,
      onClick: (event) => {
        if (isDisabled(candidate)) {
          event.preventDefault();
          return;
        }
        onFocusValue?.(candidate);
        select(candidate);
      },
    }),

    panel: (candidate: string) => ({
      id: panelId(candidate),
      role: "tabpanel",
      "aria-labelledby": tabId(candidate),
      tabIndex: 0,
      hidden: candidate !== value,
    }),
  };
}
