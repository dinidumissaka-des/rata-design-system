/**
 * Headless step-indicator behaviour — each step's state, name and reach.
 *
 * A pure function from the steps, the current id and whether the indicator is
 * navigable, with no DOM and no framework. It is a primitive rather than a
 * loop inside the React component because the native package needs exactly
 * the same derivation, and two copies of "which steps are complete" is how the
 * web and native indicators would come to disagree.
 *
 * STATE IS POSITIONAL. Steps before `current` are complete, steps after it are
 * upcoming, and an `invalid` flag overrides either — the reader has to go back
 * to it. An id that is not in `steps` leaves no current step, and every step
 * reads as upcoming.
 *
 * ONLY REACHED STEPS ARE NAVIGABLE. With `navigable` set, complete steps and
 * any invalid step (other than the current one) can be returned to; the
 * current and upcoming steps cannot, and are not offered as controls at all.
 *
 * STATE IS IN THE NAME. Each step's accessible name says its position and its
 * state in words — "Step 1 of 4, Shipping, completed" — split into a `prefix`
 * and `suffix` around the visible label, so the renderer can set them as
 * visually hidden text and never rely on the marker's colour or glyph alone.
 */

/** A step's drawn and announced state. */
export type StepStatus = "complete" | "current" | "upcoming" | "invalid";

/** One step as the caller describes it. */
export interface StepsItemInput {
  id: string;
  label: string;
  /** An earlier answer that is now wrong — the reader needs to go back to it. */
  invalid?: boolean;
}

export interface StepsOptions {
  steps: readonly StepsItemInput[];
  /** The id of the step the reader is on. */
  current: string;
  /** Whether reached steps can be returned to (the caller has an `onStepSelect`). */
  navigable?: boolean;
}

/** One step, derived. */
export interface StepState {
  id: string;
  /** 1-based position in the sequence. */
  position: number;
  status: StepStatus;
  /** The step the reader is on — `aria-current="step"`. True even when it is also invalid. */
  current: boolean;
  /** Rendered as a control that returns to this step. */
  navigable: boolean;
  /** Visually hidden text before the label: "Step 1 of 4, ". */
  prefix: string;
  /** Visually hidden text after the label: ", completed". */
  suffix: string;
  /** The whole accessible name: "Step 1 of 4, Shipping, completed". */
  name: string;
}

export interface StepsState {
  items: StepState[];
  /** Index of the current step, or -1 when `current` names no step. */
  currentIndex: number;
  /** The compact form's visible summary — "Step 2 of 4" — or null with no current step. */
  summary: string | null;
}

const STATE_WORDS: Record<StepStatus, string> = {
  complete: "completed",
  current: "current",
  upcoming: "upcoming",
  invalid: "needs attention",
};

export function getStepsProps(options: StepsOptions): StepsState {
  const { steps, current, navigable = false } = options;
  const count = steps.length;
  const currentIndex = steps.findIndex((step) => step.id === current);

  const items = steps.map((step, index): StepState => {
    const isCurrent = index === currentIndex;
    const positional: StepStatus =
      currentIndex === -1 || index > currentIndex
        ? "upcoming"
        : isCurrent
          ? "current"
          : "complete";
    const status: StepStatus = step.invalid ? "invalid" : positional;
    const words = isCurrent && step.invalid ? "current, needs attention" : STATE_WORDS[status];
    const prefix = `Step ${index + 1} of ${count}, `;
    const suffix = `, ${words}`;
    return {
      id: step.id,
      position: index + 1,
      status,
      current: isCurrent,
      navigable: navigable && !isCurrent && (status === "complete" || status === "invalid"),
      prefix,
      suffix,
      name: `${prefix}${step.label}${suffix}`,
    };
  });

  return {
    items,
    currentIndex,
    summary: currentIndex === -1 ? null : `Step ${currentIndex + 1} of ${count}`,
  };
}
