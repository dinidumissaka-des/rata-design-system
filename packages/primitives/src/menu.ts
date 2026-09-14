/**
 * Headless menu behavior — a transient list of actions anchored to a trigger.
 *
 * Pure function, no framework hooks and no timers, so it is trivially testable
 * and portable to a non-React wrapper later. Nothing here touches the DOM:
 * where the pattern requires focus to move, this reports which value should
 * receive it and lets the wrapper do the focusing, exactly as
 * `getToggleButtonGroupProps` does.
 *
 * WHY A DESCRIPTOR LIST rather than the parallel `values` / `disabledValues`
 * arrays the toggle group takes: a menu needs three facts per item — its
 * value, the text typeahead matches on, and whether it is unavailable — and
 * three arrays that must stay the same length is a shape that invites the bug
 * where they do not.
 *
 * TYPEAHEAD IS SINGLE-CHARACTER CYCLING, not a buffered prefix search. A
 * buffer has to be cleared after a pause, which means a timer, which means
 * state — and this function has neither. Pressing `d` repeatedly walks the
 * items starting with `d`, which is the behaviour people actually use
 * typeahead for; typing `de` to reach "Delete" past "Duplicate" is the part
 * that is missing, and it is documented as a gap rather than faked.
 */

export interface MenuItemDescriptor {
  value: string;
  /** Text typeahead matches on. Omit and typeahead skips this item. */
  text?: string;
  /** Unavailable, but still focusable and announced — activation is guarded. */
  disabled?: boolean;
  /**
   * Whether this row is the current answer, for a menu standing in for a
   * choice. Its presence — true OR false — is what makes the row checkable,
   * and it changes the row's ROLE, not just an attribute: ARIA does not
   * support `aria-checked` on `menuitem`, only on `menuitemradio` and
   * `menuitemcheckbox`. Setting it on a plain menuitem is invalid, and a
   * screen reader is free to ignore it — which would leave the selected row
   * distinguished by colour alone.
   */
  selected?: boolean;
}

/**
 * The part of a keyboard event this reads.
 *
 * The modifier flags are here for typeahead: without them a single printable
 * `key` is indistinguishable from a shortcut, so Ctrl+D in an open menu jumped
 * to "Duplicate" and swallowed the browser's own binding. Optional, so a
 * caller testing plain keys need not state them.
 */
export interface MenuKeyEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  preventDefault(): void;
}

/** Why the menu is closing. The wrapper uses it to decide about focus. */
export type MenuCloseReason = "trigger" | "select" | "escape" | "tab";

export interface MenuOptions {
  /** Items in DOM order. Order matters: the arrow keys walk this list. */
  items: readonly MenuItemDescriptor[];
  open?: boolean;
  /** Which item currently holds focus inside the open menu. */
  focusedValue?: string | null;
  /** Ids, so the trigger and the menu can point at each other. */
  triggerId: string;
  menuId: string;
  /**
   * Accessible name for the menu itself. Needed only when the trigger has no
   * text of its own — an icon-only trigger names itself, not the list.
   */
  label?: string;
  onOpenChange?: (open: boolean, reason: MenuCloseReason) => void;
  /** Called with the value whose item should take DOM focus — the wrapper focuses it. */
  onFocusValue?: (value: string | null) => void;
  onSelect?: (value: string) => void;
}

export interface MenuTriggerProps {
  id: string;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string;
  onClick: (event: { preventDefault(): void }) => void;
  onKeyDown: (event: MenuKeyEvent) => void;
}

export interface MenuItemProps {
  role: "menuitem" | "menuitemradio";
  tabIndex: number;
  "aria-disabled": true | undefined;
  /** Only ever set alongside the `menuitemradio` role, which is the one that takes it. */
  "aria-checked": boolean | undefined;
  onClick: (event: { preventDefault(): void }) => void;
}

export interface MenuProps {
  trigger: MenuTriggerProps;
  menu: {
    id: string;
    role: "menu";
    "aria-labelledby": string | undefined;
    "aria-label": string | undefined;
    onKeyDown: (event: MenuKeyEvent) => void;
  };
  item: (value: string) => MenuItemProps;
  /** The item focus enters at, exposed so a wrapper can open at the right place. */
  firstValue: string | null;
  lastValue: string | null;
}

const PREVIOUS_KEYS = new Set(["ArrowUp"]);
const NEXT_KEYS = new Set(["ArrowDown"]);

/**
 * A single printable character with no modifier held — the typeahead trigger.
 *
 * The modifier test is the point: `event.key` for Ctrl+D is just "d", so
 * without it a browser shortcut was indistinguishable from someone typing,
 * and typeahead both hijacked the key and called preventDefault on it.
 */
function isTypeaheadKey(event: MenuKeyEvent): boolean {
  if (event.ctrlKey === true || event.metaKey === true || event.altKey === true) return false;
  return event.key.length === 1 && event.key !== " ";
}

export function getMenuProps(options: MenuOptions): MenuProps {
  const {
    items,
    open = false,
    focusedValue = null,
    triggerId,
    menuId,
    label,
    onOpenChange,
    onFocusValue,
    onSelect,
  } = options;

  const values = items.map((item) => item.value);
  const byValue = new Map(items.map((item) => [item.value, item]));
  const isDisabled = (value: string) => byValue.get(value)?.disabled === true;

  // Focus enters at the first item that can actually do something. A menu
  // whose first entry is unavailable would otherwise open onto a dead row and
  // look broken, even though the row is legitimately reachable afterwards.
  const firstValue = values.find((value) => !isDisabled(value)) ?? values[0] ?? null;
  const lastValue =
    [...values].reverse().find((value) => !isDisabled(value)) ?? values[values.length - 1] ?? null;

  /** The item the arrow keys move from, whether or not focus has landed yet. */
  const current = focusedValue !== null && byValue.has(focusedValue) ? focusedValue : firstValue;

  function close(reason: MenuCloseReason) {
    onOpenChange?.(false, reason);
    // Cleared so the next open re-enters at the top rather than wherever the
    // reader happened to leave off. A menu is transient; remembering a
    // position across openings makes the first arrow press unpredictable.
    onFocusValue?.(null);
  }

  function openAt(value: string | null) {
    onOpenChange?.(true, "trigger");
    onFocusValue?.(value);
  }

  function moveTo(index: number) {
    const target = values[index];
    if (target === undefined) return;
    onFocusValue?.(target);
  }

  /**
   * The next item after `from` whose text starts with `key`, wrapping.
   *
   * Searched from the item *after* the current one so repeating a key walks
   * matches instead of sticking on the first. Disabled items are included: in
   * this system a disabled control is reachable and announced, and hiding it
   * from typeahead would make the list a different length depending on how you
   * navigate it.
   */
  function typeaheadTarget(key: string, from: string | null): string | null {
    if (values.length === 0) return null;
    const needle = key.toLowerCase();
    const start = from === null ? -1 : values.indexOf(from);
    for (let step = 1; step <= values.length; step += 1) {
      const candidate = values[(start + step + values.length) % values.length]!;
      const text = byValue.get(candidate)?.text;
      if (text && text.trim().toLowerCase().startsWith(needle)) return candidate;
    }
    return null;
  }

  return {
    trigger: {
      id: triggerId,
      "aria-haspopup": "menu",
      "aria-expanded": open,
      "aria-controls": menuId,
      onClick: () => {
        if (open) close("trigger");
        // Opening puts focus on the first item, whether the trigger was
        // clicked, tapped, or activated with Enter or Space — those two arrive
        // here as a click, which is why they are not handled in onKeyDown.
        else openAt(firstValue);
      },
      onKeyDown: (event) => {
        if (open) return;
        if (NEXT_KEYS.has(event.key)) {
          // preventDefault, or the page scrolls behind the menu that just opened.
          event.preventDefault();
          openAt(firstValue);
        } else if (PREVIOUS_KEYS.has(event.key)) {
          event.preventDefault();
          openAt(lastValue);
        }
      },
    },

    menu: {
      id: menuId,
      role: "menu",
      // Named by its trigger's text when there is any; `label` is for the
      // icon-only trigger, whose own name describes the button, not the list.
      "aria-labelledby": label ? undefined : triggerId,
      "aria-label": label || undefined,
      onKeyDown: (event) => {
        if (!open || values.length === 0) return;
        const index = current === null ? -1 : values.indexOf(current);

        if (NEXT_KEYS.has(event.key)) {
          event.preventDefault();
          moveTo((index + 1) % values.length);
          return;
        }
        if (PREVIOUS_KEYS.has(event.key)) {
          event.preventDefault();
          moveTo((index - 1 + values.length) % values.length);
          return;
        }
        if (event.key === "Home") {
          event.preventDefault();
          moveTo(0);
          return;
        }
        if (event.key === "End") {
          event.preventDefault();
          moveTo(values.length - 1);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          close("escape");
          return;
        }
        if (event.key === "Tab") {
          // Deliberately not prevented: Tab closes the menu and lets focus
          // carry on to whatever follows the trigger, which is what someone
          // tabbing through a page expects. Trapping focus is a dialog's job.
          close("tab");
          return;
        }
        if (isTypeaheadKey(event)) {
          const target = typeaheadTarget(event.key, current);
          if (target !== null) {
            event.preventDefault();
            onFocusValue?.(target);
          }
        }
      },
    },

    item: (value: string) => ({
      // A checkable row is a different role, not a menuitem with an extra
      // attribute. `aria-checked` is unsupported on `menuitem`.
      role: byValue.get(value)?.selected === undefined ? "menuitem" : "menuitemradio",
      "aria-checked": byValue.get(value)?.selected,
      // Roving tabindex: exactly one item is tabbable, so the menu is a single
      // stop from the outside and the arrow keys move within it.
      tabIndex: value === current ? 0 : -1,
      "aria-disabled": isDisabled(value) || undefined,
      onClick: (event) => {
        if (isDisabled(value)) {
          event.preventDefault();
          return;
        }
        // Closed before the handler runs, so the wrapper has already put focus
        // back on the trigger by the time `onSelect` does whatever it does —
        // including navigating away or opening a dialog, both of which would
        // otherwise fight a menu that is still tearing down.
        close("select");
        onSelect?.(value);
      },
    }),

    firstValue,
    lastValue,
  };
}
