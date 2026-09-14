/**
 * Headless radio-group behavior.
 *
 * The value lives here, never on an item: a radio's whole meaning is "one of
 * these", and leaving the value on the option would let two of them claim to
 * be checked — a state the control exists to make impossible.
 *
 * Native `input[type="radio"]` sharing one `name` carries the semantics.
 * Grouping, exclusivity and form submission all come from the platform once
 * the name is shared; what this adds is the roving tab stop and the arrow-key
 * selection, and the decision about which option is checked.
 *
 * Nothing here touches the DOM. Where the pattern requires focus to move, this
 * reports which value should receive it and the wrapper does the focusing.
 */
import type { ButtonGroupOrientation } from "./button-group.js";

export interface RadioGroupOptions {
  /** Every option's value, in DOM order. Arrow keys walk this list. */
  values: readonly string[];
  /** The chosen value, or null/undefined for nothing chosen yet. */
  value?: string | null;
  /** Values whose options are unavailable. They stay focusable; activation is guarded. */
  disabledValues?: readonly string[];
  /** Blocks every option at once, while leaving them all reachable. */
  disabled?: boolean;
  orientation?: ButtonGroupOrientation;
  /** Shared form field name. The wrapper supplies a generated one if the caller does not. */
  name: string;
  label?: string;
  labelledBy?: string;
  required?: boolean;
  onValueChange?: (value: string) => void;
  /** Called with the value whose control should take DOM focus. */
  onFocusValue?: (value: string) => void;
}

export interface RadioGroupItemProps {
  type: "radio";
  name: string;
  value: string;
  checked: boolean;
  "aria-disabled": true | undefined;
  tabIndex: number;
  onClick: (event: { preventDefault(): void }) => void;
  onChange: (event: { preventDefault(): void }) => void;
}

export interface RadioGroupProps {
  root: {
    role: "radiogroup";
    "aria-label": string | undefined;
    "aria-labelledby": string | undefined;
    "aria-orientation": ButtonGroupOrientation;
    "aria-required": true | undefined;
    "data-orientation": ButtonGroupOrientation;
    onKeyDown: (event: { key: string; preventDefault(): void }) => void;
  };
  item: (value: string) => RadioGroupItemProps;
}

const PREVIOUS_KEYS = new Set(["ArrowLeft", "ArrowUp"]);
const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);

export function getRadioGroupProps(options: RadioGroupOptions): RadioGroupProps {
  const {
    values,
    value = null,
    disabledValues = [],
    disabled = false,
    orientation = "vertical",
    name,
    label,
    labelledBy,
    required = false,
    onValueChange,
    onFocusValue,
  } = options;

  const unavailable = new Set(disabled ? values : disabledValues);

  // Roving tabindex, derived rather than stored: the checked option is the tab
  // stop, and a group with nothing chosen is entered at its first *enabled*
  // option — entering on a disabled one would strand a keyboard user on a
  // control that cannot answer.
  const rovingValue =
    (value !== null && values.includes(value) ? value : undefined) ??
    values.find((item) => !unavailable.has(item)) ??
    values[0];

  function select(item: string) {
    if (unavailable.has(item)) return;
    if (item === value) return;
    onValueChange?.(item);
  }

  function onKeyDown(event: { key: string; preventDefault(): void }) {
    if (values.length === 0) return;

    const current = rovingValue ?? values[0]!;
    const index = values.indexOf(current);
    let nextIndex: number | null = null;

    // Both axes move regardless of orientation: someone who reaches for Down in
    // a horizontal group should not hit a dead end.
    if (PREVIOUS_KEYS.has(event.key)) nextIndex = (index - 1 + values.length) % values.length;
    else if (NEXT_KEYS.has(event.key)) nextIndex = (index + 1) % values.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = values.length - 1;

    if (nextIndex === null) return;

    event.preventDefault();
    const target = values[nextIndex]!;
    onFocusValue?.(target);
    // Arrow keys select as they move — the radio pattern — but a disabled
    // option only takes focus. It stays reachable so a keyboard user learns it
    // exists; it just never becomes the answer.
    select(target);
  }

  return {
    root: {
      role: "radiogroup",
      "aria-label": labelledBy ? undefined : label || undefined,
      "aria-labelledby": labelledBy || undefined,
      "aria-orientation": orientation,
      "aria-required": required || undefined,
      "data-orientation": orientation,
      onKeyDown,
    },
    item: (item: string) => {
      const itemDisabled = unavailable.has(item);
      const guard = (event: { preventDefault(): void }) => {
        if (itemDisabled) event.preventDefault();
      };
      return {
        type: "radio",
        name,
        value: item,
        checked: item === value,
        "aria-disabled": itemDisabled || undefined,
        tabIndex: item === rovingValue ? 0 : -1,
        onClick: guard,
        onChange: (event) => {
          if (itemDisabled) {
            event.preventDefault();
            return;
          }
          select(item);
        },
      };
    },
  };
}
