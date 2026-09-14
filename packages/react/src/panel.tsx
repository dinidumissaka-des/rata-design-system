import { useId } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { Icon, X } from "@rata/icons";
import { cx } from "./cx.js";

/**
 * Which side of the content the panel is attached to.
 *
 * It states which edge the panel meets the content across, so the border and
 * the corners land on the right side — where the panel actually sits is the
 * page's layout. Logical, so a panel in a right-to-left document needs no
 * change: `inline-start` is the left in a left-to-right document and the
 * right in a right-to-left one.
 */
export type PanelEdge = "inline-start" | "inline-end";

/**
 * Where the panel's title sits in the page's outline.
 *
 * A prop rather than a fixed `h2`, because a panel sits inside the page's
 * existing outline and cannot know its own depth. Dialog and Sheet hardcode
 * `h2` only because everything behind a modal is inert, so the outline inside
 * one genuinely starts fresh.
 */
export type PanelHeadingLevel = 2 | 3 | 4 | 5 | 6;

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "title" | "children"> {
  /**
   * The panel's name. Required: it is what names the complementary landmark,
   * and an unnamed one is listed as "complementary" and nothing else — worse
   * than useless on a page with two.
   */
  title: ReactNode;
  /** The panel's content. */
  children: ReactNode;
  /** Where the title sits in the page's outline. */
  headingLevel?: PanelHeadingLevel;
  /** Which side of the content it is attached to. */
  edge?: PanelEdge;
  /**
   * Called when the reader closes the panel. OMITTING IT MAKES THE PANEL
   * PERSISTENT — no close button is rendered at all, which is the intended
   * way to say the panel does not close. A no-op handler would render a
   * control wired to nothing.
   *
   * No reason argument, unlike Dialog's and Sheet's: the button is the only
   * way this closes. Escape does not, and there is no backdrop to click.
   */
  onClose?: () => void;
  /** Accessible name for the close button. */
  closeLabel?: string;
  className?: string;
}

/**
 * A titled region beside the content it describes.
 *
 * NOT A SHEET, and the difference is the whole reason both exist. A sheet is a
 * modal `<dialog>` in the top layer: it covers the page and makes everything
 * behind it inert. A panel is in normal flow, so the page reflows around it
 * and everything beside it stays usable. Reading a token's contract while
 * still seeing the swatch grid IS the task, and the same content in a sheet
 * would answer a different question.
 *
 * WHAT IT DELIBERATELY DOES NOT DO, all four for the same reason — they are
 * modal behaviours, and this is not modal:
 *
 * 1. **Escape does not close it.** Escape dismisses the top layer, and a
 *    reader who presses it expects whatever is covering the page to go away.
 *    This covers nothing, and the reader may well be typing in the page
 *    beside it.
 * 2. **Focus is not moved when it opens.** Opening a panel adds a region to
 *    the page; it does not take the reader anywhere.
 * 3. **Focus is not trapped.** Tab reaches it in document order and leaves
 *    the same way. Trapping would strand the reader in a region they can see
 *    straight past.
 * 4. **Focus is not restored when it closes.** There is nowhere to restore it
 *    to — nothing was taken away to begin with.
 *
 * The measure is the PAGE'S, not this component's: there is no `size` prop and
 * no width in the stylesheet. Where a panel stops fitting depends on its
 * content and the page around it, which is the page's knowledge — the same
 * bargain SideNav makes, and the reason this system has no breakpoint tokens.
 */
export function Panel({
  title,
  children,
  headingLevel = 2,
  edge = "inline-end",
  onClose,
  closeLabel = "Close",
  className,
  ...rest
}: PanelProps) {
  const titleId = `${useId()}-title`;
  const Heading = `h${headingLevel}` as const;

  return (
    // A complementary landmark, which is what a region supporting the main
    // content is — and it stays meaningful separated from it, which is the
    // test for the role. Named by its own heading, so it is announced by name
    // in a landmark list rather than as one of two "complementary"s.
    <aside
      {...rest}
      className={cx("rata-panel", `rata-panel--${edge}`, className)}
      aria-labelledby={titleId}
    >
      <div className="rata-panel-header">
        <Heading className="rata-panel-heading" id={titleId}>
          {title}
        </Heading>

        {/* No handler means no button. See the prop. */}
        {onClose !== undefined && (
          <button
            type="button"
            className="rata-panel-dismiss rata-state-layer rata-state-layer--flush"
            aria-label={closeLabel}
            // Called with nothing, which is what the prop's type promises.
            // Passing the handler straight to onClick hands it a click event
            // instead — harmless until someone passes a function that takes
            // an optional first argument, at which point it silently receives
            // a SyntheticEvent.
            onClick={() => onClose()}
          >
            <Icon icon={X} />
          </button>
        )}
      </div>

      <div className="rata-panel-body">{children}</div>
    </aside>
  );
}
