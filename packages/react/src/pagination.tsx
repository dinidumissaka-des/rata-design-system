import type { HTMLAttributes, MouseEvent } from "react";
import { getPaginationItems } from "@rata/primitives";
import { Icon, ChevronLeft, ChevronRight } from "@rata/icons";
import { cx } from "./cx.js";

export interface PaginationProps
  extends Omit<HTMLAttributes<HTMLElement>, "aria-label" | "children"> {
  /** The current page, counting from 1. */
  page: number;
  /** How many pages there are. */
  pageCount: number;
  /** Builds the URL for a page. Web only. */
  href?: (page: number) => string;
  /** Called when the reader picks a page. Intercepts the link for a client-side router. */
  onPageChange?: (page: number, event: { preventDefault(): void }) => void;
  /** Accessible name for the navigation landmark. */
  label?: string;
  /** Extra classes, for placement. */
  className?: string;
}

/**
 * Links to the pages of a long, ordered result set.
 *
 * A `<nav>` around a `<ul>` of real links: every page is an `href` built by
 * `href(page)`, so middle-click, copy-link and Back all work, and a router
 * intercepts through `onPageChange` — calling `event.preventDefault()` — the
 * bargain TopNav and SideNav make with `onClick`.
 *
 * The window is fixed by `getPaginationItems`: first, last, current and one
 * either side, with `aria-hidden` ellipses in the gaps. Previous and Next are
 * always present; on the first and last pages they lose their `href`, carry
 * `aria-disabled="true"` and stay in the tab order, so the row keeps its shape
 * and its count wherever the reader is.
 *
 * With a `pageCount` of one or fewer it renders nothing.
 */
export function Pagination({
  page,
  pageCount,
  href,
  onPageChange,
  label = "Pagination",
  className,
  ...rest
}: PaginationProps) {
  const items = getPaginationItems({ page, pageCount });
  if (items.length === 0) return null;

  const linkProps = (target: number) => ({
    href: href?.(target),
    onClick: (event: MouseEvent<HTMLAnchorElement>) => onPageChange?.(target, event),
  });

  return (
    <nav {...rest} aria-label={label} className={cx("rata-pagination", className)}>
      <ul className="rata-pagination-list">
        {items.map((item) => {
          if (item.type === "ellipsis") {
            return (
              <li key={`ellipsis-${item.position}`} aria-hidden="true">
                <span className="rata-pagination-ellipsis">…</span>
              </li>
            );
          }

          if (item.type === "page") {
            return (
              <li key={`page-${item.page}`}>
                <a
                  {...linkProps(item.page)}
                  className="rata-pagination-item rata-state-layer rata-state-layer--flush"
                  aria-label={`Page ${item.page}`}
                  aria-current={item.current ? "page" : undefined}
                >
                  {item.page}
                </a>
              </li>
            );
          }

          const isPrevious = item.type === "previous";
          const name = isPrevious ? "Previous page" : "Next page";
          const glyph = <Icon icon={isPrevious ? ChevronLeft : ChevronRight} />;
          return (
            <li key={item.type}>
              {item.unavailable ? (
                // No href, so it goes nowhere; aria-disabled and tabIndex keep
                // it announced and reachable, the system's rule for an
                // unavailable control.
                <a
                  className="rata-pagination-item rata-state-layer rata-state-layer--flush"
                  aria-label={name}
                  aria-disabled="true"
                  tabIndex={0}
                >
                  {glyph}
                </a>
              ) : (
                <a
                  {...linkProps(item.page)}
                  className="rata-pagination-item rata-state-layer rata-state-layer--flush"
                  aria-label={name}
                >
                  {glyph}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
