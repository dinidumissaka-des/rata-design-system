import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, MouseEvent, ReactNode } from "react";
import { getDisclosureProps } from "@rata/primitives";
import { Icon, ChevronDown } from "@rata/icons";
import type { LucideIcon } from "@rata/icons";
import { cx } from "./cx.js";

export interface TopNavSubItem {
  label: string;
  href: string;
  /** Whether this is the page you are on. Stated, as at the top level. */
  current?: boolean;
  icon?: LucideIcon;
  /**
   * Intercepts the click, for client-side routing.
   *
   * `preventDefault()` in here and route yourself. The `href` is still
   * required and must still be real: it is what makes the row a link rather
   * than a button wearing one, so middle-click opens a tab, right-click
   * copies an address, and a crawler can follow it. A nav built out of
   * handlers with no addresses behind them loses all three silently.
   */
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export interface TopNavItem {
  label: string;
  /** Omitted when the item carries `items` — it is then a disclosure, not a link. */
  href?: string;
  /**
   * Whether this is the page you are on.
   *
   * Stated rather than matched from a path, because only the caller knows
   * whether /invoices/123 counts as being on /invoices. A `currentHref` prop
   * would have to guess between exact and prefix matching and would be
   * silently wrong for someone either way.
   */
  current?: boolean;
  icon?: LucideIcon;
  /**
   * Sub-destinations. Present, the item becomes a DISCLOSURE rather than a
   * link: a button that shows and hides a list.
   *
   * Not a menu, which is the mistake this shape exists to make hard.
   * `role="menu"` is for application commands and announces a keyboard model —
   * one tab stop, arrow keys, typeahead — that a list of links does not have.
   * The W3C's own menubar-navigation examples are being withdrawn over it. So
   * the panel is a plain list and Tab moves through it as it does anywhere.
   */
  items?: TopNavSubItem[];
  /**
   * Intercepts the click, for client-side routing.
   *
   * `preventDefault()` in here and route yourself. The `href` is still
   * required and must still be real: it is what makes the row a link rather
   * than a button wearing one, so middle-click opens a tab, right-click
   * copies an address, and a crawler can follow it. A nav built out of
   * handlers with no addresses behind them loses all three silently.
   */
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export interface TopNavProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** The primary destinations, in the order they are read. */
  items: TopNavItem[];
  /** Accessible name for the navigation landmark. */
  label?: string;
  /** The product's mark, at the start of the bar. */
  brand?: ReactNode;
  /** Controls at the end of the bar — search, account, notifications. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The page's banner: a brand, the primary navigation, and room for actions.
 *
 * IT RENDERS THE `<header>`, which makes it the banner landmark. A top nav is
 * that bar — brand, navigation and actions together — and pretending otherwise
 * would mean emitting a bare `<nav>` with a logo and an account menu inside
 * it, neither of which is navigation. The consequence is a real constraint
 * rather than a detail: one per page, and not nested inside a `<header>` you
 * already have.
 *
 * Inside it, only the destinations are in the `<nav>`. `brand` and `actions`
 * sit outside that landmark deliberately — a logo is not a destination even
 * when it links home, and an account menu is not one at all. Anything in
 * `items` is announced as part of a list of places and rendered as a link, so
 * an action put there would be announced as a place and navigate nowhere.
 *
 * No primitive: there is no keyboard interaction to own. Each link is its own
 * tab stop, which is what navigation should be — roving tabindex belongs to a
 * menubar, and using it here would promise arrow-key behaviour a nav does not
 * have.
 */
export function TopNav({
  items,
  label = "Main",
  brand,
  actions,
  className,
  ...rest
}: TopNavProps) {
  return (
    <header {...rest} className={cx("rata-top-nav", className)}>
      {brand !== undefined && brand !== null && (
        <div className="rata-top-nav-brand">{brand}</div>
      )}

      {/* Named, because a page with a side nav as well has two navigation
          landmarks and they are indistinguishable in a landmark list
          otherwise. The banner itself is unnamed: a page has one. */}
      <nav className="rata-top-nav-nav" aria-label={label}>
        <ul className="rata-top-nav-list">
          {items.map((item) => (
            <li className="rata-top-nav-item" key={item.href ?? item.label}>
              {item.items && item.items.length > 0 ? (
                <TopNavDisclosure item={item} />
              ) : (
                <a
                  className="rata-top-nav-link rata-state-layer rata-state-layer--flush"
                  href={item.href}
                  onClick={item.onClick}
                  // Both the marker in the CSS and this attribute, so the
                  // current page is never carried by colour alone.
                  aria-current={item.current ? "page" : undefined}
                >
                  {item.icon && <Icon icon={item.icon} />}
                  {item.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {actions !== undefined && actions !== null && (
        <div className="rata-top-nav-actions">{actions}</div>
      )}
    </header>
  );
}

/**
 * One destination that has sub-destinations: a disclosure, not a menu.
 *
 * THE PANEL IS A POPOVER, and not for style. `.rata-top-nav-list` scrolls its
 * overflow so a long nav does not wrap the bar onto two rows — and an
 * overflow container clips its absolutely positioned descendants, so a panel
 * drawn inside the list would be cut off or scroll away with it. The top layer
 * is the only place it can be and still be seen.
 *
 * It stays a child of its `<li>` in the DOM, which is what matters for
 * assistive technology: the accessibility tree follows the document, not the
 * paint order, so these links are still inside the nav landmark.
 *
 * `popover="auto"` also settles "only one open at a time" for free — the
 * platform closes other auto popovers when one opens — and gives light
 * dismiss, so clicking away closes the panel without a listener of ours.
 */
function TopNavDisclosure({ item }: { item: TopNavItem }) {
  const base = useId();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // A per-instance anchor name. `anchor-name` is a global ident and the spec
  // resolves a duplicated one to the last acceptable anchor in tree order, so
  // a name written in the stylesheet would point every panel in the bar at
  // whichever trigger came last. Sanitised because React 18's useId produces
  // `:r0:` and a colon is not valid in an ident.
  const anchorName = `--rata-top-nav-${base.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const anchorStyle = { "--rata-top-nav-anchor": anchorName } as CSSProperties;

  const disclosure = getDisclosureProps({
    triggerId: `${base}-trigger`,
    panelId: `${base}-panel`,
    open,
    onOpenChange: (next, reason) => {
      // Escape hands focus back; a click on the trigger does not need to,
      // since it is already there. Done synchronously, before the panel is
      // hidden, for the reason Menu's restore is: an effect would fire after
      // anything the caller does next.
      if (!next && reason === "escape") triggerRef.current?.focus();
      setOpen(next);
    },
  });

  // The popover attribute is the source of truth for whether the panel is
  // painted, so React's state has to drive it imperatively.
  useEffect(() => {
    const node = panelRef.current;
    if (node === null) return;
    const showing = node.matches(":popover-open");
    if (open && !showing) node.showPopover();
    else if (!open && showing) node.hidePopover();
  }, [open]);

  return (
    <>
      <button
        {...disclosure.trigger}
        ref={triggerRef}
        className="rata-top-nav-link rata-top-nav-trigger rata-state-layer rata-state-layer--flush"
        style={anchorStyle}
        // The parent of a current page is marked too, so the trail is visible
        // with the panel shut. `true`, not `"page"` — you are not on it.
        aria-current={item.current ? true : undefined}
      >
        {item.icon && <Icon icon={item.icon} />}
        {item.label}
        {/* Decorative: aria-expanded on the button already says which way it
            is pointing, and reading the glyph would say it twice. */}
        <Icon icon={ChevronDown} className="rata-top-nav-chevron" />
      </button>

      <div
        {...disclosure.panel}
        ref={panelRef}
        popover="auto"
        className="rata-top-nav-panel"
        style={anchorStyle}
        onToggle={(event) => {
          // The platform closed it — light dismiss, or another auto popover
          // opening. Without this the trigger would keep claiming expanded.
          const next = event.nativeEvent.newState === "open";
          if (next !== open) setOpen(next);
        }}
      >
        <ul className="rata-top-nav-panel-list">
          {item.items?.map((child) => (
            <li key={child.href}>
              <a
                className="rata-top-nav-panel-link rata-state-layer rata-state-layer--flush"
                href={child.href}
                onClick={child.onClick}
                aria-current={child.current ? "page" : undefined}
              >
                {child.icon && <Icon icon={child.icon} />}
                {child.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
