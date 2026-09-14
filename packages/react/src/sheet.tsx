import { useId } from "react";
import type { DialogHTMLAttributes, ReactNode, RefObject } from "react";
import { Icon, X } from "@rata/icons";
import { cx } from "./cx.js";
import { useModalDialog } from "./modal-dialog.js";
import type { ModalCloseReason } from "./modal-dialog.js";

/**
 * Which edge the sheet is anchored to and slides in from.
 *
 * Logical, not physical: `inline-start` is the left in a left-to-right
 * document and the right in a right-to-left one, so a drawer follows the
 * reading direction without the caller doing anything about it.
 */
export type SheetEdge = "block-start" | "block-end" | "inline-start" | "inline-end";

/**
 * How far the sheet comes in, on whichever axis it slides along.
 *
 * One prop rather than two, because a bottom sheet's size is its height and a
 * drawer's is its width — the same question asked about different axes. Two
 * props would let a caller state the one that does not apply, which the type
 * system cannot catch and which would silently do nothing.
 */
export type SheetSize = "sm" | "md" | "lg";

/**
 * Why the sheet is closing. Shared with every other native-modal surface in
 * this system — see `ModalCloseReason`, which this is an alias of, for what
 * each reason means and why `external` has to be reported at all.
 */
export type SheetCloseReason = ModalCloseReason;

export interface SheetProps
  extends Omit<
    DialogHTMLAttributes<HTMLDialogElement>,
    // `open` is the dangerous one: as an attribute it renders the dialog
    // NON-modally, with no focus trap and no backdrop, which is the opposite
    // of what this component is for. The rest are the component's own.
    "open" | "title" | "onClose" | "onCancel" | "children"
  > {
  /**
   * The sheet's name. Required, not optional: a modal with no accessible name
   * is announced as "dialog" and nothing else, and there is no sensible
   * default, so the type refuses it rather than the contract asking nicely.
   */
  title: ReactNode;
  /** The sheet's content. */
  children: ReactNode;
  /** Whether the sheet is showing. Always controlled — `showModal()` has no prop. */
  open: boolean;
  /** Called when the sheet asks to close. Set `open` to false in it. */
  onClose: (reason: SheetCloseReason) => void;
  /** Which edge it is held against. `block-end` is the bottom sheet. */
  edge?: SheetEdge;
  /** How far it comes in, measured on the axis it slides along. */
  size?: SheetSize;
  /** A line under the title, wired as the sheet's description. */
  description?: ReactNode;
  /** The actions. Reads after the body they act on. */
  footer?: ReactNode;
  /**
   * Whether the reader can close it themselves. `false` removes the close
   * button and blocks both Escape and the backdrop, so the footer MUST then
   * contain a way out.
   */
  dismissible?: boolean;
  /** Accessible name for the close button. */
  dismissLabel?: string;
  /**
   * What to focus when it opens. Defaults to the platform's choice, which is
   * the first focusable thing inside — usually the close button.
   *
   * React's `autoFocus` does NOT work here: React implements it by calling
   * `.focus()` during commit rather than by emitting the HTML attribute, so
   * `showModal()` — which runs afterwards, in an effect — never sees an
   * `[autofocus]` element and applies its own default, undoing it. This prop
   * is applied after `showModal()`, so it wins.
   */
  initialFocus?: RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * A modal surface held against one edge of the viewport — a bottom sheet, or
 * a side drawer.
 *
 * A NATIVE `<dialog>` OPENED WITH `showModal()`, for the same reasons Dialog
 * is one, and sharing the same `useModalDialog` hook rather than a second
 * copy of it. The browser supplies the focus trap, `inert` on the page
 * behind, the top layer, `::backdrop`, Escape and focus returned to the
 * opener.
 *
 * IT IS MODAL, AND THERE IS NO OPTION FOR IT NOT TO BE. MobileNav's contract
 * states the rule this follows: a surface covering the page is modal whether
 * or not it is called one, because the content behind it must not be
 * reachable by Tab, by a screen reader's own navigation, or by scrolling. A
 * panel that genuinely should not be modal belongs in the layout, which is
 * what `Panel` is for.
 *
 * ONE COMPONENT FOR FOUR EDGES, rather than BottomSheet and Drawer as
 * separate components. Everything that makes this hard — the top layer, the
 * focus trap, the counted scroll lock, the exit that has to keep the layer
 * alive — is identical whichever edge it is held against. What differs is the
 * axis it slides along and which two corners are rounded, and that is
 * geometry rather than behaviour. Note that this is the opposite of the Tabs
 * and SegmentedControl split, which was made because their SEMANTICS differ
 * rather than their looks.
 *
 * No drag to dismiss in this version, and no grab handle drawn either: an
 * affordance that does nothing is worse than none. A drag is a pointer state
 * machine with a velocity threshold, a scroll-versus-drag conflict inside the
 * body, and no keyboard equivalent, so it needs its own pass rather than
 * riding along with the geometry.
 */
export function Sheet({
  title,
  children,
  open,
  onClose,
  edge = "block-end",
  size = "md",
  description,
  footer,
  dismissible = true,
  dismissLabel = "Close",
  initialFocus,
  className,
  ...rest
}: SheetProps) {
  const generated = useId();
  const titleId = `${generated}-title`;
  const descriptionId = `${generated}-description`;

  const hasDescription = description !== undefined && description !== "";

  // Every hard part of being a native modal — showModal, the scroll lock, the
  // Escape interception, the backdrop click, and reporting a close nobody
  // here asked for — is shared with Dialog rather than written twice.
  const { ref, handlers } = useModalDialog({ open, onClose, dismissible, initialFocus });

  return (
    <dialog
      {...rest}
      ref={ref}
      className={cx("rata-sheet", `rata-sheet--${edge}`, `rata-sheet--${size}`, className)}
      aria-labelledby={titleId}
      aria-describedby={hasDescription ? descriptionId : undefined}
      {...handlers}
    >
      <div className="rata-sheet-header">
        <div className="rata-sheet-heading">
          {/* A real heading: everything behind a modal is inert, so the
              outline inside it starts fresh and this is the top of it. */}
          <h2 className="rata-sheet-title" id={titleId}>
            {title}
          </h2>
          {hasDescription && (
            <p className="rata-sheet-description" id={descriptionId}>
              {description}
            </p>
          )}
        </div>

        {dismissible && (
          <button
            type="button"
            className="rata-sheet-dismiss rata-state-layer rata-state-layer--flush"
            aria-label={dismissLabel}
            onClick={() => onClose("close-button")}
          >
            <Icon icon={X} />
          </button>
        )}
      </div>

      <div className="rata-sheet-body">{children}</div>

      {footer !== undefined && footer !== null && footer !== false && (
        <div className="rata-sheet-footer">{footer}</div>
      )}
    </dialog>
  );
}
