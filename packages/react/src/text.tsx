import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx.js";

/**
 * A block of prose, or a run inside one. `div` is deliberately not offered —
 * it is the one that would turn this into a layout wrapper, and a `<div>`
 * holding text is how a type component stops being about type and starts
 * being about boxes.
 */
export type TextElement = "p" | "span";

export type TextRole = "body" | "large" | "supporting" | "label";

export type TextTone = "primary" | "secondary" | "muted";

export interface TextProps
  extends Omit<HTMLAttributes<HTMLElement>, "role"> {
  /** The text. */
  children: ReactNode;
  /** Whether this is a block of text or a run inside one. */
  as?: TextElement;
  /** Which step of the scale this text is set at. */
  role?: TextRole;
  /** Which of the three documented foreground steps it takes. */
  tone?: TextTone;
  className?: string;
}

/**
 * Body and supporting text at a named role from the type scale.
 *
 * Headings are a different component, because a heading enters the document
 * outline and is a navigation target while body text is neither — a difference
 * in semantics rather than in looks, which is this system's test for splitting
 * a component.
 *
 * `tone` is part of this even though the type roles carry no colour. The scale
 * is size, weight and line-height only, so anyone styling text still has to
 * pick a foreground, and picking wrongly is this system's commonest token
 * error. Three named steps onto the three contrast-verified `theme.fg.*`
 * values make the right choice the shortest one to write. It is closed on
 * purpose: a role or status colour on running text reads as a link or an
 * error, and `Notice` is the component that owns a coloured message.
 *
 * Inline code is not a role here. `type.code` exists, but `<code>` is a
 * semantic claim about the content rather than a size, and offering it would
 * mean either rendering the wrong element or writing `as="code" role="code"`,
 * which says the same thing twice.
 */
export function Text({
  children,
  as = "p",
  role = "body",
  tone = "primary",
  className,
  ...rest
}: TextProps) {
  const Tag = as;

  return (
    <Tag
      {...rest}
      className={cx("rata-text", `rata-text--${role}`, `rata-text--${tone}`, className)}
    >
      {children}
    </Tag>
  );
}
