import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx.js";

export interface BreadcrumbsItem {
  label: string;
  /** Omitted on the last item, which is the page you are already on. */
  href?: string;
}

export interface BreadcrumbsProps extends Omit<HTMLAttributes<HTMLElement>, "aria-label"> {
  /** The trail in order, root first. The last item is the current page. */
  items: BreadcrumbsItem[];
  /** Accessible name for the navigation landmark. */
  label?: string;
  /** What sits between crumbs. */
  separator?: ReactNode;
}

/**
 * The trail from the site's root to the current page.
 *
 * An `items` array rather than children, so the component can mark the last
 * crumb `aria-current="page"` and render it as text without cloning elements
 * someone else constructed. The trade is that a crumb is a label and a link
 * rather than arbitrary content; if that stops being enough, the API should
 * change rather than the caller working around it.
 *
 * A `<nav>` wrapping an ordered list, because the count and the order are part
 * of what the trail says. Separators are `aria-hidden` punctuation — the list
 * already conveys sequence, and hearing "slash" between every crumb is noise.
 */
export function Breadcrumbs({
  items,
  label = "Breadcrumb",
  separator = "/",
  className,
  ...rest
}: BreadcrumbsProps) {
  return (
    <nav {...rest} aria-label={label} className={cx("rata-breadcrumbs", className)}>
      <ol className="rata-breadcrumbs-list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li className="rata-breadcrumbs-item" key={`${item.label}-${index}`}>
              {/* The last crumb is the page you are on: text with
                  aria-current, never a link back to itself. Its href is
                  dropped if one was passed, which the contract documents. */}
              {isLast || !item.href ? (
                <span
                  className={isLast ? "rata-breadcrumbs-current" : undefined}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <a className="rata-breadcrumbs-link" href={item.href}>
                  {item.label}
                </a>
              )}
              {!isLast && (
                <span className="rata-breadcrumbs-separator" aria-hidden="true">
                  {separator}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
