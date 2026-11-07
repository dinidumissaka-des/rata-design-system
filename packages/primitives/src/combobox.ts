/**
 * Headless combobox behavior — the WAI-ARIA APG combobox with a listbox
 * popup, list autocomplete and MANUAL selection.
 *
 * Pure function, no framework hooks and no timers. Nothing here touches the
 * DOM: like `getMenuProps` it reports what should happen next through
 * callbacks, and the wrapper owns the state and the painting. The shape is
 * Menu's minus roving focus, plus `aria-activedescendant`: DOM focus never
 * leaves the input, and the highlight is a value the wrapper draws.
 *
 * BUILT ON POPOVER'S DISMISSAL, not Menu's (decision C6). The popup is an
 * anchored, non-modal surface, and which focus moves close it is
 * `popoverCloseReasonForFocus`'s decision, with the input counted as inside
 * the surface. The one difference from Popover is that focus never moves in.
 *
 * THE VALUE AND THE TEXT ARE TWO THINGS. `inputText` is what the box shows;
 * `value` is an option's value. Typing changes only the text. The value
 * changes on a commit — Enter on a highlighted option, a click, the text
 * being cleared, or (with `allowCustomValue`) unmatched text leaving the
 * field. `resolveComboboxText` is the rule for what leaving the field does.
 */
import { popoverCloseReasonForFocus } from "./popover.js";
import type { PopoverFocusDestination } from "./popover.js";

export interface ComboboxOptionDescriptor {
  value: string;
  /** What the box shows once chosen, and what typing is matched against. */
  label: string;
  /** Stays in the list, reachable by arrow keys and announced, but cannot be chosen. */
  disabled?: boolean;
}

/** How typed text narrows the options. `none` leaves narrowing to a server. */
export type ComboboxFilter = "contains" | "starts-with" | "none";

/**
 * Why the popup is closing.
 *
 *   select    an option was committed
 *   escape    Escape with the popup open
 *   toggle    the toggle button, or Alt+ArrowUp
 *   tab       focus moved to a control outside the field
 *   dismiss   a press somewhere outside the field and its popup
 */
export type ComboboxCloseReason = "select" | "escape" | "toggle" | "tab" | "dismiss";

/** Why the popup is opening: typing, ArrowDown/ArrowUp, or the toggle button. Never focus. */
export type ComboboxOpenReason = "input" | "keyboard" | "toggle";

/** The part of a keyboard event this reads. */
export interface ComboboxKeyEvent {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  preventDefault(): void;
  /** Optional so a caller testing plain keys need not supply it. */
  stopPropagation?(): void;
}

// ── Core: platform-agnostic decisions ────────────────────────────────────

/**
 * The options left after `query` narrows them.
 *
 * Case-insensitive in the page's locale. An empty query narrows nothing, and
 * `none` never narrows — the server already answered for the current text,
 * possibly on fields the reader cannot see.
 */
export function filterComboboxOptions<T extends ComboboxOptionDescriptor>(
  options: readonly T[],
  query: string,
  filter: ComboboxFilter = "contains"
): T[] {
  const needle = query.trim().toLocaleLowerCase();
  if (filter === "none" || needle === "") return [...options];
  return options.filter((option) => {
    const haystack = option.label.toLocaleLowerCase();
    return filter === "starts-with" ? haystack.startsWith(needle) : haystack.includes(needle);
  });
}

/** The enabled option whose label is exactly `text`, ignoring case and outer space. */
export function findComboboxOptionByLabel<T extends ComboboxOptionDescriptor>(
  options: readonly T[],
  text: string
): T | undefined {
  const needle = text.trim().toLocaleLowerCase();
  if (needle === "") return undefined;
  return options.find(
    (option) => option.disabled !== true && option.label.toLocaleLowerCase() === needle
  );
}

export interface ComboboxResolution {
  /** The value the field should hold once the reader has left it. */
  value: string | null;
  /** The text the box should show. */
  text: string;
}

/**
 * What leaving the field does to typed text.
 *
 *   empty text                    clears the value — a deliberate act
 *   text that is an option label  chooses that option
 *   any other text, custom on     becomes the value itself
 *   any other text, custom off    reverts to the chosen option's label, or
 *                                 empties if nothing is chosen
 *
 * The last row is the point: without it, a form submits a stale value under
 * a label the reader overwrote, which looks right and is wrong.
 */
export function resolveComboboxText(input: {
  text: string;
  value: string | null;
  options: readonly ComboboxOptionDescriptor[];
  allowCustomValue?: boolean;
}): ComboboxResolution {
  const { text, value, options, allowCustomValue = false } = input;
  if (text.trim() === "") return { value: null, text: "" };
  const match = findComboboxOptionByLabel(options, text);
  if (match) return { value: match.value, text: match.label };
  if (allowCustomValue) return { value: text, text };
  const chosen = options.find((option) => option.value === value);
  if (chosen) return { value: chosen.value, text: chosen.label };
  // A custom value from before `allowCustomValue` was turned off, or a value
  // whose option is not in the current page of server results: keep it, and
  // keep showing it, rather than silently dropping an answer.
  return value === null ? { value: null, text: "" } : { value, text: value };
}

/** The polite count announcement, in English; `emptyMessage` covers the zero case. */
export function comboboxCountMessage(count: number): string {
  return count === 1 ? "1 result" : `${count} results`;
}

// ── Web: ids, ARIA and handlers ──────────────────────────────────────────

export interface ComboboxOptions {
  /** The input's id. Field binds the label to it, so the caller owns it. */
  id: string;
  /** The listbox's id, pointed at by `aria-controls`. */
  listboxId: string;
  /** The label element's id, which also names the listbox. */
  labelId: string;
  /** Every option, in reading order. */
  options: readonly ComboboxOptionDescriptor[];
  /** The options currently shown — `filterComboboxOptions` of the query. */
  visible: readonly ComboboxOptionDescriptor[];
  open?: boolean;
  inputText?: string;
  /** The value of the highlighted option, or `null` when nothing is highlighted. */
  highlightedValue?: string | null;
  value?: string | null;
  allowCustomValue?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Called with the id an option's element carries, so `aria-activedescendant` can point at it. */
  optionId?: (value: string) => string;
  onOpenChange?: (open: boolean, reason: ComboboxOpenReason | ComboboxCloseReason) => void;
  onHighlightChange?: (value: string | null) => void;
  /** The text changed. `typed` is false when the component itself set it — a commit, a revert. */
  onInputChange?: (text: string, typed: boolean) => void;
  /** A choice was committed. */
  onValueChange?: (value: string | null) => void;
}

export interface ComboboxInputProps {
  id: string;
  role: "combobox";
  "aria-expanded": boolean;
  "aria-controls": string;
  "aria-autocomplete": "list";
  "aria-activedescendant": string | undefined;
  autoComplete: "off";
  value: string;
  onChange: (event: { target: { value: string } }) => void;
  onKeyDown: (event: ComboboxKeyEvent) => void;
}

export interface ComboboxToggleProps {
  type: "button";
  /** Not a tab stop: the keyboard has ArrowDown and Alt+ArrowDown. */
  tabIndex: -1;
  "aria-labelledby": string;
  "aria-expanded": boolean;
  "aria-controls": string;
  "aria-disabled": true | undefined;
  onClick: () => void;
}

export interface ComboboxListboxProps {
  id: string;
  role: "listbox";
  "aria-labelledby": string;
  "aria-busy": true | undefined;
}

export interface ComboboxOptionProps {
  id: string;
  role: "option";
  "aria-selected": boolean;
  "aria-disabled": true | undefined;
  "data-highlighted": "" | undefined;
  onClick: () => void;
}

export interface ComboboxProps {
  input: ComboboxInputProps;
  toggle: ComboboxToggleProps;
  listbox: ComboboxListboxProps;
  option: (value: string) => ComboboxOptionProps;
  /**
   * Report where focus went when it left the input. Closes the popup with
   * reason `tab` when that is outside, and settles the text either way unless
   * it stayed inside. Not a DOM prop: the wrapper maps its own blur first.
   */
  focusMoved: (destination: PopoverFocusDestination) => void;
  /** Report a press outside the field and its popup. Closes with reason `dismiss`. */
  dismissed: () => void;
}

export function getComboboxProps(options: ComboboxOptions): ComboboxProps {
  const {
    id,
    listboxId,
    labelId,
    options: all,
    visible,
    open = false,
    inputText = "",
    highlightedValue = null,
    value = null,
    allowCustomValue = false,
    disabled = false,
    loading = false,
    optionId = (v: string) => `${listboxId}-${v}`,
    onOpenChange,
    onHighlightChange,
    onInputChange,
    onValueChange,
  } = options;

  const values = visible.map((option) => option.value);
  const byValue = new Map(all.map((option) => [option.value, option]));
  const highlighted =
    highlightedValue !== null && values.includes(highlightedValue) ? highlightedValue : null;

  function close(reason: ComboboxCloseReason) {
    if (open) onOpenChange?.(false, reason);
    onHighlightChange?.(null);
  }

  function openAt(target: string | null, reason: ComboboxOpenReason) {
    if (disabled) return;
    if (!open) onOpenChange?.(true, reason);
    onHighlightChange?.(target);
  }

  /** Where the arrows enter the list: the chosen option when it is showing, else an end. */
  function entry(direction: 1 | -1): string | null {
    if (value !== null && values.includes(value)) return value;
    if (values.length === 0) return null;
    return direction === 1 ? values[0]! : values[values.length - 1]!;
  }

  function commit(option: ComboboxOptionDescriptor) {
    if (option.disabled === true) return;
    onInputChange?.(option.label, false);
    onValueChange?.(option.value);
    close("select");
  }

  function settle() {
    const resolved = resolveComboboxText({ text: inputText, value, options: all, allowCustomValue });
    if (resolved.text !== inputText) onInputChange?.(resolved.text, false);
    if (resolved.value !== value) onValueChange?.(resolved.value);
  }

  function move(step: 1 | -1) {
    if (values.length === 0) return;
    if (highlighted === null) {
      onHighlightChange?.(entry(step));
      return;
    }
    const index = values.indexOf(highlighted);
    onHighlightChange?.(values[(index + step + values.length) % values.length]!);
  }

  return {
    input: {
      id,
      role: "combobox",
      "aria-expanded": open,
      "aria-controls": listboxId,
      "aria-autocomplete": "list",
      "aria-activedescendant": open && highlighted !== null ? optionId(highlighted) : undefined,
      // The browser's own autofill list would open over this one.
      autoComplete: "off",
      value: inputText,
      onChange: (event) => {
        // readOnly blocks typing already; this guards a programmatic change.
        if (disabled) return;
        const text = event.target.value;
        onInputChange?.(text, true);
        // Clearing the text is a deliberate act, and it clears the value.
        if (text === "" && value !== null) onValueChange?.(null);
        // Opens on typing — never on focus — with nothing highlighted: the
        // reader is still finding the answer, and manual selection means
        // arrowing is what picks a row to commit.
        openAt(null, "input");
      },
      onKeyDown: (event) => {
        if (event.ctrlKey === true || event.metaKey === true) return;

        if (event.key === "ArrowDown") {
          if (disabled) return;
          // preventDefault, or the caret jumps to the end of the text.
          event.preventDefault();
          if (event.altKey === true) {
            // Alt+ArrowDown opens without moving the highlight, as APG specifies.
            if (!open) openAt(null, "keyboard");
            return;
          }
          if (!open) openAt(entry(1), "keyboard");
          else move(1);
          return;
        }

        if (event.key === "ArrowUp") {
          if (disabled) return;
          event.preventDefault();
          if (event.altKey === true) {
            if (open) close("toggle");
            return;
          }
          if (!open) openAt(entry(-1), "keyboard");
          else move(-1);
          return;
        }

        if (event.key === "Enter") {
          if (open && highlighted !== null) {
            // Prevented only when it did something, so Enter with nothing
            // highlighted still submits the form around the field.
            event.preventDefault();
            const option = byValue.get(highlighted);
            if (option) commit(option);
            return;
          }
          // Nothing highlighted: Enter commits text that is an option's label,
          // or any text when custom values are allowed. It does NOT revert
          // unmatched text — that waits for the reader to leave the field —
          // and it is not prevented, so the form around the field submits.
          if (disabled) return;
          const match = findComboboxOptionByLabel(all, inputText);
          if (match) commit(match);
          else if (allowCustomValue && inputText.trim() !== "") {
            if (inputText !== value) onValueChange?.(inputText);
            close("select");
          }
          return;
        }

        if (event.key === "Escape") {
          // Consumed only when there is something for it to do — the Search
          // rule, so a Dialog around the field still closes on Escape.
          if (open) {
            event.preventDefault();
            event.stopPropagation?.();
            close("escape");
            return;
          }
          if (inputText !== "" && !disabled) {
            event.preventDefault();
            event.stopPropagation?.();
            onInputChange?.("", false);
            if (value !== null) onValueChange?.(null);
          }
        }
      },
    },

    toggle: {
      type: "button",
      tabIndex: -1,
      // The field's own label: the toggle opens the list that label names.
      "aria-labelledby": labelId,
      "aria-expanded": open,
      "aria-controls": listboxId,
      "aria-disabled": disabled || undefined,
      onClick: () => {
        if (disabled) return;
        if (open) close("toggle");
        else openAt(null, "toggle");
      },
    },

    listbox: {
      id: listboxId,
      role: "listbox",
      "aria-labelledby": labelId,
      "aria-busy": loading || undefined,
    },

    option: (optionValue: string) => {
      const option = byValue.get(optionValue);
      return {
        id: optionId(optionValue),
        role: "option",
        "aria-selected": optionValue === value,
        "aria-disabled": option?.disabled === true || undefined,
        "data-highlighted": optionValue === highlighted ? "" : undefined,
        onClick: () => {
          if (option && !disabled) commit(option);
        },
      };
    },

    focusMoved: (destination) => {
      if (destination === "inside") return;
      if (!disabled) settle();
      // Popover's rule, with the input counted as inside the surface.
      const reason = popoverCloseReasonForFocus(destination);
      if (reason !== null) close("tab");
    },

    dismissed: () => {
      if (open) close("dismiss");
    },
  };
}
