import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { getStepsProps } from "@rata/primitives";
import type { StepState } from "@rata/primitives";
import { Icon, Check, TriangleAlert } from "@rata/icons";
import { cx } from "./cx.js";

/** One step in the sequence. */
export interface StepItem {
  /** Stable identity; what `current` and `onStepSelect` speak in. */
  id: string;
  /** A short noun: "Shipping", "Payment", "Review". */
  label: string;
  /** One line of detail under the label. Hidden in the compact form. */
  description?: string;
  /** An earlier answer that is now wrong — marked in the danger role. */
  invalid?: boolean;
}

export interface StepsProps
  extends Omit<HTMLAttributes<HTMLElement>, "aria-label" | "children"> {
  /** Names the whole sequence: "Checkout progress". */
  label: string;
  /** The steps in order. */
  steps: StepItem[];
  /** The `id` of the step the reader is on. */
  current: string;
  /** Makes completed steps navigable, and fires with the chosen step's id. */
  onStepSelect?: (id: string) => void;
  /** Lays the steps out in a row or a column. */
  orientation?: "horizontal" | "vertical";
  /** Class for the root — placement, not a restyle. */
  className?: string;
}

// Measure before paint in the browser; on a server there is nothing to measure.
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The marker, label and description of one step — shared by the row and its measuring copy. */
function StepContent({ item, step }: { item: StepState; step: StepItem }) {
  let marker: ReactNode = item.position;
  if (item.status === "complete") marker = <Icon icon={Check} size="xs" />;
  if (item.status === "invalid") marker = <Icon icon={TriangleAlert} size="xs" />;
  return (
    <>
      <span className="rata-steps-marker" aria-hidden="true">
        {marker}
      </span>
      <span className="rata-steps-label">
        <span className="rata-visually-hidden">{item.prefix}</span>
        {step.label}
        <span className="rata-visually-hidden">{item.suffix}</span>
      </span>
      {step.description && <span className="rata-steps-description">{step.description}</span>}
    </>
  );
}

/**
 * Where the reader is in a linear multi-step flow.
 *
 * An `<ol>` of steps with `aria-current="step"` on the current one; each
 * step's position and state are in its accessible name through visually
 * hidden text — "Step 1 of 4, Shipping, completed" — so no state is carried
 * by the marker alone. An indicator only: the caller owns which step is
 * current and renders that step's content.
 *
 * With `onStepSelect`, the list is wrapped in a labelled `<nav>` and the steps
 * already reached (and any invalid one) become buttons. The current and
 * upcoming steps stay plain text: there is nothing they could do from here.
 *
 * COMPACT FORM, BY MEASUREMENT. A horizontal row that does not fit its
 * container collapses to the current step's marker, its label and "Step 2 of
 * 4"; the other steps stay in the accessibility tree, visually clipped (and
 * shown again while one of them holds focus). Whether it fits is measured,
 * not guessed with a container query, because the width a row needs depends
 * on its step count and label lengths, which no token threshold can know.
 * The measurement sums a hidden copy of the full row whose steps are each laid
 * out at their natural width, which does not depend on which form is showing
 * — so collapsing can never make the row "fit" and flip it back. A
 * ResizeObserver on the root and on each measured step re-checks on resize
 * and font load (and every render re-checks for content changes), expanding
 * the row again once there is room. The copy also gives the root its
 * intrinsic sizes — the full row as its max-content width, the widest single
 * step as its min-content — so a shrink-to-fit parent offers the full row
 * when there is room and is never forced wider than its container.
 */
export function Steps({
  label,
  steps,
  current,
  onStepSelect,
  orientation = "horizontal",
  className,
  ...rest
}: StepsProps) {
  const navigable = onStepSelect !== undefined;
  const state = getStepsProps({ steps, current, navigable });
  const horizontal = orientation === "horizontal";

  const rootRef = useRef<HTMLElement | null>(null);
  const measureRef = useRef<HTMLOListElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const compact = horizontal && overflowing;

  // The full row's natural width is the sum of the measuring copy's steps,
  // each laid out at its own size whatever the container is — so the answer
  // never depends on which form is showing, and collapsing cannot flip back.
  const check = () => {
    const root = rootRef.current;
    const measure = measureRef.current;
    if (!horizontal || root === null || measure === null) {
      setOverflowing(false);
      return;
    }
    let needed = 0;
    for (const step of Array.from(measure.children)) needed += step.getBoundingClientRect().width;
    const available = root.getBoundingClientRect().width;
    // Half a pixel of slack absorbs sub-pixel rounding between the boxes.
    setOverflowing(needed - available > 0.5);
  };

  // After every render — labels, count or current may have changed the row —
  // and on every resize of the container (room) or of a measured step (fonts
  // loading). Setting the same value again is a no-op, so this settles in one
  // pass instead of looping.
  useBeforePaint(() => {
    check();
    const root = rootRef.current;
    const measure = measureRef.current;
    if (!horizontal || root === null || measure === null) return;
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(check);
    observer.observe(root);
    for (const step of Array.from(measure.children)) observer.observe(step);
    return () => observer.disconnect();
  });

  const list = (
    <ol
      className="rata-steps-list"
      aria-label={navigable ? undefined : label}
    >
      {state.items.map((item, index) => {
        const step = steps[index]!;
        return (
          <li
            key={item.id}
            className="rata-steps-item"
            data-status={item.status}
            aria-current={item.current ? "step" : undefined}
          >
            {item.navigable ? (
              <button
                type="button"
                className="rata-steps-step rata-steps-step--navigable rata-state-layer rata-state-layer--flush"
                onClick={() => onStepSelect?.(item.id)}
              >
                <StepContent item={item} step={step} />
              </button>
            ) : (
              <span className="rata-steps-step">
                <StepContent item={item} step={step} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );

  const Root = navigable ? "nav" : "div";
  return (
    <Root
      {...rest}
      ref={(node: HTMLElement | null) => {
        rootRef.current = node;
      }}
      aria-label={navigable ? label : undefined}
      className={cx("rata-steps", `rata-steps--${orientation}`, className)}
      data-compact={compact ? "" : undefined}
    >
      <div className="rata-steps-row">
        {list}
        {compact && state.summary !== null && (
          <span className="rata-steps-summary" aria-hidden="true">
            {state.summary}
          </span>
        )}
      </div>
      {horizontal && (
        // The full row, step by step at natural width, never shown and never
        // announced: the yardstick the visible row is compared against. Plain
        // spans, so there is nothing in it to focus.
        <div className="rata-steps-measure" aria-hidden="true">
          <ol className="rata-steps-list" ref={measureRef}>
            {state.items.map((item, index) => (
              <li key={item.id} className="rata-steps-item" data-status={item.status}>
                <span className="rata-steps-step">
                  <StepContent item={item} step={steps[index]!} />
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Root>
  );
}
