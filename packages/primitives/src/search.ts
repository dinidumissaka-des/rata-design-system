/**
 * Headless search-field behavior.
 *
 * Pure function, no framework hooks and no timers, so it is trivially testable
 * and portable to a non-React wrapper later. Nothing here touches the DOM:
 * clearing reports that it happened and leaves returning focus to the wrapper,
 * the same division `getMenuProps` uses.
 *
 * A native `input[type="search"]`, which the platform maps to
 * `role="searchbox"`. This is deliberately NOT a mode of `getTextFieldProps`:
 * a search has no validation states, is conventionally unlabelled on screen,
 * carries a clear control, and answers Escape — and a `type` option on the
 * text field would have brought all four along as dead weight for every
 * ordinary input.
 *
 * THE ESCAPE RULE is the reason this is a primitive at all. Clearing on Escape
 * is the convention, and implementing it unconditionally breaks every overlay
 * a search sits inside: the field swallows the key and the Dialog or Menu
 * around it stops closing. So the key is handled only when there is something
 * to clear, and left alone — unprevented, unstopped — when the field is empty.
 */

/** The part of a keyboard event this reads. */
export interface SearchKeyEvent {
  key: string;
  preventDefault(): void;
  /** Optional so a caller testing plain keys need not supply it. */
  stopPropagation?(): void;
}

export interface SearchOptions {
  /** The input's id. The label binds to it, so the caller owns it. */
  id: string;
  /** The current query. */
  value: string;
  /** Blocks editing while keeping the field focusable and announced. */
  disabled?: boolean;
  /** A committed query is in flight. */
  loading?: boolean;
  /** Accessible name for the clear control. */
  clearLabel?: string;
  onValueChange?: (value: string) => void;
  /** Called when the reader commits the query with Enter. */
  onSearch?: (value: string) => void;
  /**
   * Called after the query is cleared, by the control or by Escape.
   *
   * Separate from `onValueChange` — which also fires — because the wrapper has
   * a DOM job to do here that a value change does not imply: the clear control
   * disappears the moment the field empties, so focus has to be put back on
   * the input or it falls to the body.
   */
  onCleared?: () => void;
}

export interface SearchProps {
  root: {
    "data-disabled": "" | undefined;
    "data-loading": "" | undefined;
    /** So the CSS can style the empty state without duplicating the test. */
    "data-empty": "" | undefined;
  };
  input: {
    type: "search";
    id: string;
    value: string;
    "aria-disabled": true | undefined;
    /** Blocks editing without removing the field from the tab order. */
    readOnly: true | undefined;
    /** Says a committed query has not come back. Never says what was found. */
    "aria-busy": true | undefined;
    onChange: (event: { target: { value: string } }) => void;
    onKeyDown: (event: SearchKeyEvent) => void;
  };
  label: { htmlFor: string };
  /**
   * `null` when there is nothing to clear, and the control must then not be
   * rendered at all — not rendered-and-disabled, which would leave a permanent
   * dead stop in the tab order of every empty search box in the product.
   */
  clear:
    | {
        type: "button";
        "aria-label": string;
        onClick: () => void;
      }
    | null;
}

export function getSearchProps(options: SearchOptions): SearchProps {
  const {
    id,
    value,
    disabled = false,
    loading = false,
    clearLabel = "Clear search",
    onValueChange,
    onSearch,
    onCleared,
  } = options;

  const empty = value === "";

  function clear() {
    if (disabled || empty) return;
    onValueChange?.("");
    onCleared?.();
  }

  return {
    root: {
      "data-disabled": disabled ? "" : undefined,
      "data-loading": loading ? "" : undefined,
      "data-empty": empty ? "" : undefined,
    },
    input: {
      type: "search",
      id,
      value,
      "aria-disabled": disabled || undefined,
      readOnly: disabled || undefined,
      "aria-busy": loading || undefined,
      onChange: (event) => {
        if (disabled) return;
        onValueChange?.(event.target.value);
      },
      onKeyDown: (event) => {
        if (disabled) return;

        if (event.key === "Enter") {
          // Prevented only when there is an `onSearch` to run. Without one the
          // field may well be inside a form whose submit IS the search, and
          // swallowing Enter there would break it; with one, letting the
          // default through as well is how the same query gets run twice.
          if (onSearch === undefined) return;
          event.preventDefault();
          onSearch(value);
          return;
        }

        if (event.key === "Escape") {
          // Only when there is something to clear. Empty, the key belongs to
          // whatever is around the field — a Dialog or a Menu that should
          // close — so it is neither prevented nor stopped.
          if (empty) return;
          event.preventDefault();
          // Stopped as well as prevented: an ancestor overlay listens for
          // Escape on the way up, and clearing the field is the whole of what
          // this keypress meant.
          event.stopPropagation?.();
          clear();
        }
      },
    },
    label: { htmlFor: id },
    clear: empty || disabled ? null : { type: "button", "aria-label": clearLabel, onClick: clear },
  };
}
