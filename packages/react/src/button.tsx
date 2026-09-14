import { forwardRef } from "react";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { getButtonProps } from "@rata/primitives";
import { cx } from "./cx.js";
import { Spinner } from "./spinner.js";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Shows a spinner and blocks activation while preserving focus. */
  loading?: boolean;
  /** Square icon-only button; pass the icon as children and set aria-label. */
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    disabled,
    loading,
    iconOnly,
    className,
    children,
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
      aria-disabled={behavior["aria-disabled"]}
      aria-busy={behavior["aria-busy"]}
      data-loading={behavior["data-loading"]}
      onClick={behavior.onClick as (event: MouseEvent<HTMLButtonElement>) => void}
      className={cx(
        "rata-button",
        "rata-state-layer",
        `rata-button--${variant}`,
        `rata-button--${size}`,
        iconOnly && "rata-icon-button",
        className
      )}
    >
      {loading && <Spinner />}
      {children as ReactNode}
    </button>
  );
});
