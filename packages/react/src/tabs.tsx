import { useEffect, useId, useRef, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { getTabsProps } from "@rata/primitives";
import type { TabsActivation, TabsOrientation } from "@rata/primitives";
import { Icon } from "@rata/icons";
import type { LucideIcon } from "@rata/icons";
import { cx } from "./cx.js";

/** How the tablist is drawn. The semantics are identical either way. */
export type TabsVariant = "underline" | "segmented";

export interface TabItem {
  value: string;
  label: ReactNode;
  /** What the tab reveals. */
  content: ReactNode;
  /** Unavailable, but still focusable and announced — activation is guarded. */
  disabled?: boolean;
  icon?: LucideIcon;
}

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** The tabs and their panels, in the order they are read. */
  items: TabItem[];
  /** Which panel is showing. Makes the component controlled. */
  value?: string;
  /** Starting panel for uncontrolled tabs. Defaults to the first. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Accessible name for the tablist. Required unless `labelledBy` names an element. */
  label?: string;
  labelledBy?: string;
  orientation?: TabsOrientation;
  /** Whether the arrow keys select as they move. */
  activation?: TabsActivation;
  /**
   * How the tablist is drawn. Appearance only — the roles, the keyboard model
   * and everything announced are identical either way.
   *
   * `segmented` makes it look like this system's segmented control
   * (`ToggleButtonGroup`), which is a legitimate choice and worth knowing the
   * cost of: the two become hard to tell apart by eye, while staying
   * correctly distinguishable to a screen reader. Reach for it when the tabs
   * are short and peer-like; the underline carries a wider set better.
   */
  variant?: TabsVariant;
  className?: string;
}

/**
 * Tabs: several panels, one shown at a time.
 *
 * NOT A SEGMENTED CONTROL, which this system already has —
 * `ToggleButtonGroup` in its default configuration. They look almost
 * identical and are not the same control. A segmented control picks a VALUE:
 * it is a radiogroup, every option is announced as a choice, and the answer is
 * submitted with the rest of the form. Tabs reveal a REGION: each tab says
 * which panel it controls, each panel says which tab named it, and moving
 * between them changes what is on screen rather than what will be sent.
 *
 * Using one for the other is not a style error. A radiogroup standing in for
 * tabs tells a screen reader a form is being filled in; tabs standing in for a
 * form control hide the answer inside a region nobody submits.
 *
 * That is about the ROLE, not the appearance — and the two are worth keeping
 * apart. `variant="segmented"` draws a tablist to look like the segmented
 * control, which is a fine choice: what must not be swapped is which pattern
 * the markup claims to be, and that is unaffected by how it is painted.
 *
 * An `items` array rather than children, for the reason Breadcrumbs takes one:
 * the component owns the id wiring that makes a tablist a tablist — every tab
 * pointing at its panel and every panel back at its tab — and that is the
 * error-prone part. Handing it out to be assembled by the caller would mean
 * cloning elements to inject ids, and a mis-wired pair looks perfectly fine
 * on screen.
 *
 * WHAT THIS WRAPPER OWNS: moving focus. The primitive reports which tab should
 * hold it; focusing is a DOM act, so it happens here in an effect keyed on
 * that value.
 */
export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  label,
  labelledBy,
  orientation = "horizontal",
  activation = "automatic",
  variant = "underline",
  className,
  ...rest
}: TabsProps) {
  const idBase = useId();

  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? items[0]?.value ?? "");
  const current = isControlled ? value : uncontrolled;

  const [focusedValue, setFocusedValue] = useState<string | null>(null);
  const tabsRef = useRef(new Map<string, HTMLButtonElement | null>());
  /** Only move focus in response to a key, never on first paint. */
  const shouldFocus = useRef(false);

  const tabs = getTabsProps({
    tabs: items.map(({ value: v, disabled }) => ({ value: v, disabled })),
    value: current,
    focusedValue,
    idBase,
    orientation,
    activation,
    label,
    labelledBy,
    onValueChange: (next) => {
      if (!isControlled) setUncontrolled(next);
      onValueChange?.(next);
    },
    onFocusValue: (next) => {
      shouldFocus.current = true;
      setFocusedValue(next);
    },
  });

  // Focus follows the value the primitive reported. Keyed on it rather than
  // done inside the handler, so it lands after the render that made the tab
  // tabbable — and gated, so mounting a page of tabs does not steal focus.
  useEffect(() => {
    if (!shouldFocus.current || focusedValue === null) return;
    shouldFocus.current = false;
    tabsRef.current.get(focusedValue)?.focus();
  }, [focusedValue]);

  return (
    <div
      {...rest}
      className={cx(
        "rata-tabs",
        `rata-tabs--${orientation}`,
        `rata-tabs--${variant}`,
        className
      )}
    >
      <div {...tabs.tablist} className="rata-tabs-list">
        {items.map((item) => (
          <button
            key={item.value}
            {...tabs.tab(item.value)}
            className="rata-tabs-tab rata-state-layer rata-state-layer--flush"
            ref={(node) => {
              tabsRef.current.set(item.value, node);
            }}
          >
            {item.icon && <Icon icon={item.icon} />}
            {item.label}
          </button>
        ))}
      </div>

      {/* Every panel is rendered, with all but one `hidden`. Unmounting them
          would throw away whatever state each held — a half-filled form, a
          scroll position — every time the reader looked at another tab. */}
      {items.map((item) => (
        <div key={item.value} {...tabs.panel(item.value)} className="rata-tabs-panel">
          {item.content}
        </div>
      ))}
    </div>
  );
}
