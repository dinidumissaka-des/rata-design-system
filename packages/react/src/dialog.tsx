import { useEffect, useId, useRef } from "react";
import type { DialogHTMLAttributes, ReactNode, RefObject } from "react";
import { Icon, X } from "@rata/icons";
import { cx } from "./cx.js";
import { lockScroll, unlockScroll } from "./scroll-lock.js";

export type DialogSize = "sm" | "md" | "lg";

/**
 * Which kind of dialog this is, in ARIA's terms.
 *
 * `alertdialog` is for a dialog whose whole content is a message the reader
 * has to respond to — a destructive confirmation being the canonical case. It
 * is announced more insistently, and a screen reader reads the description
 * with the name rather than waiting to be asked. `dialog` is everything else,
 * and a form or a panel must not claim to be an alert.
 */
export type DialogRole = "dialog" | "alertdialog";

/**
 * Why the dialog is closing.
 *
 * `external` means something other than this component closed it — a
 * `<form method="dialog">` inside it being submitted, which is the documented
 * HTML way to close a dialog, or the platform doing it for its own reasons.
 * It is reported rather than ignored because `open` would otherwise go on
 * saying the dialog is showing while it is not, and the scroll lock would
 * stay on with nothing open.
 */
export type DialogCloseReason = "escape" | "close-button" | "backdrop" | "external";

export interface DialogProps
  extends Omit<
    DialogHTMLAttributes<HTMLDialogElement>,
    // `open` is the dangerous one: as an attribute it renders the dialog
    // NON-modally, with no focus trap and no backdrop, which is the opposite
    // of what this component is for. The rest are the component's own.
    "open" | "title" | "onClose" | "onCancel" | "role" | "children"
  > {
  /**
   * The dialog's name. Required, not optional: a modal with no accessible name
   * is announced as "dialog" and nothing else, and there is no sensible
   * default, so the type refuses it rather than the contract asking nicely.
   */
  title: ReactNode;
  /** The dialog's content. */
  children: ReactNode;
  /** Whether the dialog is showing. Always controlled — `showModal()` has no prop. */
  open: boolean;
  /** Called when the dialog asks to close. Set `open` to false in it. */
  onClose: (reason: DialogCloseReason) => void;
  /** A line under the title, wired as the dialog's description. */
  description?: ReactNode;
  /** The actions. Reads after the body it acts on. */
  footer?: ReactNode;
  size?: DialogSize;
  /**
   * Whether the reader can close it themselves. `false` removes the close
   * button and blocks Escape, so the footer MUST then contain a way out.
   */
  dismissible?: boolean;
  /** Accessible name for the close button. */
  dismissLabel?: string;
  /**
   * ARIA's kind of dialog. `alertdialog` for a message needing a response —
   * a destructive confirmation, a blocking error — and `dialog`, the default,
   * for anything with work in it.
   */
  role?: DialogRole;
  /**
   * What to focus when it opens. Defaults to the platform's choice, which is
   * the first focusable thing inside — usually the close button.
   *
   * React's `autoFocus` does NOT work here, and the reason is worth knowing:
   * React implements it by calling `.focus()` during commit rather than by
   * emitting the HTML attribute, so `showModal()` — which runs afterwards, in
   * an effect — never sees an `[autofocus]` element and applies its own
   * default, undoing it. This prop is applied after `showModal()`, so it wins.
   */
  initialFocus?: RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * A modal dialog.
 *
 * A NATIVE `<dialog>` OPENED WITH `showModal()`, which is the whole design.
 * The browser supplies the things that are hardest to hand-roll and easiest
 * to get subtly wrong: a real focus trap, `inert` on everything behind it,
 * the top layer, `::backdrop`, Escape-to-close, and focus returned to the
 * element that opened it. A hand-written focus trap is the most bug-prone
 * component in any design system, and the platform's is correct by
 * construction — including for the cases hand-rolled ones miss, like a
 * screen reader's own navigation and the browser's find-in-page.
 *
 * WHAT THIS WRAPPER STILL OWNS, because the platform leaves it open:
 *
 * 1. **Driving `open`.** There is no attribute for the modal state — only the
 *    `showModal()` and `close()` methods — so the prop is applied in an
 *    effect. Rendering `<dialog open>` is NOT the same thing: it shows the
 *    dialog non-modally, with no focus trap, no backdrop and no inert page.
 * 2. **Naming.** `aria-labelledby` to the title, `aria-describedby` to the
 *    description.
 * 3. **Intercepting Escape** when `dismissible` is false, through the `cancel`
 *    event.
 * 4. **Backdrop clicks**, which the platform does not treat as dismissal.
 * 5. **Locking the page's scroll**, which `inert` does not do.
 *
 * `title` is required. See the prop for why.
 */
export function Dialog({
  title,
  children,
  open,
  onClose,
  description,
  footer,
  size = "md",
  dismissible = true,
  dismissLabel = "Close",
  initialFocus,
  role = "dialog",
  className,
  ...rest
}: DialogProps) {
  const generated = useId();
  const titleId = `${generated}-title`;
  const descriptionId = `${generated}-description`;
  const ref = useRef<HTMLDialogElement | null>(null);

  const hasDescription = description !== undefined && description !== "";

  // showModal() is what makes it modal — the focus trap, the inert page and
  // the backdrop all come from it. The `open` attribute alone would render a
  // non-modal dialog with none of that, which is the single easiest way to
  // ship a "modal" that is not one.
  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    if (open && !node.open) {
      node.showModal();
      // After showModal, never before: it moves focus to the first focusable
      // descendant on its own, so anything focused earlier is overridden.
      // This is also why React's `autoFocus` cannot work here — see the prop.
      initialFocus?.current?.focus();
    } else if (!open && node.open) {
      node.close();
    }
    // `initialFocus` is deliberately not a dependency: it is read when the
    // dialog opens, and a ref changing identity is not a reason to re-open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // `inert` stops the page behind being interactive but not from scrolling,
  // and a modal that scrolls the page behind it loses the reader's place.
  useEffect(() => {
    if (!open) return;
    lockScroll();
    return unlockScroll;
  }, [open]);

  return (
    <dialog
      {...rest}
      ref={ref}
      className={cx("rata-dialog", `rata-dialog--${size}`, className)}
      // A native <dialog> is already role="dialog"; this only ever narrows it
      // to alertdialog, which the element cannot be by itself.
      role={role}
      aria-labelledby={titleId}
      aria-describedby={hasDescription ? descriptionId : undefined}
      onCancel={(event) => {
        // The platform fires `cancel` for Escape. Prevented, it does not close
        // — which is the only way to make a non-dismissible dialog, and the
        // reason its contract insists the footer contain a way out.
        if (!dismissible) {
          event.preventDefault();
          return;
        }
        // Prevented regardless, so React stays the single source of `open`:
        // letting the platform close it directly would leave the prop saying
        // it is showing while it is not.
        event.preventDefault();
        onClose("escape");
      }}
      onClose={() => {
        // The NATIVE close event, not this component's `onClose` prop. It
        // fires for our own `node.close()` too, which is why this only reports
        // when React still believes the dialog is open: that is the case where
        // something else closed it — `<form method="dialog">` being the
        // documented one — and nothing would otherwise resync. The effect
        // below is keyed on `open`, so it does not re-run to notice, and the
        // scroll lock stayed on the body with no dialog open at all.
        if (open) onClose("external");
      }}
      onClick={(event) => {
        // A click that lands on the <dialog> itself rather than on anything
        // inside it is a click on the backdrop: the element's box is the
        // surface, and the backdrop is painted outside it. The platform does
        // not treat that as dismissal, so this does.
        if (!dismissible || event.target !== event.currentTarget) return;
        onClose("backdrop");
      }}
    >
      <div className="rata-dialog-header">
        <div className="rata-dialog-heading">
          {/* A real heading, unlike Notice's title: a modal is its own context
              — everything behind it is inert — so the outline inside it starts
              fresh and this is the top of it. */}
          <h2 className="rata-dialog-title" id={titleId}>
            {title}
          </h2>
          {hasDescription && (
            <p className="rata-dialog-description" id={descriptionId}>
              {description}
            </p>
          )}
        </div>

        {dismissible && (
          <button
            type="button"
            className="rata-dialog-dismiss rata-state-layer rata-state-layer--flush"
            aria-label={dismissLabel}
            onClick={() => onClose("close-button")}
          >
            <Icon icon={X} />
          </button>
        )}
      </div>

      <div className="rata-dialog-body">{children}</div>

      {footer !== undefined && footer !== null && footer !== false && (
        <div className="rata-dialog-footer">{footer}</div>
      )}
    </dialog>
  );
}
