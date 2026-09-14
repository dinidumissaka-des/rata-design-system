/**
 * Headless switch behavior.
 *
 * A native `input[type="checkbox"]` carrying `role="switch"`. That is the
 * recommended construction: the platform supplies Space-to-toggle, the checked
 * state and form participation, and the role changes only how it is announced
 * — "Notifications, on" rather than "Notifications, checked".
 *
 * The difference from `checkbox` is not visual, it is what the control means.
 * A checkbox is a value you are *about to submit*; a switch takes effect the
 * moment it moves. That is why there is no indeterminate state here: a setting
 * is on or off, and "partly on" is not a thing a system can be in. A parent
 * summarising children that disagree is a checkbox, not a switch.
 *
 * The difference from `toggle-button` is the same distinction from the other
 * side: a toggle button is an action left engaged (bold, mute, pin) and
 * announces with `aria-pressed`; a switch is a setting and announces with
 * `aria-checked`.
 */

export interface SwitchOptions {
  /** Stable unique id. The wrapper supplies it (`useId`). */
  id: string;
  checked?: boolean;
  disabled?: boolean;
  /** True when the caller renders helper text under the label. */
  hasDescription?: boolean;
  /** Ids of further describing elements, appended last. */
  describedBy?: string;
  onCheckedChange?: (checked: boolean, event: { preventDefault(): void }) => void;
}

export interface SwitchProps {
  root: {
    "data-state": "on" | "off";
    "data-disabled": "" | undefined;
  };
  input: {
    type: "checkbox";
    role: "switch";
    id: string;
    checked: boolean;
    "aria-describedby": string | undefined;
    "aria-disabled": true | undefined;
    onClick: (event: { preventDefault(): void }) => void;
    onChange: (event: { preventDefault(): void }) => void;
  };
  label: { htmlFor: string };
  description: { id: string };
}

export function getSwitchProps(options: SwitchOptions): SwitchProps {
  const { id, checked = false, disabled = false, hasDescription = false, describedBy } = options;

  const descriptionId = `${id}-description`;
  const described = [hasDescription ? descriptionId : undefined, describedBy].filter(Boolean);

  // Guarded activation rather than the native `disabled`, so the switch stays
  // focusable and keeps announcing which way it is set. `readOnly` is no help
  // here — it has no effect on a checkbox — so both handlers are stopped,
  // because a pointer click and a keyboard activation arrive through different
  // ones.
  const guard = (event: { preventDefault(): void }) => {
    if (disabled) event.preventDefault();
  };

  return {
    root: {
      // "on"/"off" rather than "checked"/"unchecked": the CSS is drawing a
      // setting, and the words it selects on should say so.
      "data-state": checked ? "on" : "off",
      "data-disabled": disabled ? "" : undefined,
    },
    input: {
      type: "checkbox",
      // The one attribute that makes this a switch rather than a checkbox.
      // Announced as "on"/"off" instead of "checked"/"unchecked", which is what
      // a setting sounds like.
      role: "switch",
      id,
      checked,
      "aria-describedby": described.length ? described.join(" ") : undefined,
      "aria-disabled": disabled || undefined,
      onClick: guard,
      onChange: (event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        options.onCheckedChange?.(!checked, event);
      },
    },
    label: { htmlFor: id },
    description: { id: descriptionId },
  };
}
