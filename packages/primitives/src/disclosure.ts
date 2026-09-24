/**
 * Headless disclosure behavior — a trigger that shows and hides a panel.
 *
 * Pure function, no framework hooks and no timers. Nothing here touches the
 * DOM: closing reports that it happened and leaves returning focus to the
 * wrapper, the same division `getMenuProps` uses.
 *
 * WHY THIS EXISTS SEPARATELY FROM getMenuProps, when both open a panel from a
 * button: they are different ARIA patterns for different things, and using the
 * wrong one is among the most common mistakes in a navigation bar.
 *
 *   menu         Application commands. Promises a keyboard model — one tab
 *                stop, arrow keys to move, typeahead — that assistive
 *                technology announces and users then expect.
 *   disclosure   Content that is shown or hidden. Promises nothing beyond
 *                "this button reveals that", and everything inside stays in
 *                the tab order where it was.
 *
 * A dropdown of LINKS is the second. Navigation has no commands in it, and
 * giving it `role="menu"` tells a screen reader to expect arrow-key navigation
 * that a list of links does not provide. The W3C's own menubar-navigation
 * examples are being withdrawn for this reason. So: no roving tabindex, no
 * typeahead, and Tab moves through the links exactly as it does elsewhere.
 */

/** The part of a keyboard event this reads. */
export interface DisclosureKeyEvent {
  key: string;
  preventDefault(): void;
}

export interface DisclosureOptions {
  /** Ids, so the trigger and the panel can point at each other. */
  triggerId: string;
  panelId: string;
  open?: boolean;
  disabled?: boolean;
  onOpenChange?: (open: boolean, reason: DisclosureCloseReason) => void;
}

/** Why the panel is closing. The wrapper uses it to decide about focus. */
export type DisclosureCloseReason = "trigger" | "escape";

export interface DisclosureProps {
  trigger: {
    id: string;
    type: "button";
    "aria-expanded": boolean;
    "aria-controls": string;
    "aria-disabled": true | undefined;
    onClick: (event: { preventDefault(): void }) => void;
    /**
     * The SAME handler the panel gets, and it belongs on both.
     *
     * A disclosure does not move focus when it opens — that is the difference
     * between it and a menu — so after the trigger is pressed, focus is still
     * on the trigger. An Escape handler only on the panel therefore never runs
     * in the commonest case: open it, press Escape, nothing happens.
     */
    onKeyDown: (event: DisclosureKeyEvent) => void;
  };
  panel: {
    id: string;
    /** Names the panel with the trigger's own text, so it is not anonymous. */
    "aria-labelledby": string;
    onKeyDown: (event: DisclosureKeyEvent) => void;
  };
}

export function getDisclosureProps(options: DisclosureOptions): DisclosureProps {
  const { triggerId, panelId, open = false, disabled = false, onOpenChange } = options;

  /**
   * Escape closes it, from the trigger or from inside the panel.
   *
   * Left alone when already closed, so the key belongs to whatever is around
   * the disclosure — a Dialog that should close, say — rather than being
   * swallowed by a collapsed one.
   *
   * Left alone when disabled, for the same reason the click is. Guarding only
   * the pointer made `disabled` mean two different things on one control: a
   * disclosure rendered open AND disabled could still be closed with Escape
   * and then could not be reopened, which is a trap rather than a disabled
   * control. No shipped component passed `disabled` until Disclosure did, so
   * nothing exercised this path.
   */
  function onKeyDown(event: DisclosureKeyEvent) {
    if (disabled) return;
    if (!open) return;
    if (event.key !== "Escape") return;
    event.preventDefault();
    onOpenChange?.(false, "escape");
  }

  return {
    trigger: {
      id: triggerId,
      type: "button",
      "aria-expanded": open,
      // Pointed at always, not only while open: the relationship is a fact
      // about the markup, and a reference that appears and disappears is one
      // assistive technology has to re-read to discover.
      "aria-controls": panelId,
      "aria-disabled": disabled || undefined,
      onClick: (event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onOpenChange?.(!open, "trigger");
      },
      onKeyDown,
    },
    panel: {
      id: panelId,
      "aria-labelledby": triggerId,
      onKeyDown,
    },
  };
}
