/**
 * Headless PIN INPUT behavior — one text input, drawn as a row of boxes.
 *
 * There is no WAI-ARIA pattern for a segmented code, so this is a labelled
 * textbox with `maxLength`, `inputmode` and `autocomplete`, which is what it
 * is. One input, never one per box: SMS autofill, paste, Backspace and the
 * screen-reader announcement all come from the platform because there is only
 * one control. The boxes are an `aria-hidden` rendering of its value, and
 * their states are derived here from the value and the selection so they
 * cannot disagree with the input.
 *
 * Pure function, no framework hooks and no DOM access: the wrapper passes the
 * selection in and gets prop bags back.
 *
 * Disabled follows the system rule: `aria-disabled` and `readOnly` come from
 * Field, and this refuses every edit. The value still submits.
 */

export type PinInputCharacters = "numeric" | "alphanumeric";
export type PinInputPurpose = "one-time-code" | "pin";

/** The part of a paste event this reads. */
export interface PinInputPasteEvent {
  preventDefault(): void;
  clipboardData: { getData(format: string): string } | null;
  currentTarget: { selectionStart: number | null; selectionEnd: number | null };
}

export interface PinInputOptions {
  /** The field's id. The length description's id is derived from it. */
  id: string;
  value: string;
  length: number;
  characters?: PinInputCharacters;
  purpose?: PinInputPurpose;
  disabled?: boolean;
  /** Whether the input has focus — the active box is drawn only then. */
  focused?: boolean;
  /** The caret, as the input reports it. `null` puts it at the end of the value. */
  selectionStart?: number | null;
  onValueChange?: (value: string) => void;
  /** Fires once each time the code becomes `length` characters long. */
  onComplete?: (value: string) => void;
}

export type PinInputBoxState = "filled" | "active" | "empty";

export interface PinInputBox {
  state: PinInputBoxState;
  /** The character to draw, or `null` when the box is empty or masked. */
  char: string | null;
  /** A `pin` box holding a character draws a dot instead of it. */
  masked: boolean;
  /** The caret sits in this box: active and empty. */
  caret: boolean;
}

export interface PinInputProps {
  input: {
    type: "text" | "password";
    inputMode: "numeric" | "text";
    autoComplete: "one-time-code" | "off";
    maxLength: number;
    value: string;
    autoCapitalize: "characters" | "off";
    autoCorrect: "off";
    spellCheck: false;
    onChange: (event: { target: { value: string } }) => void;
    onPaste: (event: PinInputPasteEvent) => void;
  };
  /** Joins the description chain ahead of any helper text: "6 characters". */
  lengthDescription: { id: string; text: string };
  boxes: PinInputBox[];
}

/** Drops what is outside the set, uppercases letters, and caps at `length`. */
export function filterCode(text: string, characters: PinInputCharacters, length: number): string {
  const kept =
    characters === "numeric"
      ? text.replace(/[^0-9]/g, "")
      : text.replace(/[^0-9a-z]/gi, "").toUpperCase();
  return kept.slice(0, Math.max(0, length));
}

export function getPinInputProps(options: PinInputOptions): PinInputProps {
  const {
    id,
    value,
    length,
    characters = "numeric",
    purpose = "one-time-code",
    disabled = false,
    focused = false,
    selectionStart = null,
    onValueChange,
    onComplete,
  } = options;

  const commit = (next: string) => {
    if (disabled || next === value) return;
    onValueChange?.(next);
    // Once per fill: the code has to change to become complete again, so a
    // re-render of a full field never re-fires it.
    if (next.length === length) onComplete?.(next);
  };

  // The caret's box: where the next character lands, which is never past the
  // last box even when the code is full.
  const caretIndex = Math.min(
    selectionStart === null ? value.length : Math.min(selectionStart, value.length),
    Math.max(0, length - 1)
  );

  const boxes: PinInputBox[] = Array.from({ length: Math.max(0, length) }, (_, i) => {
    const char = value[i] ?? null;
    const active = focused && i === caretIndex;
    return {
      state: active ? "active" : char !== null ? "filled" : "empty",
      char: purpose === "pin" ? null : char,
      masked: purpose === "pin" && char !== null,
      caret: active && char === null,
    };
  });

  return {
    input: {
      type: purpose === "pin" ? "password" : "text",
      inputMode: characters === "numeric" ? "numeric" : "text",
      // A PIN is a secret, so the OS must never suggest one from the last SMS.
      autoComplete: purpose === "pin" ? "off" : "one-time-code",
      maxLength: length,
      value,
      autoCapitalize: characters === "alphanumeric" ? "characters" : "off",
      autoCorrect: "off",
      spellCheck: false,
      onChange: (event) => commit(filterCode(event.target.value, characters, length)),
      onPaste: (event) => {
        // Handled here rather than left to the platform: `maxLength` truncates
        // a paste BEFORE anything can filter it, so "123-456" would arrive as
        // "123-45" and lose a digit to the hyphen.
        event.preventDefault();
        if (disabled) return;
        const pasted = event.clipboardData?.getData("text") ?? "";
        const start = event.currentTarget.selectionStart ?? value.length;
        const end = event.currentTarget.selectionEnd ?? start;
        commit(filterCode(value.slice(0, start) + pasted + value.slice(end), characters, length));
      },
    },
    lengthDescription: {
      id: `${id}-length`,
      text: `${length} ${length === 1 ? "character" : "characters"}`,
    },
    boxes,
  };
}
