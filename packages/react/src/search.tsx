import { forwardRef, useId, useRef, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { getSearchProps } from "@rata/primitives";
import { Icon, Search as SearchGlyph, X } from "@rata/icons";
import { cx } from "./cx.js";
import { Spinner } from "./spinner.js";

export type SearchSize = "sm" | "md" | "lg";

export interface SearchProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    // Every one of these is the component's own, and `type` in particular:
    // the platform's searchbox role is the whole point.
    "type" | "value" | "defaultValue" | "onChange" | "disabled" | "id" | "size" | "role"
  > {
  /** The field's accessible name. Required. */
  label: ReactNode;
  /** Whether the label is off screen. Defaults to true, unlike every other field here. */
  labelHidden?: boolean;
  /** The query. Makes the component controlled. */
  value?: string;
  /** Starting query for an uncontrolled field. Conflicts with `value`. */
  defaultValue?: string;
  /** Called on every keystroke, and when the field is cleared. */
  onValueChange?: (value: string) => void;
  /** Called when the reader commits the query, by pressing Enter. */
  onSearch?: (value: string) => void;
  /** A query is in flight. The leading glyph becomes a spinner. */
  loading?: boolean;
  /** Wraps the field in a search landmark. */
  landmark?: boolean;
  /**
   * Hint text inside the empty field.
   *
   * Declared rather than inherited from the input's attributes because this
   * component has an opinion about it: it names the scope, it is not the
   * label, and the contract says so.
   */
  placeholder?: string;
  size?: SearchSize;
  /** Accessible name for the clear control. */
  clearLabel?: string;
  /** Blocks the field while keeping it focusable and readable. */
  disabled?: boolean;
  /** Stable id for the input. Defaults to a generated one. */
  id?: string;
  className?: string;
}

/**
 * A search field.
 *
 * Its own component rather than a `TextField` variant, and the reason is worth
 * stating: they share a look and nothing else. A text field is a value being
 * collected — it validates, it carries helper text, it is labelled on screen.
 * A search is a question being asked: no invalid state, a label that is
 * normally hidden, a clear control, and an answer to Escape. A `type` prop on
 * TextField would have brought all four along as dead weight.
 *
 * `labelHidden` DEFAULTS TO TRUE here, the only field in the system that does.
 * A magnifier and a placeholder are a search box's conventional shorthand, and
 * a visible "Search" label above one reads as a mistake. Hidden is not absent:
 * the label element is rendered and bound either way, because `role="searchbox"`
 * with no name is a 4.1.2 failure.
 *
 * WHAT THIS WRAPPER OWNS, and the primitive deliberately does not: putting
 * focus back on the input after a clear. The control disappears the instant the
 * field empties — it is absent when there is nothing to clear, not
 * disabled — so focus would fall to the body, and the reader would lose the
 * field they were just typing in.
 */
export const Search = forwardRef<HTMLInputElement, SearchProps>(function Search(
  {
    label,
    labelHidden = true,
    value,
    defaultValue,
    onValueChange,
    onSearch,
    loading,
    landmark,
    placeholder,
    size = "md",
    clearLabel,
    disabled,
    id,
    className,
    ...rest
  },
  ref
) {
  const generated = useId();
  const fieldId = id ?? generated;

  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");
  const current = isControlled ? value : uncontrolled;

  const inputRef = useRef<HTMLInputElement | null>(null);

  const field = getSearchProps({
    id: fieldId,
    value: current,
    disabled,
    loading,
    clearLabel,
    onValueChange: (next) => {
      if (!isControlled) setUncontrolled(next);
      onValueChange?.(next);
    },
    onSearch,
    // The primitive reports that the field was cleared; moving focus is a DOM
    // act, so it happens here. Without it focus falls to the body, because the
    // control that was just pressed no longer exists.
    onCleared: () => inputRef.current?.focus(),
  });

  const content = (
    <div
      className={cx("rata-search", className)}
      data-size={size}
      {...field.root}
    >
      <label
        className={cx("rata-search-label", labelHidden && "rata-visually-hidden")}
        {...field.label}
      >
        {label}
      </label>

      <div className="rata-search-control">
        <input
          {...rest}
          {...field.input}
          placeholder={placeholder}
          className={cx("rata-search-input", `rata-search-input--${size}`)}
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
        />

        {/* Decorative either way: the label names the field, and the spinner
            reports the same thing aria-busy already does on the input. */}
        <span className="rata-search-glyph" aria-hidden="true">
          {loading ? <Spinner /> : <Icon icon={SearchGlyph} />}
        </span>

        {field.clear && (
          <button
            {...field.clear}
            className="rata-search-clear rata-state-layer rata-state-layer--flush"
          >
            <Icon icon={X} />
          </button>
        )}
      </div>
    </div>
  );

  // A landmark only when asked. Unnamed on purpose: one landmark of a kind
  // needs no name, and the case that would need one — a filter over a list —
  // is documented as not being a landmark at all.
  return landmark ? <div role="search">{content}</div> : content;
});
