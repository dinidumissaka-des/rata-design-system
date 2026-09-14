/**
 * Headless toggle-button behavior.
 *
 * Pure function (no framework hooks) so it is trivially testable and portable
 * to non-React wrappers later. Composes `getButtonProps` rather than
 * re-implementing activation guarding: a toggle is a button that carries a
 * pressed state, and the moment the two implement the disabled contract
 * separately is the moment they start disagreeing about it.
 *
 * State is not held here. The caller owns `pressed` and gets told what it
 * should become; that keeps this a pure function and keeps a toggle inside a
 * `toggle-button-group` — where the group owns selection — the same primitive
 * as a toggle standing on its own.
 */
import { getButtonProps } from "./button.js";

export interface ToggleButtonOptions {
  /** Current state. Owned by the caller — this function never flips it. */
  pressed?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Called with the state the toggle should move to, not with the one it is in. */
  onPressedChange?: (pressed: boolean, event: { preventDefault(): void }) => void;
}

export interface ToggleButtonProps {
  type: "button";
  "aria-pressed": boolean;
  "aria-disabled": true | undefined;
  "aria-busy": true | undefined;
  "data-loading": "" | undefined;
  onClick: (event: { preventDefault(): void }) => void;
}

export function getToggleButtonProps(options: ToggleButtonOptions = {}): ToggleButtonProps {
  const { pressed = false, disabled, loading, onPressedChange } = options;

  const base = getButtonProps({
    disabled,
    loading,
    onActivate: (event) => onPressedChange?.(!pressed, event),
  });

  return {
    ...base,
    // Always emitted, both true and false — unlike `aria-disabled`, which is
    // absent when it does not apply. A toggle whose `aria-pressed` disappeared
    // in the off state would be announced as an ordinary button exactly when
    // the user most needs to know it is a toggle that is currently off.
    "aria-pressed": pressed,
  };
}
