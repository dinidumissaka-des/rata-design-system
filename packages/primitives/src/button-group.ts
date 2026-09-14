/**
 * Headless button-group behavior.
 *
 * Pure function (no framework hooks) so it is trivially testable and portable
 * to non-React wrappers later.
 *
 * This primitive is deliberately thin — it is a container, and almost
 * everything a group of buttons does is done by the buttons. What it owns is
 * the one thing the buttons cannot own between them: the group's accessible
 * name, and the decision about which grouping role to take. Those are exactly
 * the parts that get silently omitted when a group is hand-rolled as a `<div>`
 * with a flex rule, which is why they live in a primitive rather than in the
 * component that renders them.
 *
 * A button group is not a selection control. Nothing here tracks a value or a
 * pressed item; that is `toggle-button-group`, whose behavior is a different
 * shape entirely.
 */

export type ButtonGroupOrientation = "horizontal" | "vertical";

export interface ButtonGroupOptions {
  /** Accessible name for the group. Required unless `labelledBy` names an existing element. */
  label?: string;
  /** Id of an element that already names this group — a heading above it, typically. */
  labelledBy?: string;
  orientation?: ButtonGroupOrientation;
}

export interface ButtonGroupProps {
  role: "group";
  "aria-label": string | undefined;
  "aria-labelledby": string | undefined;
  "data-orientation": ButtonGroupOrientation;
}

/**
 * Whether this group has an accessible name at all.
 *
 * Exported so callers and their tests can assert it — this package has no
 * NODE_ENV to branch on, so the component itself does not warn. A group without
 * a name is announced as an unlabelled group, which is worse than no group at
 * all: it adds a level to navigate and says nothing about what is inside it.
 */
export function hasAccessibleName(options: ButtonGroupOptions = {}): boolean {
  return Boolean(options.label?.trim() || options.labelledBy?.trim());
}

export function getButtonGroupProps(options: ButtonGroupOptions = {}): ButtonGroupProps {
  const { label, labelledBy, orientation = "horizontal" } = options;

  return {
    role: "group",
    // `aria-labelledby` wins when both are given: it points at text the user can
    // actually see, so it is the one that stays true when the visible heading
    // changes and the hard-coded string does not.
    "aria-label": labelledBy ? undefined : label || undefined,
    "aria-labelledby": labelledBy || undefined,
    // Orientation is presentational here — it changes how the group stacks, not
    // what it means — so it is a data attribute for CSS rather than
    // `aria-orientation`, which would imply navigation semantics this group
    // does not implement.
    "data-orientation": orientation,
  };
}
