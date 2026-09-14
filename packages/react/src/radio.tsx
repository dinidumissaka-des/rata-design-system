import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx.js";
import { useRadioGroup } from "./radio-group-context.js";

export interface RadioProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "disabled" | "id" | "checked" | "onChange" | "type" | "name" | "value"
  > {
  /** This option's value. What the group reports when it is chosen. */
  value: string;
  /** The option's label. */
  label: ReactNode;
  /** Helper text under the label. */
  description?: ReactNode;
  /** Blocks this one option while leaving it focusable and readable. */
  disabled?: boolean;
  className?: string;
}

/**
 * One option inside a RadioGroup.
 *
 * It holds no state. The group decides whether this one is checked, whether it
 * is the tab stop, and what happens when it is activated — which is what keeps
 * two siblings from ever both claiming to be the answer.
 *
 * Rendered outside a group it throws rather than degrading. A radio with no
 * name to share and no siblings to exclude looks correct and behaves like
 * nothing, and a component that fails silently in that way is worse than one
 * that says so.
 */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { value, label, description, disabled, className, ...rest },
  ref
) {
  const group = useRadioGroup();
  if (!group) {
    throw new Error(
      "Radio must be rendered inside a RadioGroup: the group owns the shared name, " +
        "the exclusivity and the arrow-key focus that make a radio a radio."
    );
  }

  const generated = useId();
  const id = `${generated}-${value}`;
  const descriptionId = `${id}-description`;
  const hasDescription = description !== undefined && description !== "";
  const item = group.getItemProps(value);

  return (
    <div
      className={cx("rata-radio", className)}
      data-state={item.checked ? "checked" : "unchecked"}
      data-disabled={item["aria-disabled"] ? "" : undefined}
    >
      <span className="rata-radio-control">
        <input
          {...rest}
          {...item}
          id={id}
          aria-describedby={hasDescription ? descriptionId : undefined}
          className="rata-radio-input"
          ref={(node) => {
            group.registerItem(value, node);
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
        />
        {/* Paint only: the input beside it carries every semantic. */}
        <span className="rata-radio-circle" aria-hidden="true">
          <span className="rata-radio-dot" />
        </span>
      </span>

      <span className="rata-radio-text">
        <label className="rata-radio-label" htmlFor={id}>
          {label}
        </label>
        {hasDescription && (
          <span className="rata-radio-description" id={descriptionId}>
            {description}
          </span>
        )}
      </span>
    </div>
  );
});
