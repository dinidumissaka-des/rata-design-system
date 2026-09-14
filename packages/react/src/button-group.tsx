import type { HTMLAttributes } from "react";
import { getButtonGroupProps } from "@rata/primitives";
import type { ButtonGroupOrientation } from "@rata/primitives";
import { cx } from "./cx.js";

export type { ButtonGroupOrientation };

export interface ButtonGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, "role"> {
  /** Accessible name for the group. Required unless `labelledBy` names an existing element. */
  label?: string;
  /** Id of an element that already names this group — a heading above it, typically. */
  labelledBy?: string;
  orientation?: ButtonGroupOrientation;
  /** Joins the buttons into one continuous bar, with only the outer corners rounded. */
  attached?: boolean;
}

export function ButtonGroup({
  label,
  labelledBy,
  orientation = "horizontal",
  attached,
  className,
  children,
  ...rest
}: ButtonGroupProps) {
  const group = getButtonGroupProps({ label, labelledBy, orientation });

  return (
    <div
      {...rest}
      {...group}
      className={cx("rata-button-group", attached && "rata-button-group--attached", className)}
    >
      {children}
    </div>
  );
}
