import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx.js";

/**
 * Which element the card is. Each one is chosen for the role it already
 * carries, so the card adds no ARIA: `li` in a gallery the page renders as a
 * `<ul>`, `article` for an entry that stands on its own, `section` for a
 * titled group of settings named by its heading.
 */
export type CardElement = "div" | "article" | "section" | "li";

/** How the card's edge is drawn: a border, or the resting-card shadow. */
export type CardVariant = "outlined" | "raised";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** The card's content. */
  children: ReactNode;
  /** Which element the card is, because that depends on what is in it. */
  as?: CardElement;
  /** How the card's edge is drawn: a border, or the resting-card shadow. */
  variant?: CardVariant;
  /** An image or preview shown flush with the card's top edge, above the content. */
  media?: ReactNode;
  /** Extra classes, for placement in a grid — not for restyling the card. */
  className?: string;
}

/**
 * A bordered surface holding one self-contained item among several.
 *
 * The card is never the control. There is no `href` and no `onClick`: a
 * whole card wrapped in an `<a>` makes every word in it the link's name, and a
 * `<div onClick>` cannot be reached by keyboard. When the whole card should go
 * somewhere, put an inline `Link` in its heading — the stylesheet finds it,
 * stretches its hit area over the card and draws the card's hover, press and
 * focus from it. A card with no link in its heading is not clickable at all.
 *
 * The state layer is composed unconditionally because the component cannot
 * see inside `children`; card.css keeps it at rest unless a heading link is
 * hovered or pressed, so an unlinked card never tints.
 *
 * `as` defaults to `div`, which claims nothing. No `title` prop and no
 * heading of its own: only the caller knows the outline level. No margin and
 * no width: those belong to the grid the cards sit in.
 */
export function Card({
  as: Tag = "div",
  variant = "outlined",
  media,
  children,
  className,
  ...rest
}: CardProps) {
  return (
    <Tag
      {...rest}
      className={cx(
        "rata-card",
        "rata-state-layer",
        `rata-card--${variant}`,
        media != null && "rata-card--media",
        className
      )}
    >
      {media != null && <div className="rata-card-media">{media}</div>}
      {children}
    </Tag>
  );
}
