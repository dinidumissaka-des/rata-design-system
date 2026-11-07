import { cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState } from "react";
import type {
  CSSProperties,
  FocusEvent,
  PointerEvent,
  ReactElement,
  ReactNode,
  RefObject,
} from "react";
import { getPopoverProps, popoverReturnsFocus } from "@rata/primitives";
import type { PopoverCloseReason, PopoverFocusDestination } from "@rata/primitives";
import { cx } from "./cx.js";

export type PopoverPlacement = "block-start" | "block-end" | "inline-start" | "inline-end";

export interface PopoverProps {
  /**
   * The control that opens and closes the popover — a `Button`. Cloned to
   * receive `aria-expanded`, `aria-controls`, its ref and its click handler.
   */
  trigger: ReactElement;
  /** The popover's name, shown at its top. A styled label, not a heading. */
  title: string;
  /** The content: short text, a link, a few fields. */
  children: ReactNode;
  /** Whether the popover is showing. Makes the component controlled. */
  open?: boolean;
  /** Starting state for an uncontrolled popover. Conflicts with `open`. */
  defaultOpen?: boolean;
  /** Called whenever it asks to open or close — trigger, Escape, light-dismiss or Tab out. */
  onOpenChange?: (open: boolean) => void;
  /** Which side of the trigger it prefers. Anchor positioning flips it near an edge. */
  placement?: PopoverPlacement;
  /** Focused on open, when the first focusable element is the wrong place to start. */
  initialFocus?: RefObject<HTMLElement | null>;
}

/** What counts as "the first focusable control" when focus moves in. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(",");

/**
 * A non-modal, titled surface anchored to a trigger.
 *
 * THE SAME MACHINERY AS MENU: `popover="auto"` puts it in the top layer and
 * gives light-dismiss, and CSS anchor positioning places it against the
 * trigger with a per-instance anchor name. See `menu.tsx` for why the name is
 * generated rather than written in the stylesheet.
 *
 * WHAT THIS WRAPPER OWNS, and `getPopoverProps` deliberately does not:
 *
 * 1. **Moving focus in on open** — to `initialFocus`, or the first focusable
 *    control. After `showPopover()`, never before: an element is not
 *    focusable while its popover is `display: none`, which is also why
 *    React's `autoFocus` cannot do this.
 * 2. **Returning focus to the trigger on Escape** — synchronously, while the
 *    popover closes. Not on light-dismiss or Tab out, where the reader chose a
 *    new place.
 * 3. **Mapping a DOM focus-out onto a destination** the primitive decides
 *    about. Focus is not trapped: Tab past the last control leaves and closes.
 */
export function Popover({
  trigger,
  title,
  children,
  open,
  defaultOpen,
  onOpenChange,
  placement = "block-end",
  initialFocus,
}: PopoverProps) {
  const generated = useId();
  const triggerId = `${generated}-trigger`;
  const popoverId = `${generated}-popover`;
  const titleId = `${generated}-title`;

  // Sanitised: React 18's `:r0:` is not a valid CSS ident.
  const anchorName = `--rata-popover-${generated.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const anchorStyle = { "--rata-popover-anchor": anchorName } as CSSProperties;

  const isControlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
  const isOpen = isControlled ? open : uncontrolledOpen;

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  /**
   * Whether the popover was showing when a press on the trigger began.
   *
   * The trigger is outside the popover, so a pointer press on it
   * light-dismisses the popover before the click arrives. Without this the
   * click would then see it closed and open it again — the trigger could
   * never close it by pointer. Not `popovertarget`, which the platform
   * exempts from light-dismiss: that toggles without telling React.
   */
  const pressStartedOpen = useRef(false);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const popover = getPopoverProps({
    triggerId,
    popoverId,
    titleId,
    open: isOpen,
    onOpenChange: (next, reason: PopoverCloseReason) => {
      // Synchronous, before the state change, so focus is home by the time
      // anything reacting to onOpenChange runs.
      if (!next && popoverReturnsFocus(reason)) triggerRef.current?.focus();
      setOpen(next);
    },
  });

  // The popover attribute is the source of truth for whether it is painted,
  // so `open` drives it imperatively — there is no prop for it.
  useEffect(() => {
    const node = popoverRef.current;
    if (node === null) return;
    const showing = node.matches(":popover-open");
    if (isOpen && !showing) {
      node.showPopover();
      const target = initialFocus?.current ?? node.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    } else if (!isOpen && showing) {
      // A close nobody gave a reason for — `open` set false by the caller,
      // after a submit inside it, say. Hiding a popover that holds focus
      // drops focus on the body, so it goes back where the reader came from.
      // Tab and light-dismiss never reach here holding focus: it has moved.
      const hadFocus = node.contains(document.activeElement);
      node.hidePopover();
      if (hadFocus) triggerRef.current?.focus();
    }
    // `initialFocus` is read when the popover opens; a ref changing identity
    // is not a reason to reopen it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function destinationOf(event: FocusEvent<HTMLDivElement>): PopoverFocusDestination {
    const next = event.relatedTarget as Node | null;
    if (next === null) return "nowhere";
    if (event.currentTarget.contains(next)) return "inside";
    if (triggerRef.current?.contains(next)) return "trigger";
    return "outside";
  }

  const triggerProps = trigger.props as {
    className?: string;
    style?: CSSProperties;
    onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  };
  const triggerNode = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
        ...popover.trigger,
        ref: triggerRef,
        onPointerDown: (event: PointerEvent<HTMLElement>) => {
          pressStartedOpen.current = isOpen;
          triggerProps.onPointerDown?.(event);
        },
        onClick: (event: { preventDefault(): void }) => {
          const startedOpen = pressStartedOpen.current;
          pressStartedOpen.current = false;
          // Light-dismiss already closed it during this press; opening it
          // again is the opposite of what pressing an open trigger means.
          if (startedOpen && !isOpen) return;
          popover.trigger.onClick(event);
        },
        className: cx("rata-popover-trigger", triggerProps.className),
        // Merged, not replaced: the caller's own style has to survive.
        style: { ...triggerProps.style, ...anchorStyle },
      })
    : trigger;

  return (
    <>
      {triggerNode}
      <div
        {...popover.popover}
        ref={popoverRef}
        popover="auto"
        className={cx("rata-popover", placement !== "block-end" && `rata-popover--${placement}`)}
        // The same name the trigger declares — a sibling does not inherit it.
        style={anchorStyle}
        onBlur={(event) => popover.focusMoved(destinationOf(event))}
        onToggle={(event) => {
          // The platform closed it — light-dismiss, or its own close request.
          // Without this the trigger would keep claiming aria-expanded.
          const next = event.nativeEvent.newState === "open";
          if (!next && isOpen) popover.dismissed();
        }}
      >
        <p {...popover.title} className="rata-popover-title">
          {title}
        </p>
        {children}
      </div>
    </>
  );
}
