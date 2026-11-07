import { useEffect } from "react";
import type { MouseEvent } from "react";
import { Icon } from "@rata/icons";
import type { LucideIcon } from "@rata/icons";
import { cx } from "./cx.js";

/** A count or a dot on a destination's icon, with the words a screen reader hears. */
export interface BottomNavBadge {
  /** The visible number. Omitted, the badge is a dot. Over 99 shows `99+`. */
  count?: number;
  /** The full phrase — "3 unread messages" — appended to the link's name. */
  label: string;
}

/** One destination. */
export interface BottomNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  current?: boolean;
  badge?: BottomNavBadge;
  /** For client-side routing; `href` is still required, so the item is still a link. */
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export interface BottomNavProps {
  /** The destinations, in the order they are read. */
  items: BottomNavItem[];
  /** Accessible name for the navigation landmark. */
  label?: string;
  className?: string;
}

/** `process` is not typed in this package, and is absent outside a bundler. */
const isProduction = () =>
  (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV ===
  "production";

/**
 * Three to five top-level destinations in a bar held to the bottom of the
 * viewport.
 *
 * Navigation, not tabs: each destination is a page with an address, so it is
 * an `<a href>` in a `<nav>`, with `aria-current="page"` on the one the caller
 * says is current. No primitive — links need no keyboard model beyond Tab.
 *
 * Sticky, not fixed: render it as the last child of the page's scrolling
 * column. It never hides on scroll, and it does not decide when it applies —
 * the layout hides it with `display: none` where a rail or TopNav takes over.
 *
 * The count is not enforced by the type, so outside 3–5 it warns in
 * development rather than truncating.
 */
export function BottomNav({ items, label = "Main", className }: BottomNavProps) {
  const count = items.length;
  useEffect(() => {
    if (isProduction() || (count >= 3 && count <= 5)) return;
    console.warn(
      `<BottomNav> has ${count} item(s); it is built for three to five. ` +
        (count < 3
          ? "Two destinations are a SegmentedControl or a link."
          : "Past five, use MobileNav, and do not add a 'More' item.")
    );
  }, [count]);

  return (
    <nav aria-label={label} className={cx("rata-bottom-nav", className)}>
      <ul role="list" className="rata-bottom-nav-list">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              onClick={item.onClick}
              aria-current={item.current ? "page" : undefined}
              className="rata-bottom-nav-item rata-state-layer rata-state-layer--flush"
            >
              <span className="rata-bottom-nav-indicator">
                <Icon icon={item.icon} size="lg" />
                {item.badge && (
                  <span
                    aria-hidden="true"
                    className={cx(
                      "rata-bottom-nav-badge",
                      item.badge.count === undefined
                        ? "rata-bottom-nav-badge--dot"
                        : "rata-bottom-nav-badge--count"
                    )}
                  >
                    {item.badge.count === undefined
                      ? null
                      : item.badge.count > 99
                        ? "99+"
                        : item.badge.count}
                  </span>
                )}
              </span>
              <span className="rata-bottom-nav-label">{item.label}</span>
              {item.badge && <span className="rata-visually-hidden">, {item.badge.label}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
