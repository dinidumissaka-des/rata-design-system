/**
 * Headless segmented-control behavior.
 *
 * Pure function, no framework hooks and no timers. Nothing here touches the
 * DOM: where the pattern requires focus to move, this reports which value
 * should receive it and leaves the focusing to the wrapper.
 *
 * A `radiogroup` of `radio` options with one tab stop and arrow keys that
 * select as they move — the radio pattern, because a segmented control is a
 * question being answered and its value is submitted with the rest of a form.
 *
 * WHAT THIS IS NOT, and both are worth stating because all three look alike:
 *
 *   getToggleButtonGroupProps  The same ARIA pattern, a wider API: it also
 *                              does multiple selection, deselection, and
 *                              vertical orientation. This one is single
 *                              selection only and cannot be cleared.
 *   getTabsProps               A different pattern entirely. Tabs reveal a
 *                              region; each tab names a panel and each panel
 *                              names its tab. Nothing here controls anything
 *                              — the value is the answer.
 *
 * It is DELIBERATELY narrower than the toggle group rather than sharing it.
 * A segmented control has one shape: single selection, always filled, never
 * empty. Every option the toggle group carries is one this cannot honour, so
 * the narrower contract is the point — an API that cannot express a cleared
 * segmented control cannot produce one by accident.
 */

/** The part of a keyboard event this reads. */
export interface SegmentedControlKeyEvent {
  key: string;
  preventDefault(): void;
}

export interface SegmentedOption {
  value: string;
  /** Unavailable, but still focusable and announced — activation is guarded. */
  disabled?: boolean;
}

export interface SegmentedControlOptions {
  /** The options in DOM order. Order matters: the arrow keys walk this list. */
  options: readonly SegmentedOption[];
  /** The current answer. A segmented control always has one. */
  value: string;
  /** Which option holds focus. Defaults to the selected one. */
  focusedValue?: string | null;
  /** Accessible name. Required unless `labelledBy` names an existing element. */
  label?: string;
  labelledBy?: string;
  onValueChange?: (value: string) => void;
  /** Called with the value whose option should take DOM focus. */
  onFocusValue?: (value: string) => void;
}

export interface SegmentedOptionProps {
  role: "radio";
  type: "button";
  "aria-checked": boolean;
  "aria-disabled": true | undefined;
  tabIndex: number;
  onClick: (event: { preventDefault(): void }) => void;
}

export interface SegmentedControlProps {
  root: {
    role: "radiogroup";
    "aria-label": string | undefined;
    "aria-labelledby": string | undefined;
    onKeyDown: (event: SegmentedControlKeyEvent) => void;
  };
  option: (value: string) => SegmentedOptionProps;
}

const PREVIOUS = new Set(["ArrowLeft", "ArrowUp"]);
const NEXT = new Set(["ArrowRight", "ArrowDown"]);

export function getSegmentedControlProps(
  options: SegmentedControlOptions
): SegmentedControlProps {
  const {
    options: items,
    value,
    focusedValue = null,
    label,
    labelledBy,
    onValueChange,
    onFocusValue,
  } = options;

  const values = items.map((item) => item.value);
  const byValue = new Map(items.map((item) => [item.value, item]));
  const isDisabled = (candidate: string) => byValue.get(candidate)?.disabled === true;

  /** The option the arrow keys move from: wherever focus is, or the answer. */
  const current = focusedValue !== null && byValue.has(focusedValue) ? focusedValue : value;

  function select(candidate: string) {
    // No deselection, ever. A segmented control with nothing chosen is a
    // different control — the narrower API is what stops one existing.
    if (isDisabled(candidate) || candidate === value) return;
    onValueChange?.(candidate);
  }

  function moveTo(index: number) {
    const target = values[index];
    if (target === undefined) return;
    onFocusValue?.(target);
    // The radio pattern: arrow keys select as they move. A disabled option can
    // still be REACHED — this system's disabled controls stay focusable and
    // announced — so focus moves there and the answer does not follow.
    if (!isDisabled(target)) select(target);
  }

  return {
    root: {
      role: "radiogroup",
      "aria-label": labelledBy ? undefined : label || undefined,
      "aria-labelledby": labelledBy || undefined,
      // No aria-orientation: this control is a horizontal bar by
      // construction, and both axes' arrow keys are accepted so a reader who
      // tries the wrong pair is not left stuck. Announcing an orientation
      // would promise that only one pair works.
      onKeyDown: (event) => {
        if (values.length === 0) return;
        const index = values.indexOf(current);
        if (PREVIOUS.has(event.key)) {
          event.preventDefault();
          moveTo((index - 1 + values.length) % values.length);
        } else if (NEXT.has(event.key)) {
          event.preventDefault();
          moveTo((index + 1) % values.length);
        } else if (event.key === "Home") {
          event.preventDefault();
          moveTo(0);
        } else if (event.key === "End") {
          event.preventDefault();
          moveTo(values.length - 1);
        }
      },
    },

    option: (candidate: string) => ({
      role: "radio",
      type: "button",
      "aria-checked": candidate === value,
      "aria-disabled": isDisabled(candidate) || undefined,
      // Roving tabindex, derived from focus-or-answer rather than stored, so
      // the two can never disagree.
      tabIndex: candidate === current ? 0 : -1,
      onClick: (event) => {
        if (isDisabled(candidate)) {
          event.preventDefault();
          return;
        }
        onFocusValue?.(candidate);
        select(candidate);
      },
    }),
  };
}
