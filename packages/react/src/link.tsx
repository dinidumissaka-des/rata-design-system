import { forwardRef } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Icon, ExternalLink } from "@rata/icons";
import { cx } from "./cx.js";

export type LinkVariant = "inline" | "standalone";

export interface LinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children"> {
  /** Where the link goes. */
  href: string;
  /** The link text — the name of where it goes. */
  children: ReactNode;
  /** Whether the link sits inside running text or on its own. */
  variant?: LinkVariant;
  /** Opens the link in a new tab, and says so. */
  newTab?: boolean;
  className?: string;
}

/**
 * A navigation to another page or place: an `<a href>`, always.
 *
 * No primitive — the platform already owns a link's keyboard behaviour. A
 * router integrates by intercepting `onClick` and calling `preventDefault`,
 * while `href` stays real so new-tab and copy-link keep working.
 *
 * `inline` is always underlined and has no hover change; `standalone` drops
 * the underline and composes the state layer instead, because it has a box
 * the layer can fill without wrapping across lines.
 *
 * `newTab` sets `target` and `rel` together and announces itself, which is
 * why it is a prop rather than an attribute the caller has to remember.
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, children, variant = "inline", newTab = false, className, ...rest },
  ref
) {
  return (
    <a
      ref={ref}
      {...rest}
      href={href}
      {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : null)}
      className={cx(
        "rata-link",
        `rata-link--${variant}`,
        variant === "standalone" && "rata-state-layer",
        variant === "standalone" && "rata-state-layer--flush",
        className
      )}
    >
      {children}
      {newTab && (
        <>
          <Icon icon={ExternalLink} className="rata-link-new-tab-icon" />
          <span className="rata-visually-hidden"> (opens in new tab)</span>
        </>
      )}
    </a>
  );
});
