/**
 * Headless checkbox behavior.
 *
 * Pure function (no framework hooks), like every other primitive here. Built
 * on a native `input[type="checkbox"]`: Space to toggle, participation in a
 * form's data, and the checked semantics themselves all come from the platform
 * and are all easy to get subtly wrong by hand. The visual box is a sibling
 * element; the input stays in the DOM and keeps the meaning.
 *
 * Two things this has to solve that a bare styled input does not:
 *
 *   indeterminate  HTML has no `indeterminate` content attribute — only an IDL
 *                  property — so it cannot be written in JSX. This reports the
 *                  value and the wrapper assigns it to the element.
 *   disabled       `readOnly` does nothing on a checkbox, so the text-field
 *                  analogue is unavailable. The guard here is a refused
 *                  activation plus aria-disabled, the same shape the button
 *                  primitive uses, so the control stays focusable and
 *                  announced.
 */

/** What the box is currently showing. `indeterminate` outranks `checked`. */
export type CheckboxState = "checked" | "unchecked" | "indeterminate";

export interface CheckboxOptions {
  /** Stable unique id. The wrapper supplies it (`useId`). */
  id: string;
  checked?: boolean;
  /** A parent standing in for children that disagree. Outranks `checked`. */
  indeterminate?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** True when the caller renders helper text under the label. */
  hasDescription?: boolean;
  /** Ids of further describing elements, appended last. */
  describedBy?: string;
  onCheckedChange?: (checked: boolean, event: { preventDefault(): void }) => void;
}

export interface CheckboxProps {
  root: {
    "data-state": CheckboxState;
    "data-disabled": "" | undefined;
  };
  input: {
    type: "checkbox";
    id: string;
    checked: boolean;
    "aria-describedby": string | undefined;
    "aria-disabled": true | undefined;
    "aria-required": true | undefined;
    onClick: (event: { preventDefault(): void }) => void;
    onChange: (event: { preventDefault(): void }) => void;
  };
  /**
   * Assign to the input as a DOM property — `el.indeterminate = …`. There is no
   * matching HTML attribute, which is the reason this component cannot just be
   * a styled input in JSX.
   */
  indeterminate: boolean;
  label: { htmlFor: string };
  description: { id: string };
}

export function getCheckboxProps(options: CheckboxOptions): CheckboxProps {
  const {
    id,
    checked = false,
    indeterminate = false,
    disabled = false,
    required = false,
    hasDescription = false,
    describedBy,
  } = options;

  const descriptionId = `${id}-description`;
  const described = [hasDescription ? descriptionId : undefined, describedBy].filter(Boolean);

  // A guarded activation, not a native `disabled`: the box stays in the tab
  // order and keeps announcing its state. Both handlers are stopped, because a
  // click and a keyboard activation arrive through different ones.
  const guard = (event: { preventDefault(): void }) => {
    if (disabled) event.preventDefault();
  };

  return {
    root: {
      "data-state": indeterminate ? "indeterminate" : checked ? "checked" : "unchecked",
      "data-disabled": disabled ? "" : undefined,
    },
    input: {
      type: "checkbox",
      id,
      // An indeterminate box is not checked. The DOM property is what makes it
      // *look* and *announce* as mixed; the checked value underneath stays
      // whatever the caller said, so clearing indeterminate reveals it again
      // rather than inventing a value.
      checked,
      "aria-describedby": described.length ? described.join(" ") : undefined,
      "aria-disabled": disabled || undefined,
      "aria-required": required || undefined,
      onClick: guard,
      onChange: (event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        // From indeterminate, the first activation resolves to checked — the
        // platform's own behaviour, and the one users expect from a "select
        // all" box that is partially filled.
        options.onCheckedChange?.(indeterminate ? true : !checked, event);
      },
    },
    indeterminate,
    label: { htmlFor: id },
    description: { id: descriptionId },
  };
}
