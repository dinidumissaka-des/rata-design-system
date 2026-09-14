/**
 * Platform features jsdom does not implement, shimmed for the test suite.
 *
 * Both overlays in this system are built on browser primitives deliberately —
 * `popover` for the menu's top layer and light-dismiss, a native `<dialog>`
 * with `showModal()` for the modal's focus trap and inert page. That is the
 * right call for shipped code and it means jsdom, which implements neither,
 * cannot run the components without help.
 *
 * These shims implement the STATE MACHINES only. They do not pretend there is
 * a top layer, a focus trap or an inert page — those are exactly the parts a
 * DOM emulation cannot provide, and a shim that faked them would let a test
 * assert behaviour no browser would actually deliver. What the suites assert
 * is ARIA, focus movement and handler ordering, none of which depends on
 * where a surface is painted.
 *
 * Not part of the package build: `tsconfig.json` excludes it, so it never
 * reaches dist. `tsconfig.test.json` typechecks it.
 */

/**
 * jsdom's UA stylesheet carries the spec's
 * `[popover]:not(:popover-open) { display: none }`. Since `:popover-open` can
 * never match there, a popover is hidden unconditionally and therefore absent
 * from the accessibility tree that Testing Library queries — so lifting that
 * rule is part of the shim, not a convenience.
 */
export function installPopoverShim(): void {
  const open = new WeakSet<Element>();
  const proto = HTMLElement.prototype as unknown as {
    showPopover(): void;
    hidePopover(): void;
    matches(s: string): boolean;
  };
  const matches = proto.matches;
  const toggle = (el: HTMLElement, newState: "open" | "closed") =>
    el.dispatchEvent(Object.assign(new Event("toggle"), { newState }));

  proto.showPopover = function () {
    const el = this as unknown as HTMLElement;
    if (open.has(el)) return;
    open.add(el);
    el.style.display = "block";
    toggle(el, "open");
  };
  proto.hidePopover = function () {
    const el = this as unknown as HTMLElement;
    if (!open.has(el)) return;
    open.delete(el);
    el.style.removeProperty("display");
    toggle(el, "closed");
  };
  proto.matches = function (selector: string) {
    if (selector === ":popover-open") return open.has(this as unknown as Element);
    return matches.call(this, selector);
  };
}

/**
 * `showModal` and `close` on `HTMLDialogElement`, which jsdom leaves undefined.
 *
 * The `open` attribute is what the UA stylesheet keys `display` off, so
 * setting it is what puts the dialog in the accessibility tree. Note what is
 * deliberately absent: no focus trap, and no `inert` on the rest of the
 * document. A test must not assert that focus cannot leave a modal, because
 * this shim is not what makes that true in a browser — the platform is.
 */
export function installDialogShim(): void {
  const proto = HTMLDialogElement.prototype as unknown as {
    showModal(): void;
    show(): void;
    close(returnValue?: string): void;
  };
  proto.showModal = function () {
    const el = this as unknown as HTMLDialogElement;
    if (el.open) return;
    el.setAttribute("open", "");
    // A real showModal moves focus into the dialog — to [autofocus], or the
    // first focusable descendant. Reproduced because focus behaviour IS what
    // the suite asserts, and starting focus in the wrong place would make
    // every focus assertion meaningless.
    const target =
      el.querySelector<HTMLElement>("[autofocus]") ??
      el.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      );
    target?.focus();
  };
  proto.show = function () {
    (this as unknown as HTMLDialogElement).setAttribute("open", "");
  };
  proto.close = function (returnValue?: string) {
    const el = this as unknown as HTMLDialogElement;
    if (!el.open) return;
    if (returnValue !== undefined) el.returnValue = returnValue;
    el.removeAttribute("open");
    el.dispatchEvent(new Event("close"));
  };
}
