/**
 * Headless tooltip behavior — a short, non-interactive hint attached to one
 * focusable trigger, shown on hover and keyboard focus.
 *
 * Pure functions, no framework hooks and no timers. The open DELAY is decided
 * here (which openings wait for `motion.delay.hint` and which do not); the
 * wrapper owns the clock, because how long the delay is comes from the token,
 * not from this file.
 *
 * SPLIT IN TWO, as docs/platforms.md §2.3 asks of a new primitive:
 *
 *   core     `tooltipReducer`, `tooltipIsOpen` and `tooltipOpenIsDelayed` —
 *            which inputs open and close the hint, the hover bridge, Escape,
 *            and which openings wait. No ARIA, no event shapes beyond plain
 *            data, so a native wrapper can call them as they are (on React
 *            Native it never draws anything, but the same rules say so).
 *   web      `getTooltipProps` — the ids, `role="tooltip"`, the ARIA
 *            reference `relationship` picks, and the Escape key handler.
 *
 * WHAT IT MEETS: WCAG 1.4.13. Dismissible — Escape closes it without moving
 * focus. Hoverable — the pointer can cross from the trigger onto the hint
 * without it closing. Persistent — it stays while the pointer is over either
 * or focus is on the trigger, and never closes on a timer.
 */

/** Whether the hint is the trigger's name or a description of it. */
export type TooltipRelationship = "label" | "description";

/**
 * How focus arrived at the trigger, as the wrapper's modality tracking saw it.
 *
 *   keyboard   Tab, an arrow key, or a programmatic move — opens immediately
 *   pointer    a mouse or pen press; the hover already handled the hint
 *   touch      a tap; the tooltip never draws for touch
 */
export type TooltipFocusModality = "keyboard" | "pointer" | "touch";

/** Where the pointer went when it left the trigger or the hint. */
export type TooltipPointerDestination = "trigger" | "tooltip" | "outside";

/** Everything the hint reacts to. Plain data, mapped from DOM events by the wrapper. */
export type TooltipEvent =
  /** The pointer entered the trigger or the hint. `pointerType` as reported. */
  | { type: "pointer-enter"; target: "trigger" | "tooltip"; pointerType: string }
  /** The pointer left the trigger or the hint, for `to`. */
  | { type: "pointer-leave"; to: TooltipPointerDestination }
  | { type: "focus"; modality: TooltipFocusModality }
  | { type: "blur" }
  /** Escape, from anywhere while the hint is showing. */
  | { type: "escape" }
  /** The platform closed it — `popover="hint"` light-dismiss or close request. */
  | { type: "dismiss" };

export interface TooltipState {
  /** The pointer is over the trigger or the hint. */
  hovered: boolean;
  /** The trigger has focus that arrived by keyboard. */
  focused: boolean;
  /** Escape or the platform closed it; stays shut until a fresh hover or focus. */
  dismissed: boolean;
}

export const tooltipInitialState: TooltipState = {
  hovered: false,
  focused: false,
  dismissed: false,
};

// ── Core: platform-agnostic decisions ────────────────────────────────────

/**
 * Whether a pointer of this type shows the hint. Touch does not, by design:
 * showing on tap hijacks the tap that was meant for the control, and showing
 * on long-press collides with the platform's own. A pen that reports hover
 * does show it.
 */
export function tooltipShowsForPointer(pointerType: string): boolean {
  return pointerType !== "touch";
}

export function tooltipIsOpen(state: TooltipState): boolean {
  return !state.dismissed && (state.hovered || state.focused);
}

/**
 * Whether an event that opens the hint should wait for `motion.delay.hint`
 * first. A pointer resting on the trigger waits, so a pointer passing over a
 * toolbar does not flash every hint along the way. Keyboard focus never
 * waits: focus is never a passing pointer.
 */
export function tooltipOpenIsDelayed(event: TooltipEvent): boolean {
  return event.type === "pointer-enter";
}

export function tooltipReducer(state: TooltipState, event: TooltipEvent): TooltipState {
  switch (event.type) {
    case "pointer-enter": {
      if (!tooltipShowsForPointer(event.pointerType)) return state;
      if (event.target === "tooltip") {
        // Only an open hint can be entered — it is not painted otherwise. And
        // entering it is not a fresh request, so it does not undo Escape.
        return tooltipIsOpen(state) ? { ...state, hovered: true } : state;
      }
      // A fresh hover over the trigger, after Escape, is a new request.
      return { ...state, hovered: true, dismissed: false };
    }
    case "pointer-leave":
      // The hover bridge: moving between the trigger and the hint is not
      // leaving, so a magnified reader can move onto the hint to read it.
      if (event.to === "trigger" || event.to === "tooltip") return state;
      return { ...state, hovered: false };
    case "focus":
      // A press or a tap focuses the trigger too. Neither is keyboard focus:
      // a mouse press already has the hover, and a tap must not draw at all.
      if (event.modality !== "keyboard") return state;
      return { ...state, focused: true, dismissed: false };
    case "blur":
      return { ...state, focused: false };
    case "escape":
    case "dismiss":
      return tooltipIsOpen(state) ? { ...state, dismissed: true } : state;
  }
}

// ── Web: ids, ARIA and the Escape handler ────────────────────────────────

/** The part of a keyboard event this reads. */
export interface TooltipKeyEvent {
  key: string;
  preventDefault(): void;
  stopPropagation(): void;
}

export interface TooltipOptions {
  tooltipId: string;
  relationship?: TooltipRelationship;
  open?: boolean;
  /** Receives every event the primitive itself produces — today, Escape. */
  onEvent?: (event: TooltipEvent) => void;
}

export interface TooltipTriggerProps {
  /** Set when `relationship` is `label`: the hint is the trigger's name. */
  "aria-labelledby"?: string;
  /** Set when `relationship` is `description`: the hint adds detail. */
  "aria-describedby"?: string;
}

export interface TooltipSurfaceProps {
  id: string;
  role: "tooltip";
}

export interface TooltipProps {
  trigger: TooltipTriggerProps;
  tooltip: TooltipSurfaceProps;
  /**
   * Escape, for a listener on the document while the hint is showing — not on
   * the trigger alone, because 1.4.13 requires dismissing a hint the pointer
   * summoned while focus is somewhere else entirely. Returns whether it
   * handled the key.
   */
  onKeyDown: (event: TooltipKeyEvent) => boolean;
}

export function getTooltipProps(options: TooltipOptions): TooltipProps {
  const { tooltipId, relationship = "description", open = false, onEvent } = options;

  return {
    trigger:
      relationship === "label"
        ? { "aria-labelledby": tooltipId }
        : { "aria-describedby": tooltipId },
    tooltip: { id: tooltipId, role: "tooltip" },
    onKeyDown: (event) => {
      // Left alone while closed, so the key belongs to whatever is around the
      // trigger — a Dialog that should close, say.
      if (!open || event.key !== "Escape") return false;
      // The first Escape dismisses the hint and nothing else: it is the
      // topmost thing on screen, and a reader pressing Escape to get rid of
      // it should not also lose the dialog or popover underneath.
      event.preventDefault();
      event.stopPropagation();
      onEvent?.({ type: "escape" });
      return true;
    },
  };
}
