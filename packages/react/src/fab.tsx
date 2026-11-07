import { forwardRef } from "react";
import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { getButtonProps } from "@rata/primitives";
import { Icon } from "@rata/icons";
import type { LucideIcon } from "@rata/icons";
import { cx } from "./cx.js";
import { Spinner } from "./spinner.js";

export type FabPlacement = "end" | "center";

export interface FabProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled" | "children"> {
  /** What the action does, as a verb phrase — shown beside the icon, or used as the accessible name when hidden. */
  label: string;
  /** The glyph, which is always shown. */
  icon: LucideIcon;
  /** Shows the icon alone, as a circle, with `label` as the accessible name. */
  labelHidden?: boolean;
  /** Which bottom corner it floats at — inline-end, or centred. */
  placement?: FabPlacement;
  /** Shows a Spinner in place of the icon and blocks activation, while staying focusable. */
  loading?: boolean;
  /** Blocks activation while keeping it focusable and announced. */
  disabled?: boolean;
  className?: string;
}

/**
 * The one primary action of a screen, floating at its bottom inline-end corner.
 *
 * A `<button type="button">` with Button's activation: it composes
 * `getButtonProps`, so `loading` and `disabled` are aria-disabled exactly as
 * they are on Button — focusable, announced, and guarded in the primitive.
 * What it adds is geometry: fixed to the safe area, lifted clear of a
 * BottomNav by fab.css, never hidden or shrunk on scroll.
 *
 * Fixed positioning moves the paint, not the tab order, so render it before
 * the content it acts on. A speed dial is `<Menu trigger={<Fab … />}>`, which
 * is why the ref and the trigger's props are forwarded.
 */
export const Fab = forwardRef<HTMLButtonElement, FabProps>(function Fab(
  {
    label,
    icon,
    labelHidden = false,
    placement = "end",
    loading,
    disabled,
    className,
    onClick,
    type,
    ...rest
  },
  ref
) {
  const behavior = getButtonProps({
    disabled,
    loading,
    onActivate: onClick as ((event: { preventDefault(): void }) => void) | undefined,
  });

  return (
    <button
      ref={ref}
      {...rest}
      type={type ?? behavior.type}
      // Visible text is the name when it is shown; only a hidden label needs
      // to become an attribute.
      aria-label={labelHidden ? label : undefined}
      aria-disabled={behavior["aria-disabled"]}
      aria-busy={behavior["aria-busy"]}
      data-loading={behavior["data-loading"]}
      onClick={behavior.onClick as (event: MouseEvent<HTMLButtonElement>) => void}
      className={cx(
        "rata-fab",
        "rata-state-layer",
        "rata-state-layer--flush",
        labelHidden && "rata-fab--label-hidden",
        placement === "center" && "rata-fab--center",
        className
      )}
    >
      {/* In place of the icon, not beside it, so the FAB keeps its size. */}
      {loading ? <Spinner /> : <Icon icon={icon} size="lg" />}
      {!labelHidden && <span className="rata-fab-label">{label}</span>}
    </button>
  );
});
