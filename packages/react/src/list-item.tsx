import { useId } from "react";
import type { MouseEvent, ReactNode } from "react";
import { getButtonProps } from "@rata/primitives";
import { ChevronRight, Ellipsis, Icon } from "@rata/icons";
import type { LucideIcon } from "@rata/icons";
import { Button } from "./button.js";
import { Menu, MenuItem } from "./menu.js";
import { cx } from "./cx.js";

/** One secondary command on a row, shown in the row's actions Menu. */
export interface ListItemAction {
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
  onSelect: () => void;
}

export interface ListItemProps {
  /** The row's text — what the row is. */
  children: ReactNode;
  /** A second, secondary line under the text. */
  description?: ReactNode;
  /** A visual at the start of the row — an Icon or an Avatar. */
  leading?: ReactNode;
  /** Metadata or one control at the end of the row. */
  trailing?: ReactNode;
  /** Makes the row a link to this address. */
  href?: string;
  /** Makes the row a button, or — with `href` — intercepts the link for client-side routing. */
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  /** Secondary commands on this row, shown in a Menu behind a trailing button. */
  actions?: ListItemAction[];
  /** The name of the actions trigger, before the row's own text. */
  actionsLabel?: string;
  /** Blocks the row's activation and its actions, while keeping both focusable and announced. */
  disabled?: boolean;
  className?: string;
}

/**
 * One row in a List.
 *
 * An `<li>` holding the row's content. When the row has `href` or `onClick`,
 * one real `<a>` or `<button>` wraps the row's text only, and list-item.css
 * stretches its hit area over the whole row with a `::before` — so the name
 * stays the text, and a control beside it is not nested inside the link.
 *
 * THE STATE LAYER IS ON THE `<li>`, and owns the `<li>`'s `::after`. The
 * stretch is the target's `::before`, on a different element and a different
 * pseudo-element, so the two never merge. The layer is driven by the target's
 * own hover and press through `:has()`, so pointing at the actions button
 * does not tint the row it is not about to activate.
 *
 * The focus ring is drawn on the `<li>` while the target is
 * `:focus-visible`, INSIDE the row (a negative offset) — the owner's gate-3
 * decision, so an inset List's `overflow: clip` never cuts it.
 *
 * `actions` always render as a Menu behind an icon-only Button named
 * "<actionsLabel>, <row text>" through `aria-labelledby`. No primitive: a row
 * in the normal tab order has no keyboard model to own; the button's guard is
 * `getButtonProps`, Button's.
 */
export function ListItem({
  children,
  description,
  leading,
  trailing,
  href,
  onClick,
  actions,
  actionsLabel = "More actions",
  disabled = false,
  className,
}: ListItemProps) {
  const id = useId();
  const textId = `${id}-text`;
  const descriptionId = description != null ? `${id}-description` : undefined;
  const actionsLabelId = `${id}-actions-label`;
  const isLink = href !== undefined;
  const interactive = isLink || onClick !== undefined;
  const behavior = getButtonProps({
    disabled,
    onActivate: onClick as ((event: { preventDefault(): void }) => void) | undefined,
  });

  let text: ReactNode;
  if (isLink) {
    text = (
      <a
        id={textId}
        href={href}
        className="rata-list-item-text rata-list-item-target"
        aria-describedby={descriptionId}
        aria-disabled={disabled || undefined}
        onClick={(event) => {
          // aria-disabled keeps the link focusable and announced; this is the
          // click guard the attribute does not provide on its own.
          if (disabled) {
            event.preventDefault();
            return;
          }
          onClick?.(event);
        }}
      >
        {children}
      </a>
    );
  } else if (interactive) {
    text = (
      <button
        id={textId}
        type={behavior.type}
        className="rata-list-item-text rata-list-item-target"
        aria-describedby={descriptionId}
        aria-disabled={behavior["aria-disabled"]}
        onClick={behavior.onClick as (event: MouseEvent<HTMLButtonElement>) => void}
      >
        {children}
      </button>
    );
  } else {
    text = (
      <span id={textId} className="rata-list-item-text">
        {children}
      </span>
    );
  }

  const hasActions = actions !== undefined && actions.length > 0;
  const trigger = (
    <Button
      variant="tertiary"
      iconOnly
      disabled={disabled}
      aria-haspopup="menu"
      aria-labelledby={`${actionsLabelId} ${textId}`}
      className="rata-list-item-actions"
    >
      <Icon icon={Ellipsis} size="md" />
    </Button>
  );

  return (
    <li
      className={cx(
        "rata-list-item",
        interactive && "rata-state-layer",
        interactive && "rata-state-layer--flush",
        interactive && "rata-list-item--interactive",
        leading != null && "rata-list-item--leading",
        disabled && "rata-list-item--disabled",
        className
      )}
    >
      {leading != null && <div className="rata-list-item-leading">{leading}</div>}
      <div className="rata-list-item-main">
        <div className="rata-list-item-body">
          {text}
          {description != null && (
            <div id={descriptionId} className="rata-list-item-description">
              {description}
            </div>
          )}
        </div>
        {trailing != null && <div className="rata-list-item-trailing">{trailing}</div>}
        {isLink && <Icon icon={ChevronRight} size="sm" className="rata-list-item-chevron" />}
        {hasActions && (
          <>
            {/* Referenced by aria-labelledby, which reads hidden nodes. */}
            <span id={actionsLabelId} hidden>
              {actionsLabel}
            </span>
            {disabled ? (
              // Disabled: the trigger stays reachable and announced, but there
              // is no menu behind it to open by click or by arrow key.
              trigger
            ) : (
              <Menu trigger={trigger}>
                {actions.map((action) => (
                  <MenuItem
                    key={action.label}
                    icon={action.icon}
                    destructive={action.destructive}
                    onSelect={action.onSelect}
                  >
                    {action.label}
                  </MenuItem>
                ))}
              </Menu>
            )}
          </>
        )}
      </div>
    </li>
  );
}
