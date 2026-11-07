/**
 * Headless popover behavior — a non-modal, titled surface anchored to a
 * trigger, holding a small piece of interactive content.
 *
 * Pure function, no framework hooks and no timers. Nothing here touches the
 * DOM: like `getMenuProps`, it reports what happened and why, and leaves
 * moving focus to the wrapper.
 *
 * SPLIT IN TWO, as docs/platforms.md §2.3 asks of a new primitive:
 *
 *   core     `popoverCloseReasonForFocus` and `popoverReturnsFocus` — which
 *            focus moves close the popover, and which closes send focus back
 *            to the trigger. No ARIA, no event shapes; a native wrapper can
 *            call them as they are.
 *   web      `getPopoverProps` — the ids, `role="dialog"`, `aria-expanded`
 *            and the keyboard handlers, built on the core.
 *
 * WHY NOT getMenuProps OR getDisclosureProps. A menu has one tab stop and
 * arrow keys; a popover's content is an ordinary run of controls reached by
 * Tab. A disclosure never moves focus; a popover moves it in on open. Each
 * shares the close-reason reporting and nothing else.
 *
 * NOT `aria-haspopup="dialog"` on the trigger: screen readers announce it
 * inconsistently, which the contract decided at gate 1.
 */

/** The part of a keyboard event this reads. */
export interface PopoverKeyEvent {
  key: string;
  preventDefault(): void;
}

/**
 * Why the popover is closing. The wrapper uses it to decide about focus.
 *
 *   trigger   the trigger toggled it shut
 *   escape    Escape, from inside the popover or from the trigger
 *   tab       focus moved to a control outside the popover
 *   dismiss   the platform light-dismissed it — a click elsewhere
 */
export type PopoverCloseReason = "trigger" | "escape" | "tab" | "dismiss";

/**
 * Where focus went when it left an element inside the popover. The wrapper
 * works this out from the DOM; the decision about it is made here.
 *
 *   inside    another element in the popover
 *   trigger   the popover's own trigger
 *   outside   a focusable element anywhere else
 *   nowhere   no element — a click on something unfocusable, or the window
 *             losing focus
 */
export type PopoverFocusDestination = "inside" | "trigger" | "outside" | "nowhere";

// ── Core: platform-agnostic decisions ────────────────────────────────────

/**
 * Which focus moves close the popover. Only one does: focus reaching a
 * control outside it, which is what Tab past the last control does.
 *
 * `trigger` stays open: Shift+Tab from the first control lands there, and the
 * trigger toggles the popover itself if it is pressed. `nowhere` stays open
 * too: clicking the popover's own text sends focus to the body, and that is
 * not leaving. A click outside is the platform's light-dismiss to report, not
 * this function's.
 */
export function popoverCloseReasonForFocus(
  destination: PopoverFocusDestination
): PopoverCloseReason | null {
  return destination === "outside" ? "tab" : null;
}

/**
 * Whether a close sends focus back to the trigger.
 *
 * Escape does, because that is where the reader was. Tab and light-dismiss
 * do not: the reader chose a new place, and taking focus back would undo it.
 * A trigger press does not need to — focus is already on the trigger.
 */
export function popoverReturnsFocus(reason: PopoverCloseReason): boolean {
  return reason === "escape";
}

// ── Web: ids, ARIA and handlers ──────────────────────────────────────────

export interface PopoverOptions {
  /** Ids, so the trigger, the popover and its title can point at each other. */
  triggerId: string;
  popoverId: string;
  titleId: string;
  open?: boolean;
  onOpenChange?: (open: boolean, reason: PopoverCloseReason) => void;
}

export interface PopoverTriggerProps {
  id: string;
  "aria-expanded": boolean;
  "aria-controls": string;
  onClick: (event: { preventDefault(): void }) => void;
  /**
   * The same Escape handler the popover gets. Shift+Tab from the first
   * control lands on the trigger with the popover still open, and Escape
   * there has to close it, as it does on a Disclosure's trigger.
   */
  onKeyDown: (event: PopoverKeyEvent) => void;
}

export interface PopoverSurfaceProps {
  id: string;
  /** Not `aria-modal`: the page behind a popover is still live. */
  role: "dialog";
  /** Named by its visible title, which is a styled label, not a heading. */
  "aria-labelledby": string;
  onKeyDown: (event: PopoverKeyEvent) => void;
}

export interface PopoverProps {
  trigger: PopoverTriggerProps;
  popover: PopoverSurfaceProps;
  title: { id: string };
  /**
   * Report where focus went when it left an element inside the popover.
   * Closes it with reason `tab` when that is outside. Not a DOM prop: the
   * wrapper maps its own focus-out event onto a destination first.
   */
  focusMoved: (destination: PopoverFocusDestination) => void;
  /** Report that the platform light-dismissed it. Closes with reason `dismiss`. */
  dismissed: () => void;
}

export function getPopoverProps(options: PopoverOptions): PopoverProps {
  const { triggerId, popoverId, titleId, open = false, onOpenChange } = options;

  function close(reason: PopoverCloseReason) {
    onOpenChange?.(false, reason);
  }

  /**
   * Escape closes it. Left alone while closed, so the key belongs to whatever
   * is around the trigger — a Dialog that should close, say — rather than
   * being swallowed by a popover that is not showing.
   *
   * Tab is NOT handled here, unlike in a menu: the popover holds several
   * controls, and only the last Tab leaves it. That is a focus move, reported
   * through `focusMoved`.
   */
  function onKeyDown(event: PopoverKeyEvent) {
    if (!open) return;
    if (event.key !== "Escape") return;
    // Prevented, so the platform's own close request for `popover="auto"`
    // does not close it a second time without the reason.
    event.preventDefault();
    close("escape");
  }

  return {
    trigger: {
      id: triggerId,
      "aria-expanded": open,
      // Pointed at always, not only while open: the popover element is always
      // mounted, so the reference always resolves.
      "aria-controls": popoverId,
      // Enter and Space arrive as a click, as do a tap and a mouse press, so
      // every input opens it the same way — which is what makes a Popover the
      // touch answer a Tooltip is not.
      onClick: () => {
        if (open) close("trigger");
        else onOpenChange?.(true, "trigger");
      },
      onKeyDown,
    },
    popover: {
      id: popoverId,
      role: "dialog",
      "aria-labelledby": titleId,
      onKeyDown,
    },
    title: { id: titleId },
    focusMoved: (destination) => {
      if (!open) return;
      const reason = popoverCloseReasonForFocus(destination);
      if (reason !== null) close(reason);
    },
    dismissed: () => {
      if (open) close("dismiss");
    },
  };
}
