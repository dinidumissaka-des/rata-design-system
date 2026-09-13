import { useId, useRef, useState } from "react";
import type { HTMLAttributes } from "react";
import { getDisclosureProps } from "@rata/primitives";
import { Icon, ChevronDown } from "@rata/icons";
import type { LucideIcon } from "@rata/icons";
import { cx } from "./cx.js";

export interface SideNavSubItem {
  label: string;
  href: string;
  /** Whether this is the page you are on. Stated, as at the top level. */
  current?: boolean;
  icon?: LucideIcon;
}

export interface SideNavItem {
  label: string;
  /** Omitted when the item carries `items` — it is then a disclosure, not a link. */
  href?: string;
  /**
   * Whether this is the page you are on. Stated rather than matched from a
   * path, for the reason `TopNav` states it: only the caller knows whether
   * /invoices/123 counts as being on /invoices.
   */
  current?: boolean;
  icon?: LucideIcon;
  /**
   * Pages nested under this one. Present, the item becomes a DISCLOSURE: a
   * button that expands a list in place.
   *
   * Not a menu, for the reason `getDisclosureProps` documents — `role="menu"`
   * announces a keyboard model a list of links does not have. And not a
   * popover either, unlike TopNav's: a rail scrolls vertically, so expanding
   * in place pushes the rest down rather than needing to escape an overflow.
   */
  items?: SideNavSubItem[];
  /**
   * Whether the group starts open.
   *
   * Defaults to open when any child is `current`, which is not a convenience:
   * a reader whose page is inside a collapsed group cannot see where they are.
   */
  defaultExpanded?: boolean;
}

export interface SideNavSection {
  /** Names the group. Omitted for a flat nav — see the component's note. */
  label?: string;
  items: SideNavItem[];
}

export interface SideNavProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** The destinations, grouped. One unlabelled section is a flat nav. */
  sections: SideNavSection[];
  /** Accessible name for the navigation landmark. */
  label?: string;
  className?: string;
}

/**
 * A vertical navigation rail, grouped into named sections.
 *
 * SECTIONS ARE THE ONLY SHAPE, even for a flat list. A side nav exists
 * because there are enough destinations to group; a flat one is the special
 * case. Offering both `items` and `sections` would mean two mutually
 * exclusive props and a rule about which wins — so a flat nav is one
 * unlabelled section, which costs a pair of braces and removes the ambiguity.
 *
 * A SECTION'S LABEL NAMES ITS LIST rather than being a heading. Same reasoning
 * as Notice's title: a nav cannot know what heading level it sits under, and a
 * wrong one breaks heading navigation for the whole page. The label is a plain
 * element with an id and the list points at it with `aria-labelledby`, so the
 * group is announced with its name while the document outline is untouched.
 *
 * Unlike `TopNav` this claims no page-level landmark beyond the nav itself.
 * Where the rail sits, how wide it is, and whether it sticks are the page's
 * decisions, which is also why it draws no background of its own.
 *
 * No primitive: every link is its own tab stop, which is what navigation
 * should be.
 */
export function SideNav({
  sections,
  label = "Sections",
  className,
  ...rest
}: SideNavProps) {
  const base = useId();

  return (
    <nav {...rest} aria-label={label} className={cx("rata-side-nav", className)}>
      {sections.map((section, index) => {
        const labelId = section.label ? `${base}-${index}` : undefined;
        return (
          <div className="rata-side-nav-section" key={section.label ?? `section-${index}`}>
            {section.label && (
              <div className="rata-side-nav-section-label" id={labelId}>
                {section.label}
              </div>
            )}
            {/* Labelled by the element above when there is one, so the group is
                announced with its name — and a plain list when there is not,
                rather than a list pointing at nothing. */}
            <ul className="rata-side-nav-list" aria-labelledby={labelId}>
              {section.items.map((item) => (
                <li key={item.href ?? item.label}>
                  {item.items && item.items.length > 0 ? (
                    <SideNavDisclosure item={item} />
                  ) : (
                    <a
                      className="rata-side-nav-link rata-state-layer rata-state-layer--flush"
                      href={item.href}
                      aria-current={item.current ? "page" : undefined}
                    >
                      {item.icon && <Icon icon={item.icon} />}
                      {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/**
 * A destination with pages nested under it: a disclosure, expanded in place.
 *
 * Expanded in place rather than in a popover, which is the one thing that
 * differs from `TopNav`'s version. A rail scrolls vertically, so a nested list
 * pushes what follows it down and nothing has to escape an overflow — and an
 * inline list keeps the nesting visible, which is most of what a rail is for.
 *
 * It opens by default when any child is the current page. Not a convenience: a
 * reader whose page sits inside a collapsed group cannot see where they are.
 */
function SideNavDisclosure({ item }: { item: SideNavItem }) {
  const base = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(
    item.defaultExpanded ?? (item.items?.some((child) => child.current) ?? false)
  );

  const disclosure = getDisclosureProps({
    triggerId: `${base}-trigger`,
    panelId: `${base}-panel`,
    open,
    onOpenChange: (next, reason) => {
      // Escape hands focus back; the trigger's own click does not need to,
      // since focus is already there.
      if (!next && reason === "escape") triggerRef.current?.focus();
      setOpen(next);
    },
  });

  return (
    <>
      <button
        {...disclosure.trigger}
        ref={triggerRef}
        className="rata-side-nav-link rata-side-nav-trigger rata-state-layer rata-state-layer--flush"
        // The parent of a current page, marked `true` rather than `"page"` —
        // you are not on it, you are inside what it leads to.
        aria-current={item.current ? true : undefined}
      >
        {item.icon && <Icon icon={item.icon} />}
        <span className="rata-side-nav-trigger-label">{item.label}</span>
        {/* Decorative: aria-expanded already says which way it points. */}
        <Icon icon={ChevronDown} className="rata-side-nav-chevron" />
      </button>

      {/* Unmounted when closed rather than hidden: there is nothing to animate
          here, and a hidden list is one more thing that can be reached by a
          find-in-page while claiming to be collapsed. */}
      {open && (
        <ul {...disclosure.panel} className="rata-side-nav-sublist">
          {item.items?.map((child) => (
            <li key={child.href}>
              <a
                className="rata-side-nav-link rata-side-nav-sublink rata-state-layer rata-state-layer--flush"
                href={child.href}
                aria-current={child.current ? "page" : undefined}
              >
                {child.icon && <Icon icon={child.icon} />}
                {child.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
