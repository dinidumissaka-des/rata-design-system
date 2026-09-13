/**
 * Holding the page still while something modal is open.
 *
 * ONE COUNTER, SHARED by every component that needs it — which is the whole
 * reason this is its own module rather than a helper inside Dialog. Two
 * components each keeping their own count would fight: with a Dialog and a
 * MobileNav both open, whichever closed first would unlock the page while the
 * other was still covering it.
 *
 * Counted rather than saved-and-restored for the same class of reason. Save
 * and restore is wrong the moment two overlays overlap: the second captures
 * `hidden` as the value to put back, so closing it leaves the page locked with
 * nothing open.
 *
 */
let holders = 0;

export function lockScroll(): void {
  holders += 1;
  if (holders !== 1) return;
  const { body, documentElement } = document;
  // Hiding the overflow takes the scrollbar away with it, and the page reflows
  // into the space it occupied — everything shifts sideways as the overlay
  // opens and jumps back as it closes, which is far more noticeable than the
  // scrolling this is meant to prevent. Holding the width with padding keeps
  // the page still. Measured, not a token: it is whatever this browser and
  // this reader's settings make it, and it is zero for overlay scrollbars.
  const gutter = window.innerWidth - documentElement.clientWidth;
  body.style.overflow = "hidden";
  if (gutter > 0) body.style.paddingInlineEnd = `${gutter}px`;
}

export function unlockScroll(): void {
  holders = Math.max(0, holders - 1);
  if (holders !== 0) return;
  // Removed rather than set to "": leaves the page exactly as it was found,
  // including a stylesheet's own overflow or padding, which an empty inline
  // value would shadow instead of restoring.
  const { body } = document;
  body.style.removeProperty("overflow");
  body.style.removeProperty("padding-inline-end");
}
