import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  ReactElement,
  ReactNode,
} from "react";
import { getMenuProps } from "@rata/primitives";
import type { MenuCloseReason, MenuItemDescriptor } from "@rata/primitives";
import { Icon } from "@rata/icons";
import type { LucideIcon } from "@rata/icons";
import { cx } from "./cx.js";
import { MenuContext, useMenuContext } from "./menu-context.js";

export interface MenuProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    // `id` is pointed at by the trigger's aria-controls, and `role`/`popover`
    // are what make the list a menu in the top layer at all.
    "id" | "role" | "children" | "onToggle" | "popover"
  > {
  /**
   * The control that opens the menu — usually a `Button`. Cloned to receive
   * the trigger's ARIA, its ref and its handlers.
   */
  trigger: ReactElement;
  /** `MenuItem` and `MenuSeparator` children, in the order they are read. */
  children: ReactNode;
  /** Whether the menu is showing. Makes the component controlled. */
  open?: boolean;
  /** Starting state for an uncontrolled menu. Conflicts with `open`. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Names the list itself, for a trigger whose own name describes the button. */
  label?: string;
  className?: string;
}

export interface MenuItemProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled" | "role" | "onSelect"> {
  /** The action's label. */
  children: ReactNode;
  /**
   * Identifies this row. Defaults to the children when they are a plain
   * string, which is the common case and saves stating it twice.
   */
  value?: string;
  onSelect?: () => void;
  /** Unavailable, but still focusable and announced — activation is guarded. */
  disabled?: boolean;
  /** Marks an action that removes something. */
  destructive?: boolean;
  /**
   * Marks the row that is the current answer, for a menu standing in for a
   * choice. Passing it at all — true or false — makes the row a
   * `menuitemradio` rather than a `menuitem`, because that is the role ARIA
   * lets carry a checked state. Pass it on every row of the set, not only the
   * chosen one.
   */
  selected?: boolean;
  icon?: LucideIcon;
  className?: string;
}

/** The text typeahead matches on, when the children are plain enough to read. */
function textOf(children: ReactNode): string | undefined {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  return undefined;
}

/**
 * A transient list of actions anchored to a trigger.
 *
 * POSITIONED BY THE PLATFORM. The list carries the `popover` attribute, which
 * puts it in the top layer — so it escapes every overflow and stacking
 * context without a portal — and CSS anchor positioning places it against the
 * trigger and flips it near a viewport edge. That is the whole of positioning:
 * no measurement loop, no scroll listeners, and no dependency, which matters
 * more here than usual because this registry is copy-paste and a dependency
 * becomes an install step for every consumer. See `menu.css` for what older
 * engines get.
 *
 * WHAT THIS WRAPPER OWNS, and the primitive deliberately does not:
 *
 * 1. **Focus.** `getMenuProps` reports which value should hold focus; moving
 *    it is a DOM act, so it happens here, in an effect keyed on that value.
 * 2. **Returning focus to the trigger.** On Escape and after a selection —
 *    but not on light-dismiss or Tab, where the reader is deliberately
 *    elsewhere and stealing focus back would undo their own action. It happens
 *    synchronously while the menu closes, not in an effect, so it is finished
 *    before `onSelect` runs — see the comment at the call site for why that
 *    ordering is load-bearing.
 * 3. **Knowing what the items are.** They are children, so their values, text
 *    and disabled state are not knowable until they render. Each registers
 *    itself and navigation is re-derived from the result.
 *
 * The popover's own light-dismiss handles clicking outside, and its `toggle`
 * event is what keeps `open` in step when the platform closes it — otherwise
 * the trigger's `aria-expanded` would go on claiming the menu is showing.
 */
export function Menu({
  trigger,
  children,
  open,
  defaultOpen,
  onOpenChange,
  label,
  className,
  ...rest
}: MenuProps) {
  const generated = useId();
  const triggerId = `${generated}-trigger`;
  const menuId = `${generated}-menu`;

  /**
   * A per-instance anchor name, passed to CSS as a custom property.
   *
   * `anchor-name` is a global ident: when several elements declare the same
   * one, the spec resolves it to the LAST acceptable anchor in tree order. A
   * single hard-coded name in the stylesheet therefore made every menu on a
   * page position itself against whichever trigger happened to come last —
   * which is fine until a page has two menus, and the playground has four.
   *
   * `useId` is sanitised because React 18 produces `:r0:` and a colon is not
   * valid in a CSS ident; React 19's `_r_0_` already is. The package supports
   * both.
   */
  const anchorName = `--rata-menu-${generated.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const anchorStyle = { "--rata-menu-anchor": anchorName } as CSSProperties;

  const isControlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
  const isOpen = isControlled ? open : uncontrolledOpen;

  const [focusedValue, setFocusedValue] = useState<string | null>(null);
  const [descriptors, setDescriptors] = useState<readonly MenuItemDescriptor[]>([]);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const itemsRef = useRef(new Map<string, HTMLButtonElement | null>());

  const registerDescriptor = useCallback(
    (value: string, text: string | undefined, disabled: boolean, selected?: boolean) => {
      setDescriptors((current) => {
        const existing = current.find((d) => d.value === value);
        if (
          existing &&
          existing.text === text &&
          existing.disabled === disabled &&
          existing.selected === selected
        ) {
          return current;
        }
        const next = current.filter((d) => d.value !== value);
        next.push({ value, text, disabled, selected });
        // Re-sorted into DOM order, because registration order is mount order
        // and the arrow keys have to walk the list the reader sees.
        return sortByDom(next, itemsRef.current);
      });
    },
    []
  );

  const unregisterDescriptor = useCallback((value: string) => {
    setDescriptors((current) => current.filter((d) => d.value !== value));
  }, []);

  const registerItem = useCallback((value: string, element: HTMLButtonElement | null) => {
    if (element === null) itemsRef.current.delete(value);
    else itemsRef.current.set(value, element);
  }, []);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const menu = getMenuProps({
    items: descriptors,
    open: isOpen,
    focusedValue,
    triggerId,
    menuId,
    label,
    onOpenChange: (next, reason: MenuCloseReason) => {
      // Escape and a selection both return focus to the trigger: the reader
      // is still working here. A light-dismiss does not, because they clicked
      // something else and taking focus back would undo that. Tab does not
      // either — they are on their way past.
      //
      // Done SYNCHRONOUSLY, here, rather than in an effect keyed on `open`.
      // The primitive closes before it calls `onSelect`, and the whole point
      // of that order is that focus is already home when the handler runs —
      // an effect fires after the handler, which both breaks the promise and
      // steals focus back from a dialog the handler just opened.
      if (!next && (reason === "escape" || reason === "select")) {
        triggerRef.current?.focus();
      }
      setOpen(next);
    },
    onFocusValue: setFocusedValue,
    onSelect: (value) => itemSelectRef.current.get(value)?.(),
  });

  /** Handlers live in a ref so registering one does not re-run navigation. */
  const itemSelectRef = useRef(new Map<string, (() => void) | undefined>());

  const registerSelect = useCallback((value: string, handler: (() => void) | undefined) => {
    itemSelectRef.current.set(value, handler);
  }, []);

  // The popover attribute is the source of truth for whether the list is
  // painted, so React's `open` has to drive it imperatively — there is no
  // prop for it.
  useEffect(() => {
    const node = menuRef.current;
    if (node === null) return;
    const showing = node.matches(":popover-open");
    if (isOpen && !showing) node.showPopover();
    else if (!isOpen && showing) node.hidePopover();
  }, [isOpen]);

  // Focus follows the value the primitive reported. Keyed on it rather than
  // done inside the handler, so it is correct after the render that made the
  // item tabbable — focusing a node with tabIndex -1 still works, but the
  // roving state would be a frame behind.
  useEffect(() => {
    if (!isOpen || focusedValue === null) return;
    itemsRef.current.get(focusedValue)?.focus();
  }, [isOpen, focusedValue]);

  const context = useMemo(
    () => ({
      getItemProps: menu.item,
      registerItem,
      registerDescriptor,
      unregisterDescriptor,
      registerSelect,
    }),
    [menu.item, registerItem, registerDescriptor, unregisterDescriptor, registerSelect]
  );

  const triggerProps = trigger.props as { className?: string; style?: CSSProperties };
  const triggerNode = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
        ...menu.trigger,
        // Not `popovertarget`: that would toggle the popover without telling
        // React, and `open` would drift out of step with what is painted.
        ref: triggerRef,
        className: cx("rata-menu-trigger", triggerProps.className),
        // Merged, not replaced: the caller's own style has to survive.
        style: { ...triggerProps.style, ...anchorStyle },
      })
    : trigger;

  return (
    <MenuContext.Provider value={context}>
      {triggerNode}
      <div
        {...rest}
        {...menu.menu}
        ref={menuRef}
        popover="auto"
        className={cx("rata-menu", className)}
        // The same name the trigger declares — a sibling does not inherit a
        // custom property, so both carry it.
        style={anchorStyle}
        onToggle={(event) => {
          // The platform closed it — light-dismiss, or Escape handled by the
          // popover itself before our keydown saw it. Without this the
          // trigger would keep claiming aria-expanded.
          //
          // `newState` is ToggleEvent's, which React's synthetic event types
          // do not carry yet; read off the native event rather than widened
          // with a cast that would hide a real mistake.
          const next = event.nativeEvent.newState === "open";
          if (next !== isOpen) setOpen(next);
        }}
      >
        {children}
      </div>
    </MenuContext.Provider>
  );
}

/** Registration order is mount order; the arrow keys need the reader's order. */
function sortByDom(
  items: MenuItemDescriptor[],
  elements: Map<string, HTMLButtonElement | null>
): MenuItemDescriptor[] {
  return [...items].sort((a, b) => {
    const ea = elements.get(a.value);
    const eb = elements.get(b.value);
    if (!ea || !eb) return 0;
    // DOCUMENT_POSITION_FOLLOWING — b comes after a.
    return ea.compareDocumentPosition(eb) & 4 ? -1 : 1;
  });
}

/** One action in a `Menu`. */
export function MenuItem({
  children,
  value,
  onSelect,
  disabled = false,
  destructive,
  selected,
  icon,
  className,
  ...rest
}: MenuItemProps) {
  const context = useMenuContext("MenuItem");
  const text = textOf(children);
  const resolved = value ?? text;
  if (resolved === undefined) {
    throw new Error(
      "<MenuItem> needs a `value` when its children are not a plain string — the menu " +
        "identifies rows by it, and typeahead matches on it."
    );
  }

  const { registerDescriptor, unregisterDescriptor, registerItem, getItemProps, registerSelect } =
    context;

  useEffect(() => {
    registerDescriptor(resolved, text, disabled, selected);
    return () => unregisterDescriptor(resolved);
  }, [registerDescriptor, unregisterDescriptor, resolved, text, disabled, selected]);

  useEffect(() => {
    registerSelect(resolved, onSelect);
  }, [registerSelect, resolved, onSelect]);

  const itemProps = getItemProps(resolved);

  return (
    <button
      type="button"
      {...rest}
      {...itemProps}
      className={cx(
        "rata-menu-item",
        "rata-state-layer",
        "rata-state-layer--flush",
        destructive && "rata-menu-item--destructive",
        selected && "rata-menu-item--selected",
        className
      )}
      ref={(node) => registerItem(resolved, node)}
    >
      {icon && <Icon icon={icon} />}
      {children}
    </button>
  );
}

/** A rule between groups of actions. Decorative, so it is not a menu row. */
export function MenuSeparator({ className }: { className?: string }) {
  return <hr className={cx("rata-menu-separator", className)} role="separator" />;
}
