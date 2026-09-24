import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx.js";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * The visual steps a heading may be set at. The unnumbered `type.heading` role
 * is deliberately absent: it resolves to the same size as `heading-3`, so
 * offering both would be two names for one step and a caller would have to
 * guess whether they differ.
 */
export type HeadingRole =
  | "display-1"
  | "display-2"
  | "display-3"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "heading-4"
  | "heading-5"
  | "heading-6";

export interface HeadingProps
  extends Omit<HTMLAttributes<HTMLHeadingElement>, "role"> {
  /** Where this heading sits in the document outline. */
  level: HeadingLevel;
  /** How large it looks, independent of its level. */
  role?: HeadingRole;
  /** The heading text. */
  children: ReactNode;
  className?: string;
}

/**
 * A heading whose outline level and visual size are stated separately.
 *
 * That separation is the whole reason this component exists. A level is an
 * outline decision — it is how a screen-reader user navigates a page, and
 * skipping one breaks that. A size is a visual decision about emphasis. They
 * are answers to different questions and they disagree constantly, so a
 * component offering only one of them forces the caller to get the other
 * wrong.
 *
 * `level` is required and has no default, for the same reason `Dialog`'s
 * `title` is: there is no level that is right by default, and a component that
 * defaulted to `h2` would produce a page of `h2`s and no `h1` — which is
 * precisely the flat outline this playground already had.
 *
 * `role` defaults to the matching heading step, which is a starting position
 * rather than a coupling: `level={2}` renders `heading-2` because that is
 * right most of the time, and one prop moves it when it isn't.
 *
 * Note that `role` here is the type step, not ARIA's `role` — the DOM
 * attribute is omitted from the props deliberately. A heading's role in the
 * accessibility tree comes from its level and nothing should override it.
 */
export function Heading({ level, role, children, className, ...rest }: HeadingProps) {
  const Tag = `h${level}` as const;
  const step = role ?? (`heading-${level}` as const);

  return (
    <Tag {...rest} className={cx("rata-heading", `rata-heading--${step}`, className)}>
      {children}
    </Tag>
  );
}
