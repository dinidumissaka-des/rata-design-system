import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";
import type {
  CSSProperties,
  FocusEvent,
  PointerEvent,
  ReactElement,
} from "react";
import {
  getTooltipProps,
  tooltipInitialState,
  tooltipIsOpen,
  tooltipOpenIsDelayed,
  tooltipReducer,
} from "@rata/primitives";
import type {
  TooltipEvent,
  TooltipFocusModality,
  TooltipPointerDestination,
  TooltipRelationship,
  TooltipState,
} from "@rata/primitives";
import { cx } from "./cx.js";

export type { TooltipRelationship };

export type TooltipPlacement = "block-start" | "block-end" | "inline-start" | "inline-end";

export interface TooltipProps {
  /** The hint text. Plain text only — a string, so a link or a button cannot be passed. */
  content: string;
  /** The one focusable element the tooltip is attached to. */
  children: ReactElement;
  /** Whether the tooltip names the trigger or describes it. */
  relationship?: TooltipRelationship;
  /** Which side of the trigger the tooltip prefers. Anchor positioning flips it near an edge. */
  placement?: TooltipPlacement;
}

// ── Focus modality ───────────────────────────────────────────────────────
//
// Keyboard focus opens the hint immediately; focus that a press or a tap
// caused must not (a mouse press already has the hover, and a tap must not
// draw at all). The focus event itself cannot tell them apart, so this tracks
// the last input on the whole document — the same heuristic :focus-visible
// uses. Starts as "keyboard", so a programmatic move (a dialog focusing its
// first control) counts as keyboard, as it does for :focus-visible.

let modality: TooltipFocusModality = "keyboard";
let modalityTracked = false;

function trackModality() {
  if (modalityTracked || typeof document === "undefined") return;
  modalityTracked = true;
  document.addEventListener(
    "keydown",
    (event) => {
      // A bare modifier is not navigation — Shift held over a toolbar, say.
      if (event.metaKey || event.altKey || event.ctrlKey) return;
      modality = "keyboard";
    },
    true
  );
  document.addEventListener(
    "pointerdown",
    (event) => {
      modality = event.pointerType === "touch" ? "touch" : "pointer";
    },
    true
  );
}

/**
 * `popover="hint"` where the engine has it — a hint does not close an open
 * Menu or Popover the way an `auto` one would — and `manual` otherwise, which
 * is the same top layer without the platform's own dismissal.
 */
function supportsHint(): boolean {
  if (typeof document === "undefined") return false;
  const probe = document.createElement("div");
  probe.setAttribute("popover", "hint");
  return (probe as HTMLElement & { popover?: string | null }).popover === "hint";
}

/**
 * `motion.delay.hint`, read from the token rather than restated here: the
 * delay follows the motion seed, and a number in this file would not. Read
 * from the hint element, so a brand theme scoped below the root still
 * applies. Without the stylesheet there is no token and no delay — the hint
 * is unstyled in that case anyway.
 */
function hintDelay(node: HTMLElement): number {
  const raw = getComputedStyle(node).getPropertyValue("--rata-motion-delay-hint").trim();
  const match = /^(-?[\d.]+)(ms|s)$/.exec(raw);
  if (match === null) return 0;
  const value = Number(match[1]);
  return match[2] === "s" ? value * 1000 : value;
}

/** Space-separated id lists, merged so a caller's own reference survives. */
function mergeIds(...ids: Array<string | undefined>): string {
  return ids.filter((id) => id !== undefined && id !== "").join(" ");
}

/**
 * A short, non-interactive hint attached to one focusable trigger.
 *
 * THE SAME MACHINERY AS POPOVER: the `popover` attribute puts the chip in the
 * top layer, and CSS anchor positioning places it against the trigger with a
 * per-instance anchor name (see `menu.tsx` for why it is generated). The hint
 * element is always mounted, so the `aria-labelledby` / `aria-describedby`
 * reference always resolves — whether or not it is showing, and on touch,
 * where it never shows at all.
 *
 * WHAT THIS WRAPPER OWNS, and `tooltipReducer` deliberately does not:
 *
 * 1. **The clock.** The primitive says which openings wait; this waits
 *    `motion.delay.hint` for them, and cancels the wait if the pointer leaves.
 * 2. **Mapping DOM events onto the primitive's inputs** — where the pointer
 *    went, and how focus arrived.
 * 3. **Escape from anywhere** while the hint shows, on the document, so a
 *    hint the pointer summoned can be dismissed wherever focus is.
 */
export function Tooltip({
  content,
  children,
  relationship = "description",
  placement = "block-start",
}: TooltipProps) {
  const generated = useId();
  const tooltipId = `${generated}-tooltip`;

  // Sanitised: React's `:r0:` / `«r0»` is not a valid CSS ident.
  const anchorName = `--rata-tooltip-${generated.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const anchorStyle = { "--rata-tooltip-anchor": anchorName } as CSSProperties;

  const stateRef = useRef<TooltipState>(tooltipInitialState);
  const [view, setView] = useState({ open: false, delayed: false });
  const [mode, setMode] = useState<"manual" | "hint">("manual");
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  // The trigger's DOM node, taken from its own events rather than a ref, so
  // the caller's ref on the child is left exactly as they set it.
  const triggerRef = useRef<HTMLElement | null>(null);

  function send(event: TooltipEvent) {
    const previous = stateRef.current;
    const next = tooltipReducer(previous, event);
    stateRef.current = next;
    const wasOpen = tooltipIsOpen(previous);
    const open = tooltipIsOpen(next);
    // Keyboard focus arriving while a hover's delay is still running cuts the
    // wait short: focus is never a passing pointer.
    const focusArrived = next.focused && !previous.focused;
    setView((prev) => {
      if (!open) return prev.open ? { open: false, delayed: false } : prev;
      const delayed = wasOpen ? prev.delayed && !focusArrived : tooltipOpenIsDelayed(event);
      return prev.open && prev.delayed === delayed ? prev : { open: true, delayed };
    });
  }

  const tooltip = getTooltipProps({ tooltipId, relationship, open: view.open, onEvent: send });

  useEffect(() => {
    trackModality();
    if (supportsHint()) setMode("hint");
  }, []);

  // The popover attribute is the source of truth for whether it is painted,
  // so `view.open` drives it imperatively.
  useEffect(() => {
    const node = tooltipRef.current;
    if (node === null) return;
    const showing = node.matches(":popover-open");
    if (!view.open) {
      if (showing) node.hidePopover();
      return;
    }
    if (showing) return;
    const delay = view.delayed ? hintDelay(node) : 0;
    if (delay <= 0) {
      node.showPopover();
      return;
    }
    const timer = window.setTimeout(() => node.showPopover(), delay);
    return () => window.clearTimeout(timer);
  }, [view]);

  // Escape from anywhere, captured so the hint — the topmost thing — goes
  // first and alone. Only while it is open, so the key is otherwise untouched.
  useEffect(() => {
    if (!view.open) return;
    const onKeyDown = (event: KeyboardEvent) => tooltip.onKeyDown(event);
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
    // `tooltip` is rebuilt every render; only `open` changes what it does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.open]);

  function destinationOf(next: EventTarget | null): TooltipPointerDestination {
    if (!(next instanceof Node)) return "outside";
    if (tooltipRef.current?.contains(next)) return "tooltip";
    if (triggerRef.current?.contains(next)) return "trigger";
    return "outside";
  }

  if (!isValidElement(children)) return children;

  const childProps = children.props as {
    className?: string;
    style?: CSSProperties;
    "aria-labelledby"?: string;
    "aria-describedby"?: string;
    onPointerEnter?: (event: PointerEvent<HTMLElement>) => void;
    onPointerLeave?: (event: PointerEvent<HTMLElement>) => void;
    onFocus?: (event: FocusEvent<HTMLElement>) => void;
    onBlur?: (event: FocusEvent<HTMLElement>) => void;
  };

  const trigger = cloneElement(children as ReactElement<Record<string, unknown>>, {
    "aria-labelledby": tooltip.trigger["aria-labelledby"]
      ? mergeIds(childProps["aria-labelledby"], tooltip.trigger["aria-labelledby"])
      : childProps["aria-labelledby"],
    "aria-describedby": tooltip.trigger["aria-describedby"]
      ? mergeIds(childProps["aria-describedby"], tooltip.trigger["aria-describedby"])
      : childProps["aria-describedby"],
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      triggerRef.current = event.currentTarget;
      childProps.onPointerEnter?.(event);
      send({ type: "pointer-enter", target: "trigger", pointerType: event.pointerType });
    },
    onPointerLeave: (event: PointerEvent<HTMLElement>) => {
      childProps.onPointerLeave?.(event);
      send({ type: "pointer-leave", to: destinationOf(event.relatedTarget) });
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      triggerRef.current = event.currentTarget;
      childProps.onFocus?.(event);
      send({ type: "focus", modality });
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      childProps.onBlur?.(event);
      send({ type: "blur" });
    },
    className: cx("rata-tooltip-trigger", childProps.className),
    // Merged, not replaced: the caller's own style has to survive.
    style: { ...childProps.style, ...anchorStyle },
  });

  return (
    <>
      {trigger}
      <div
        {...tooltip.tooltip}
        ref={tooltipRef}
        popover={mode}
        className={cx("rata-tooltip", placement !== "block-start" && `rata-tooltip--${placement}`)}
        // The same name the trigger declares — a sibling does not inherit it.
        style={anchorStyle}
        onPointerEnter={(event) =>
          send({ type: "pointer-enter", target: "tooltip", pointerType: event.pointerType })
        }
        onPointerLeave={(event) =>
          send({ type: "pointer-leave", to: destinationOf(event.relatedTarget) })
        }
        onToggle={(event) => {
          // The platform closed it — a `hint` popover's light-dismiss or close
          // request, or another hint opening. Without this the next hover
          // would find it "already open" and show nothing.
          if (event.nativeEvent.newState === "closed" && tooltipIsOpen(stateRef.current)) send({ type: "dismiss" });
        }}
      >
        {content}
      </div>
    </>
  );
}
