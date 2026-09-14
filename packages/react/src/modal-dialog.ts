import { useEffect, useRef } from "react";
import type { RefObject, SyntheticEvent } from "react";
import { lockScroll, unlockScroll } from "./scroll-lock.js";

/**
 * Why a modal surface is closing.
 *
 * `external` means something other than the component closed it — a
 * `<form method="dialog">` inside it being submitted, which is the documented
 * HTML way to close a dialog, or the platform doing it for its own reasons.
 * It is reported rather than ignored because `open` would otherwise go on
 * saying the surface is showing while it is not, and the scroll lock would
 * stay on with nothing open.
 */
export type ModalCloseReason = "escape" | "close-button" | "backdrop" | "external";

export interface UseModalDialogOptions {
  /** Whether the surface is showing. Drives `showModal()` and `close()`. */
  open: boolean;
  /** Called when the surface asks to close, with why. */
  onClose: (reason: ModalCloseReason) => void;
  /** `false` blocks Escape and backdrop clicks and is expected to hide the close control. */
  dismissible: boolean;
  /** Focused after `showModal()`, which is the only order that works. */
  initialFocus?: RefObject<HTMLElement | null>;
}

export interface UseModalDialogResult {
  ref: RefObject<HTMLDialogElement | null>;
  /** Spread onto the `<dialog>`. Every handler here exists for a bug. */
  handlers: {
    onCancel: (event: SyntheticEvent) => void;
    onClose: () => void;
    onClick: (event: SyntheticEvent) => void;
  };
}

/**
 * The part of a native modal that React still has to own.
 *
 * Every component in this system that takes over the screen is a native
 * `<dialog>` opened with `showModal()`, because the browser supplies what is
 * hardest to hand-roll and easiest to get subtly wrong: a real focus trap,
 * `inert` on everything behind it, the top layer, `::backdrop`,
 * Escape-to-close, and focus returned to whatever opened it.
 *
 * What the platform leaves open is identical for all of them, which is why it
 * lives here rather than being written once per component:
 *
 * 1. **Driving `open`.** There is no attribute for the modal state — only the
 *    methods — so the prop is applied in an effect. Rendering `<dialog open>`
 *    is NOT the same thing: it shows the dialog non-modally, with no focus
 *    trap, no backdrop and no inert page.
 * 2. **Intercepting Escape**, so React stays the single source of `open`.
 * 3. **Backdrop clicks**, which the platform does not treat as dismissal.
 * 4. **Locking the page's scroll**, which `inert` does not do.
 * 5. **Reporting a close nobody here asked for**, which is the subtlest of
 *    them and the one that left a page unable to scroll at all.
 *
 * Extracted when Sheet arrived. A second hand-written copy of this would have
 * drifted on exactly the details that took the longest to get right — and
 * they are the ones whose failure is silent.
 */
export function useModalDialog({
  open,
  onClose,
  dismissible,
  initialFocus,
}: UseModalDialogOptions): UseModalDialogResult {
  const ref = useRef<HTMLDialogElement | null>(null);

  // showModal() is what makes it modal — the focus trap, the inert page and
  // the backdrop all come from it. The `open` attribute alone renders a
  // non-modal dialog with none of that, which is the single easiest way to
  // ship a "modal" that is not one.
  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    if (open && !node.open) {
      node.showModal();
      // After showModal, never before: it moves focus to the first focusable
      // descendant on its own, so anything focused earlier is overridden.
      // This is also why React's `autoFocus` cannot work here — React calls
      // `.focus()` during commit rather than emitting the attribute, so
      // showModal never sees an `[autofocus]` element.
      initialFocus?.current?.focus();
    } else if (!open && node.open) {
      node.close();
    }
    // `initialFocus` is deliberately not a dependency: it is read when the
    // surface opens, and a ref changing identity is not a reason to reopen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // `inert` stops the page behind being interactive but not from scrolling,
  // and a modal that scrolls the page behind it loses the reader's place.
  useEffect(() => {
    if (!open) return;
    lockScroll();
    return unlockScroll;
  }, [open]);

  return {
    ref,
    handlers: {
      onCancel: (event) => {
        // The platform fires `cancel` for Escape. Prevented, it does not
        // close — which is the only way to make a non-dismissible surface,
        // and the reason that contract insists on another way out.
        if (!dismissible) {
          event.preventDefault();
          return;
        }
        // Prevented regardless, so React stays the single source of `open`:
        // letting the platform close it directly would leave the prop saying
        // it is showing while it is not.
        event.preventDefault();
        onClose("escape");
      },
      onClose: () => {
        // The NATIVE close event, not the component's `onClose` prop. It fires
        // for our own `node.close()` too, which is why this only reports when
        // React still believes it is open: that is the case where something
        // else closed it — `<form method="dialog">` being the documented one
        // — and nothing would otherwise resync. The effect above is keyed on
        // `open`, so it does not re-run to notice, and the scroll lock stayed
        // on the body with nothing open at all.
        if (open) onClose("external");
      },
      onClick: (event) => {
        // A click that lands on the <dialog> itself rather than on anything
        // inside it is a click on the backdrop: the element's box is the
        // surface, and the backdrop is painted outside it. The platform does
        // not treat that as dismissal, so this does.
        if (!dismissible || event.target !== event.currentTarget) return;
        onClose("backdrop");
      },
    },
  };
}
