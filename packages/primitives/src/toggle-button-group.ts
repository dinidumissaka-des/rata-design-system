/**
 * Headless toggle-button-group behavior.
 *
 * Pure function (no framework hooks) so it is trivially testable and portable
 * to non-React wrappers later. This is the selection control that
 * `button-group` deliberately is not: it holds a value, and it says so to
 * assistive technology.
 *
 * The selection mode picks the ARIA pattern, because the two modes are
 * genuinely different controls wearing the same clothes:
 *
 *   single    a radiogroup — one answer out of several. One tab stop, arrow
 *             keys move between options and select as they go.
 *   multiple  a group of toggle buttons — independent on/off states. Each
 *             keeps its own tab stop, exactly like every other button in
 *             this system.
 *
 * Nothing here touches the DOM. Where the radio pattern requires focus to
 * move, this reports which value should receive it and lets the wrapper do
 * the focusing.
 */
import type { ButtonGroupOrientation } from "./button-group.js";

export type ToggleButtonGroupSelectionMode = "single" | "multiple";

export interface ToggleButtonGroupOptions {
  /** Every item's value, in DOM order. Order matters: arrow keys walk this list. */
  values: readonly string[];
  /** Current selection: a value in single mode, a list in multiple mode, `null`/`[]` for none. */
  value?: string | readonly string[] | null;
  selectionMode?: ToggleButtonGroupSelectionMode;
  /** Single mode only: whether clicking the selected item clears the selection. */
  deselectable?: boolean;
  /** Values whose controls are unavailable. They stay focusable; activation is guarded. */
  disabledValues?: readonly string[];
  orientation?: ButtonGroupOrientation;
  /** Accessible name for the group. Required unless `labelledBy` names an existing element. */
  label?: string;
  labelledBy?: string;
  onValueChange?: (value: string | string[] | null) => void;
  /** Called with the value whose control should take DOM focus — the wrapper owns focusing. */
  onFocusValue?: (value: string) => void;
}

export interface ToggleButtonGroupItemProps {
  role: "radio" | undefined;
  "aria-checked": boolean | undefined;
  "aria-pressed": boolean | undefined;
  "aria-disabled": true | undefined;
  tabIndex: number;
  onClick: (event: { preventDefault(): void }) => void;
}

export interface ToggleButtonGroupProps {
  root: {
    role: "radiogroup" | "group";
    "aria-label": string | undefined;
    "aria-labelledby": string | undefined;
    "aria-orientation": ButtonGroupOrientation | undefined;
    "data-orientation": ButtonGroupOrientation;
    onKeyDown: (event: { key: string; preventDefault(): void }) => void;
  };
  item: (value: string) => ToggleButtonGroupItemProps;
}

const PREVIOUS_KEYS = new Set(["ArrowLeft", "ArrowUp"]);
const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);

function asArray(value: ToggleButtonGroupOptions["value"]): string[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? [...value] : [value as string];
}

export function getToggleButtonGroupProps(
  options: ToggleButtonGroupOptions
): ToggleButtonGroupProps {
  const {
    values,
    value,
    selectionMode = "single",
    deselectable = false,
    disabledValues = [],
    orientation = "horizontal",
    label,
    labelledBy,
    onValueChange,
    onFocusValue,
  } = options;

  const single = selectionMode === "single";
  const selected = new Set(asArray(value));
  const disabled = new Set(disabledValues);

  // Roving tabindex, derived rather than stored: in a radio group the selected
  // option is the tab stop, and a group with nothing selected is entered at its
  // first option. Keeping this a derivation means focus can never disagree with
  // the value — there is no second piece of state to fall out of step.
  const rovingValue = single ? values.find((item) => selected.has(item)) ?? values[0] : undefined;

  function select(item: string) {
    if (disabled.has(item)) return;

    if (single) {
      const next = deselectable && selected.has(item) ? null : item;
      onValueChange?.(next);
      return;
    }

    // Rebuilt from `values` rather than appended to, so the reported selection
    // is always in DOM order — the order the user sees, not the order they
    // happened to click in.
    const next = values.filter((candidate) =>
      candidate === item ? !selected.has(candidate) : selected.has(candidate)
    );
    onValueChange?.([...next]);
  }

  function onKeyDown(event: { key: string; preventDefault(): void }) {
    // Multiple mode is a plain group of buttons: each is its own tab stop and
    // Tab is how you move. Hijacking the arrow keys there would take away the
    // caret movement people expect inside a toolbar's surrounding content.
    if (!single || values.length === 0) return;

    const current = rovingValue ?? values[0]!;
    const index = values.indexOf(current);
    let nextIndex: number | null = null;

    if (PREVIOUS_KEYS.has(event.key)) nextIndex = (index - 1 + values.length) % values.length;
    else if (NEXT_KEYS.has(event.key)) nextIndex = (index + 1) % values.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = values.length - 1;

    if (nextIndex === null) return;

    event.preventDefault();
    const target = values[nextIndex]!;
    onFocusValue?.(target);
    // Arrow keys select as they move — the radio pattern — but a disabled
    // option can still be *reached*, because this system's disabled controls
    // stay focusable and announced. So focus moves and selection does not.
    if (!disabled.has(target)) select(target);
  }

  return {
    root: {
      role: single ? "radiogroup" : "group",
      "aria-label": labelledBy ? undefined : label || undefined,
      "aria-labelledby": labelledBy || undefined,
      // Announced only where it is a promise the component keeps: single mode
      // implements arrow-key navigation, multiple mode deliberately does not.
      "aria-orientation": single ? orientation : undefined,
      "data-orientation": orientation,
      onKeyDown,
    },
    item: (item: string) => ({
      role: single ? "radio" : undefined,
      "aria-checked": single ? selected.has(item) : undefined,
      "aria-pressed": single ? undefined : selected.has(item),
      "aria-disabled": disabled.has(item) || undefined,
      tabIndex: single ? (item === rovingValue ? 0 : -1) : 0,
      onClick: (event) => {
        if (disabled.has(item)) {
          event.preventDefault();
          return;
        }
        select(item);
      },
    }),
  };
}
