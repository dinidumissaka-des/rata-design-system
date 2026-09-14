import { useState } from "react";
import type { ImgHTMLAttributes } from "react";
import { cx } from "./cx.js";

export type AvatarSize = "sm" | "md" | "lg";

export interface AvatarProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "size"> {
  /** The person or entity's name: both the fallback initials and the accessible name. */
  name: string;
  /** Image URL. Omit, or let it fail, to fall back to initials. */
  src?: string;
  /** Diameter, from the control scale so an avatar lines up with the controls beside it. */
  size?: AvatarSize;
  /** Marks the avatar as redundant to a name already on screen. */
  decorative?: boolean;
  className?: string;
}

/**
 * Initials from a name: first letter of the first and last word, at most two.
 *
 * Deliberately not a general transliteration — it is a fallback, and the full
 * name is what gets announced either way, so the initials never have to carry
 * the identification on their own.
 */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0]![0] ?? "";
  const last = words.length > 1 ? words[words.length - 1]![0] ?? "" : "";
  return (first + last).toUpperCase();
}

/**
 * A person or entity's image, falling back to initials.
 *
 * `name` is required even when `decorative`, because it is doing two jobs: the
 * accessible name, and the initials. A screen reader should never hear "AH" —
 * it hears the name, whether or not the photo loaded.
 *
 * There is nothing to branch on at the call site: omitting `src` and an `src`
 * that 404s land in the same place, because the load failure is handled here.
 */
export function Avatar({
  name,
  src,
  size = "md",
  decorative,
  className,
  ...rest
}: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span
      className={cx("rata-avatar", `rata-avatar--${size}`, className)}
      // Decorative means a name is already on screen beside it, so announcing
      // it again is noise. Standalone, the avatar is the only thing
      // identifying this person and must carry the name.
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? true : undefined}
      title={decorative ? undefined : name}
    >
      {showImage ? (
        <img
          {...rest}
          className="rata-avatar-image"
          src={src}
          // The wrapper carries the name, so the image itself never repeats it.
          alt=""
          onError={() => setFailed(true)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
