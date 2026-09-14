/**
 * Re-assert a controlled checkbox's checkedness after a blocked activation.
 *
 * Disabled controls in this system stay focusable and block activation with
 * `preventDefault()` rather than carrying the native `disabled` attribute. For
 * a checkbox that runs into a sharp edge: the HTML spec's canceled activation
 * behaviour is "set the element's checkedness to its opposite value" — a
 * toggle, not a restore of a saved value. That is correct on its own, because
 * the pre-click steps had already toggled it. But React writes the controlled
 * value back onto the DOM node in the middle of the same dispatch, so the
 * cancel step's toggle lands on the *already corrected* value and flips it the
 * wrong way.
 *
 * Nothing re-renders afterwards — the change was blocked, so no state moved —
 * which leaves the input's checkedness disagreeing with its props until some
 * unrelated render happens to correct it. The drawn control is unaffected (it
 * paints from `data-state` on the root), so this is invisible on screen and
 * wrong in the two places that matter: the value the form submits, and the
 * state a screen reader announces.
 *
 * A microtask is the first moment the value can be set and stay set: it runs
 * after the dispatch and after the cancel step, both of which are synchronous.
 *
 * Radio needs none of this — the spec restores a radio's saved pre-click state
 * instead of toggling, so React's mid-dispatch write is simply overwritten
 * with the right answer.
 */
export function keepCheckedness(input: HTMLInputElement, checked: boolean): void {
  queueMicrotask(() => {
    if (input.checked !== checked) input.checked = checked;
  });
}
