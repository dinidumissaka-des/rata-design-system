import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, FocusEvent, ReactNode } from "react";
import {
  comboboxCountMessage,
  filterComboboxOptions,
  getComboboxProps,
} from "@rata/primitives";
import type { ComboboxFilter, FieldStatus, PopoverFocusDestination } from "@rata/primitives";
import { Icon, Check, ChevronDown } from "@rata/icons";
import { Field } from "./field.js";
import { Spinner } from "./spinner.js";
import { cx } from "./cx.js";

export type { ComboboxFilter };

export type ComboboxSize = "sm" | "md" | "lg";

export interface ComboboxOption {
  value: string;
  /** Text, not a ReactNode: it is what the box shows once chosen and what typing matches. */
  label: string;
  /** The second line a native `<option>` cannot hold. Announced after the label. */
  description?: ReactNode;
  /** Stays in the list, reachable and announced as unavailable, and cannot be chosen. */
  disabled?: boolean;
}

export interface ComboboxProps {
  /** The control's name. Always required — `labelHidden` hides it, nothing removes it. */
  label: ReactNode;
  /** The choices, in the order they are read. */
  options: ComboboxOption[];
  /** Controls the chosen option's `value` from outside. `null` means nothing is chosen. */
  value?: string | null;
  /** The starting choice when the component owns the state. */
  defaultValue?: string | null;
  /** Fires with the chosen option's value when a choice is committed. */
  onValueChange?: (value: string | null) => void;
  /** Fires with the text in the box on every edit. */
  onInputChange?: (text: string) => void;
  /** How typed text narrows `options` locally. */
  filter?: ComboboxFilter;
  /** Accepts text that matches no option as the answer. */
  allowCustomValue?: boolean;
  /** Options are being fetched. The popup shows a spinner row and the field is busy. */
  loading?: boolean;
  /** What the popup says when nothing matches. */
  emptyMessage?: ReactNode;
  /** A hint shown while the box is empty. */
  placeholder?: string;
  /** Form field name. Submits the chosen option's `value`, not the text. */
  name?: string;
  /** Control height and inline padding. Text size does not change with it. */
  size?: ComboboxSize;
  /** Takes the label off screen while leaving it in the accessibility tree. */
  labelHidden?: boolean;
  /** Stable id for the combobox. Defaults to a generated one. */
  id?: string;
  /** Validation lifecycle. Drives `aria-invalid`, `aria-busy`, and the ring. */
  status?: FieldStatus;
  /** Persistent helper text under the control. */
  description?: ReactNode;
  /** Status-dependent message under the control. */
  message?: ReactNode;
  /** Marks the field required to assistive technology and in the label. */
  required?: boolean;
  /** Blocks choosing while keeping the field focusable, readable and announced. */
  disabled?: boolean;
  /** Class for the wrapper — the width the form wants, not a restyle. */
  className?: string;
}

const labelOf = (options: readonly ComboboxOption[], value: string | null) =>
  value === null ? undefined : options.find((option) => option.value === value)?.label;

/**
 * A text input that filters a popup list of options — the WAI-ARIA APG
 * combobox with a listbox popup, list autocomplete and manual selection.
 *
 * DOM FOCUS NEVER LEAVES THE INPUT. `aria-activedescendant` walks the
 * listbox, the highlight is drawn from `data-highlighted`, and only Enter or
 * a click commits. Presses on the toggle and on options are prevented at
 * pointerdown so focus stays put.
 *
 * THE POPUP IS POPOVER'S MACHINERY (decision C6): the surface carries
 * `.rata-popover` and the per-instance `--rata-popover-anchor`, so the top
 * layer, the anchoring and the flip fallbacks are Popover's. It is
 * `popover="manual"` rather than `auto`, because light-dismiss would close it
 * the moment the reader pressed the input it belongs to; the dismissal rules
 * are the shared primitive's instead, with the input counted as inside.
 *
 * Composed with Field like TextField: the label, helper text, message, the
 * required marker and `aria-disabled` plus `readOnly` all come from there.
 * The submitted value lives in a hidden input carrying `name`; the visible
 * one holds the label.
 */
export function Combobox({
  label,
  options,
  value,
  defaultValue = null,
  onValueChange,
  onInputChange,
  filter = "contains",
  allowCustomValue = false,
  loading = false,
  emptyMessage = "No matches",
  placeholder,
  name,
  size = "md",
  labelHidden = false,
  id,
  status = "idle",
  description,
  message,
  required = false,
  disabled = false,
  className,
}: ComboboxProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const listboxId = `${fieldId}-listbox`;
  const labelId = `${fieldId}-label`;

  // Sanitised: React's `:r0:` is not a valid CSS ident.
  const anchorName = `--rata-popover-${generated.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const anchorStyle = { "--rata-popover-anchor": anchorName } as CSSProperties;

  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState<string | null>(defaultValue);
  const currentValue = isControlled ? value : uncontrolledValue;

  const [text, setText] = useState(() => labelOf(options, currentValue) ?? currentValue ?? "");
  // What the list is narrowed by: the reader's own typing since the last
  // commit. Opening with ArrowDown on a chosen answer shows every option,
  // not just the one whose label is already in the box.
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const wellRef = useRef<HTMLSpanElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const visible = useMemo(
    () => filterComboboxOptions(options, query, filter),
    [options, query, filter]
  );
  const indexOf = useMemo(
    () => new Map(options.map((option, index) => [option.value, index])),
    [options]
  );
  const optionId = (optionValue: string) => `${listboxId}-${indexOf.get(optionValue) ?? 0}`;

  // A value set from outside — a form reset, a dependent field — shows its
  // label. Keyed on the value alone: options arriving from a server while the
  // reader types must not overwrite what they are typing.
  const syncedValue = useRef(currentValue);
  useEffect(() => {
    if (syncedValue.current === currentValue) return;
    syncedValue.current = currentValue;
    const next = labelOf(options, currentValue);
    if (next !== undefined) setText(next);
    else if (currentValue === null) setText("");
    setQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentValue]);

  function commitValue(next: string | null) {
    syncedValue.current = next;
    if (!isControlled) setUncontrolledValue(next);
    onValueChange?.(next);
  }

  const combobox = getComboboxProps({
    id: fieldId,
    listboxId,
    labelId,
    options,
    visible,
    open,
    inputText: text,
    highlightedValue: highlighted,
    value: currentValue,
    allowCustomValue,
    disabled,
    loading,
    optionId,
    onOpenChange: (next) => setOpen(next),
    onHighlightChange: setHighlighted,
    onInputChange: (next, typed) => {
      setText(next);
      setQuery(typed ? next : "");
      onInputChange?.(next);
    },
    onValueChange: commitValue,
  });

  // The popover attribute is the source of truth for whether it is painted.
  useEffect(() => {
    const node = popupRef.current;
    if (node === null) return;
    const showing = node.matches(":popover-open");
    if (open && !showing) node.showPopover();
    else if (!open && showing) node.hidePopover();
  }, [open]);

  // A press anywhere but the field and its popup dismisses it. `manual`
  // popovers get no light-dismiss of their own, which is the point: the
  // platform's would count the input as outside.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target === null) return;
      if (wellRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      combobox.dismissed();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  });

  // The highlighted row follows the keyboard into view.
  useEffect(() => {
    if (!open || highlighted === null) return;
    const node = document.getElementById(optionId(highlighted));
    node?.scrollIntoView?.({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, highlighted]);

  function destinationOf(event: FocusEvent<HTMLInputElement>): PopoverFocusDestination {
    const next = event.relatedTarget as Node | null;
    if (next === null) return "nowhere";
    if (wellRef.current?.contains(next) || popupRef.current?.contains(next)) return "inside";
    return "outside";
  }

  const announcement = !open || loading ? "" : visible.length === 0 ? emptyMessage : comboboxCountMessage(visible.length);

  return (
    <Field
      className={cx("rata-combobox", className)}
      label={label}
      labelHidden={labelHidden}
      id={fieldId}
      status={status}
      description={description}
      message={message}
      required={required}
      disabled={disabled}
    >
      {(control) => (
        <>
          <span ref={wellRef} className="rata-combobox-well rata-popover-trigger" style={anchorStyle}>
            <input
              ref={inputRef}
              type="text"
              {...control}
              {...combobox.input}
              placeholder={placeholder}
              onBlur={(event) => combobox.focusMoved(destinationOf(event))}
              className={cx("rata-combobox-input", `rata-combobox-input--${size}`)}
            />
            <button
              {...combobox.toggle}
              className="rata-combobox-toggle rata-state-layer rata-state-layer--flush"
              // Kept off the toggle so the input never blurs: the toggle is a
              // pointer affordance, and the keyboard's place is the input.
              onPointerDown={(event) => event.preventDefault()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                combobox.toggle.onClick();
                inputRef.current?.focus();
              }}
            >
              <Icon icon={ChevronDown} aria-hidden="true" />
            </button>
          </span>

          {name !== undefined && <input type="hidden" name={name} value={currentValue ?? ""} />}

          <div
            ref={popupRef}
            popover="manual"
            className="rata-popover rata-combobox-popup"
            style={anchorStyle}
          >
            <ul {...combobox.listbox} className="rata-combobox-listbox">
              {visible.map((option) => {
                const props = combobox.option(option.value);
                return (
                  <li
                    key={option.value}
                    {...props}
                    className="rata-combobox-option rata-state-layer rata-state-layer--flush"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      props.onClick();
                      inputRef.current?.focus();
                    }}
                  >
                    <span className="rata-combobox-option-text">
                      <span className="rata-combobox-option-label">{option.label}</span>
                      {option.description !== undefined && (
                        <span className="rata-combobox-option-description">{option.description}</span>
                      )}
                    </span>
                    {props["aria-selected"] && (
                      <Icon icon={Check} className="rata-combobox-option-check" aria-hidden="true" />
                    )}
                  </li>
                );
              })}
            </ul>
            {/* Outside the listbox, so neither is arrowed onto as a choice. */}
            {!loading && visible.length === 0 && (
              <div className="rata-combobox-empty">{emptyMessage}</div>
            )}
            {loading && (
              <div className="rata-combobox-loading">
                <Spinner />
              </div>
            )}
          </div>

          {/* The listbox changing under aria-activedescendant is silent in most
              screen readers, so the count is said here — and only once loading
              clears, so a query in flight is not answered with "0 results". */}
          <span role="status" className="rata-visually-hidden">
            {announcement}
          </span>
        </>
      )}
    </Field>
  );
}
