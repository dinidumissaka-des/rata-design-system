import { useId, useRef, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { getDisclosureProps } from "@rata/primitives";
import { Icon, ChevronDown } from "@rata/icons";
import { cx } from "./cx.js";

/**
 * Levels a disclosure's trigger may be wrapped at. No `1`: a page has one
 * `h1` and it is the page's title, not a section someone can collapse.
 */
export type DisclosureHeadingLevel = 2 | 3 | 4 | 5 | 6;

export interface DisclosureProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "children"> {
  /** The trigger's label — what the button says it will reveal. */
  title: ReactNode;
  /** The content the trigger reveals. */
  children: ReactNode;
  /** Wraps the trigger in a heading at this level, so a stack of these is navigable by heading. */
  headingLevel?: DisclosureHeadingLevel;
  /** Controls the panel from outside, for when something other than the trigger decides. */
  open?: boolean;
  /** The starting state when the component owns it. */
  defaultOpen?: boolean;
  /** Fires when the trigger is pressed or Escape closes the panel. */
  onOpenChange?: (open: boolean) => void;
  /** Marks the disclosure unavailable without removing it from the page. */
  disabled?: boolean;
  className?: string;
}

/**
 * A button that shows and hides a panel of content, expanded in place.
 *
 * Built on `getDisclosureProps`, which `TopNav`, `SideNav` and `MobileNav`
 * already use — this is its standalone consumer. The distinction that
 * primitive documents is the one that matters here: a menu promises a keyboard
 * model (one tab stop, arrow keys, typeahead) that assistive technology
 * announces and users then expect, while a disclosure promises nothing beyond
 * "this button reveals that" and leaves everything inside the panel in the tab
 * order where it was. A panel of commands is a `Menu`; a panel of content is
 * this.
 *
 * Closed means unmounted rather than hidden, following `SideNav`: hidden
 * content is still reachable by find-in-page, so a panel claiming to be
 * collapsed can be scrolled to and read. The cost is that state inside the
 * panel resets on reopen, which is the caller's to lift out.
 *
 * `headingLevel` is what separates the APG's two patterns. Its disclosure
 * pattern is a bare button, right for one "Advanced options" in a form; its
 * accordion pattern wraps each trigger in a heading, which is what lets a
 * reader jump between sections instead of tabbing through them. Same component,
 * two situations — and no default, for the reason `Heading`'s `level` has none.
 */
export function Disclosure({
  title,
  children,
  headingLevel,
  open,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  className,
  ...rest
}: DisclosureProps) {
  const base = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);

  // Controlled the moment `open` is passed, which is also what makes the
  // documented conflict with `defaultOpen` real rather than advisory.
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;

  const disclosure = getDisclosureProps({
    triggerId: `${base}-trigger`,
    panelId: `${base}-panel`,
    open: isOpen,
    disabled,
    onOpenChange: (next, reason) => {
      // Escape hands focus back; the trigger's own click does not need to,
      // since focus never left it — a disclosure does not move focus when it
      // opens, which is the difference between it and a menu.
      if (!next && reason === "escape") triggerRef.current?.focus();
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
  });

  const trigger = (
    <button
      {...disclosure.trigger}
      ref={triggerRef}
      className="rata-disclosure-trigger rata-state-layer"
    >
      <span className="rata-disclosure-label">{title}</span>
      {/* Decorative: aria-expanded already says which way it points. */}
      <Icon icon={ChevronDown} className="rata-disclosure-chevron" />
    </button>
  );

  const HeadingTag = headingLevel ? (`h${headingLevel}` as const) : undefined;

  return (
    <div {...rest} className={cx("rata-disclosure", className)}>
      {HeadingTag ? (
        <HeadingTag className="rata-disclosure-heading">{trigger}</HeadingTag>
      ) : (
        trigger
      )}

      {/* The panel ELEMENT is always here; its CONTENT is not. That split is
          what lets both of this component's promises hold at once. The trigger
          points at this id whether open or shut — the primitive's reasoning is
          that a reference which appears and disappears is one assistive
          technology has to re-read to discover, and a dangling IDREF is simply
          ignored, so the reference was inert exactly half the time. Keeping
          the children out while closed is the other promise: hidden content is
          still reachable by find-in-page, so a panel claiming to be collapsed
          could be scrolled to and read. An empty hidden shell is reachable by
          neither, and resolves. */}
      <div {...disclosure.panel} className="rata-disclosure-panel" hidden={!isOpen}>
        {isOpen && children}
      </div>
    </div>
  );
}
