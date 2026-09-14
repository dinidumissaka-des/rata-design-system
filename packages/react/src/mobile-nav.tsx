import { useEffect, useId, useRef, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { getDisclosureProps } from "@rata/primitives";
import { Icon, Menu as MenuGlyph, X } from "@rata/icons";
import { cx } from "./cx.js";
import { lockScroll, unlockScroll } from "./scroll-lock.js";
import { SideNav } from "./side-nav.js";
import type { SideNavSection } from "./side-nav.js";

export interface MobileNavProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "title"> {
  /** The destinations, grouped — the same shape SideNav takes. */
  sections: SideNavSection[];
  /** Accessible name for the navigation landmark inside the drawer. */
  label?: string;
  /** The drawer's own name, shown at its top. */
  title?: ReactNode;
  /** Accessible name for the control that opens the drawer. */
  triggerLabel?: string;
  /** Whether the drawer is showing. Makes the component controlled. */
  open?: boolean;
  /** Starting state for an uncontrolled drawer. Conflicts with `open`. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Accessible name for the drawer's close control. */
  closeLabel?: string;
  /** Content pinned below the destinations — an account link, a sign-out. */
  footer?: ReactNode;
  className?: string;
}

/**
 * A navigation drawer behind a trigger, for viewports too narrow for a rail.
 *
 * IT IS MODAL, AND A REAL `<dialog>`. A drawer covering the page is modal
 * whether or not it is called one: the content behind it must not be reachable
 * by Tab, by a screen reader's own navigation, or by scrolling. `showModal()`
 * supplies all three, plus the focus trap that is the most bug-prone thing
 * anyone writes by hand, plus focus returned to the trigger on close. The
 * contract's counter-example is the `<div className="drawer">` version, which
 * leaves a reader tabbing through a page they cannot see.
 *
 * IT RENDERS A `SideNav` rather than reimplementing one. The drawer's content
 * is a rail — sections, nested groups, current-page marking, all of it — and a
 * second copy of that markup would drift from the first on exactly the details
 * that matter: which element carries a group's name, and how the current page
 * is announced.
 *
 * PICKING A DESTINATION CLOSES IT. Under client-side routing nothing else
 * would: the document never unloads, so the drawer stays open over the page
 * you just navigated to. That is the commonest complaint about this pattern,
 * and it is handled here because every caller wants it.
 *
 * IT DOES NOT DECIDE WHEN IT APPLIES. This system has no breakpoint tokens,
 * deliberately — where a rail stops fitting depends on the rail's width and
 * the page around it, which is the page's knowledge. So the trigger hides
 * itself at no width; the caller's own media query does that, the same way
 * `SideNav` takes its width from the page.
 */
export function MobileNav({
  sections,
  label = "Main",
  title = "Menu",
  triggerLabel = "Menu",
  open,
  defaultOpen,
  onOpenChange,
  closeLabel = "Close",
  footer,
  className,
  ...rest
}: MobileNavProps) {
  const base = useId();
  const titleId = `${base}-title`;

  const isControlled = open !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultOpen ?? false);
  const isOpen = isControlled ? open : uncontrolled;

  const drawerRef = useRef<HTMLDialogElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolled(next);
    onOpenChange?.(next);
  };

  const disclosure = getDisclosureProps({
    triggerId: `${base}-trigger`,
    panelId: `${base}-drawer`,
    open: isOpen,
    onOpenChange: (next) => setOpen(next),
  });

  // showModal() is what makes it modal — the focus trap, the inert page and
  // the backdrop all come from it. The `open` attribute alone renders a
  // non-modal dialog with none of that.
  useEffect(() => {
    const node = drawerRef.current;
    if (node === null) return;
    if (isOpen && !node.open) node.showModal();
    else if (!isOpen && node.open) node.close();
  }, [isOpen]);

  // `inert` stops the page behind being interactive but not from scrolling.
  // The counter is shared with Dialog: two counts would fight, and whichever
  // closed first would unlock the page while the other still covered it.
  useEffect(() => {
    if (!isOpen) return;
    lockScroll();
    return unlockScroll;
  }, [isOpen]);

  return (
    <>
      <div {...rest} className={cx("rata-mobile-nav-trigger-wrap", className)}>
        <button
          {...disclosure.trigger}
          ref={triggerRef}
          className="rata-mobile-nav-trigger rata-state-layer rata-state-layer--flush"
          aria-label={triggerLabel}
        >
          <Icon icon={MenuGlyph} size="md" />
        </button>
      </div>

      <dialog
        id={disclosure.panel.id}
        ref={drawerRef}
        className="rata-mobile-nav"
        aria-labelledby={titleId}
        onCancel={(event) => {
          // Prevented so React stays the single source of `open`: letting the
          // platform close it directly would leave the state disagreeing with
          // what is painted.
          event.preventDefault();
          setOpen(false);
        }}
        onClose={() => {
          // A native close — something other than this component. Reported
          // only while React still believes it is open, so our own close()
          // is not mistaken for someone else's. Same guard Dialog uses, and
          // the same bug it exists to prevent: the scroll lock staying on
          // with nothing open.
          if (isOpen) setOpen(false);
        }}
        onClick={(event) => {
          // A click landing on the <dialog> itself rather than inside the
          // drawer is a click on the backdrop.
          if (event.target === event.currentTarget) setOpen(false);
          // And a click on any destination closes it: under client-side
          // routing nothing else would, so the drawer would stay open over
          // the page just navigated to.
          else if ((event.target as HTMLElement).closest("a") !== null) setOpen(false);
        }}
      >
        <div className="rata-mobile-nav-header">
          {/* A paragraph, not a heading: the drawer sits in the page's own
              outline and cannot know what level it is at — the same reasoning
              Notice's title follows, and unlike Dialog, whose modal content
              genuinely starts a fresh outline. */}
          <p className="rata-mobile-nav-title" id={titleId}>
            {title}
          </p>
          <button
            type="button"
            className="rata-mobile-nav-close rata-state-layer rata-state-layer--flush"
            aria-label={closeLabel}
            onClick={() => setOpen(false)}
          >
            <Icon icon={X} />
          </button>
        </div>

        <SideNav className="rata-mobile-nav-sections" label={label} sections={sections} />

        {footer !== undefined && footer !== null && (
          <div className="rata-mobile-nav-footer">{footer}</div>
        )}
      </dialog>
    </>
  );
}
