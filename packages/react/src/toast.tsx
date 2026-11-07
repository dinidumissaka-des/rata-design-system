import {
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FocusEvent, ReactElement, ReactNode } from "react";
import { Icon, CircleCheck, CircleX, X } from "@rata/icons";
import type { LucideIcon } from "@rata/icons";
import { Button } from "./button.js";
import { cx } from "./cx.js";

export type ToastVariant = "neutral" | "success" | "danger";

export interface ToastProps {
  /** The message — one short sentence about what just happened. */
  children: ReactNode;
  /** Whether the outcome says anything about health. */
  variant?: ToastVariant;
  /** One optional action — Undo, View — offered alongside the message. */
  action?: { label: string; onAction: () => void };
  /** Milliseconds before the toast leaves on its own, or `null` to stay until dismissed. */
  duration?: number | null;
  /** Called when the toast leaves — by its timer, its dismiss button, its action, or the stack making room. */
  onDismiss?: () => void;
  /** Accessible name for the dismiss button. */
  dismissLabel?: string;
}

export interface ToastRegionProps {
  /** The app. `useToast()` works anywhere below the region. */
  children: ReactNode;
}

export interface ToastApi {
  /** Hand a `<Toast>` to the region. Call it from an event handler, not during render. */
  show: (toast: ReactElement<ToastProps>) => void;
}

/**
 * Notice's pairings, so a toast and a notice reporting the same outcome draw
 * the same shape. Neutral has none: most confirmations say nothing about
 * health, and an icon would make "Saved" look like a celebration.
 */
const VARIANT_ICON: Record<ToastVariant, LucideIcon | null> = {
  neutral: null,
  success: CircleCheck,
  danger: CircleX,
};

/** More than this many at once is a log, not a confirmation. */
const MAX_VISIBLE = 3;

interface ToastEntry {
  id: number;
  element: ReactElement<ToastProps>;
  leaving: boolean;
}

/** What the region tells each toast it renders. Absent outside a region. */
interface ToastSlot {
  leaving: boolean;
  /** Start leaving: the timer ran out, or the dismiss button was pressed. */
  dismiss: () => void;
  /** The exit has finished; take it out of the DOM. */
  remove: () => void;
  /** The tab is hidden, which pauses every toast's timer. */
  hidden: boolean;
}

const ToastApiContext = createContext<ToastApi | null>(null);
const ToastSlotContext = createContext<ToastSlot | null>(null);

/**
 * Show a toast from anywhere below the app's `ToastRegion`.
 *
 * Throws outside a region rather than doing nothing: a confirmation that
 * silently never appears is the failure nobody notices in review.
 */
export function useToast(): ToastApi {
  const api = useContext(ToastApiContext);
  if (api === null) {
    throw new Error("useToast() needs a <ToastRegion> above it — mount one near the app root.");
  }
  return api;
}

function usePageHidden(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return hidden;
}

/**
 * The one place every toast lands, mounted once near the app root.
 *
 * WHY A REGION AND NOT `<Toast>` IN PLACE. A toast is raised from an event
 * handler — a save that finished — far from where it is drawn. Rendered in
 * place it would land in whatever stacking context that handler's component
 * lives in. The region is a single `popover="manual"` element shown on mount,
 * so it sits in the top layer with no z-index, and it is a `role="status"`
 * live region that exists BEFORE any toast arrives — a live region mounted
 * together with its text is the case screen readers miss.
 *
 * WHAT IT OWNS: the stack (newest last, at most three — the oldest leaves
 * early), each toast's leaving and removal, and the live region. Each Toast
 * owns only what it says, plus its own countdown, which pauses while it is
 * hovered, while focus is inside it and while the tab is hidden.
 *
 * NOT OVER A MODAL. `showModal()` makes everything outside the dialog inert,
 * and this region was shown before it, so it sits beneath the dialog in the
 * top layer. That is the contract's rule, not a bug to work around: do not
 * raise a toast from inside a modal Dialog — report the result inside the
 * dialog, or after it closes.
 */
export function ToastRegion({ children }: ToastRegionProps) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);
  const regionRef = useRef<HTMLDivElement | null>(null);
  const hidden = usePageHidden();

  useEffect(() => {
    const node = regionRef.current;
    if (node === null) return;
    if (!node.matches(":popover-open")) node.showPopover();
    return () => {
      if (node.matches(":popover-open")) node.hidePopover();
    };
  }, []);

  /** Start a toast's exit, telling its owner it has gone. Once only. */
  const dismiss = useCallback((id: number) => {
    setEntries((current) => {
      const entry = current.find((e) => e.id === id);
      if (entry === undefined || entry.leaving) return current;
      return current.map((e) => (e.id === id ? { ...e, leaving: true } : e));
    });
  }, []);

  const remove = useCallback((id: number) => {
    setEntries((current) => current.filter((e) => e.id !== id));
  }, []);

  const show = useCallback((element: ReactElement<ToastProps>) => {
    if (!isValidElement(element)) return;
    const id = nextId.current++;
    setEntries((current) => {
      const next = [...current, { id, element, leaving: false }];
      // At most three on screen: the oldest that is not already leaving
      // leaves early to make room.
      let staying = next.filter((e) => !e.leaving).length;
      return next.map((e) => {
        if (staying > MAX_VISIBLE && !e.leaving) {
          staying -= 1;
          return { ...e, leaving: true };
        }
        return e;
      });
    });
  }, []);

  // onDismiss fires as a toast STARTS leaving, from an effect rather than
  // inside the state updater, so it runs once even under StrictMode.
  const reported = useRef(new Set<number>());
  useEffect(() => {
    for (const entry of entries) {
      if (entry.leaving && !reported.current.has(entry.id)) {
        reported.current.add(entry.id);
        entry.element.props.onDismiss?.();
      }
    }
  }, [entries]);

  const api = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastApiContext.Provider value={api}>
      {children}
      <div
        ref={regionRef}
        className="rata-toast-region"
        popover="manual"
        role="status"
        // Named so it can be found by landmark navigation.
        aria-label="Notifications"
        // role="status" is atomic by default, which would re-read every toast
        // in the stack each time one arrives. Each is announced on its own.
        aria-atomic="false"
      >
        {entries.map((entry) => (
          <ToastSlotContext.Provider
            key={entry.id}
            value={{
              leaving: entry.leaving,
              dismiss: () => dismiss(entry.id),
              remove: () => remove(entry.id),
              hidden,
            }}
          >
            {entry.element}
          </ToastSlotContext.Provider>
        ))}
      </div>
    </ToastApiContext.Provider>
  );
}

/**
 * A brief, polite confirmation of something the reader just did. Shown with
 * `useToast().show(<Toast>…</Toast>)`, never rendered in place.
 *
 * Focus never moves to a toast. It can only arrive because the reader put it
 * there — Tab to Undo, say — and if the toast leaves while holding it, focus
 * goes back where it came from rather than falling to the body.
 */
export function Toast({
  children,
  variant = "neutral",
  action,
  duration = 6000,
  onDismiss,
  dismissLabel = "Dismiss",
}: ToastProps) {
  const slot = useContext(ToastSlotContext);
  const ref = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const remaining = useRef(duration);

  const leaving = slot?.leaving ?? false;
  const paused = hovered || focusInside || (slot?.hidden ?? false);

  // The countdown. Pausing keeps what is left, so a reader who hovered for a
  // while does not come back to a fresh six seconds — or to none.
  useEffect(() => {
    if (slot === null || duration === null || paused || leaving) return;
    const started = Date.now();
    const timer = window.setTimeout(slot.dismiss, Math.max(0, remaining.current ?? 0));
    return () => {
      window.clearTimeout(timer);
      if (remaining.current !== null) remaining.current -= Date.now() - started;
    };
    // `slot` is rebuilt on every region render; its callbacks are stable in
    // what they do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, paused, leaving]);

  // Leaving: give focus back if it was here, then remove once the exit has
  // played. With reduced motion there is no exit animation, so it goes now.
  useEffect(() => {
    if (!leaving || slot === null) return;
    const node = ref.current;
    if (node?.contains(document.activeElement)) {
      const target = returnFocus.current;
      if (target?.isConnected) target.focus();
      else (document.activeElement as HTMLElement | null)?.blur();
    }
    const animations = node?.getAnimations?.() ?? [];
    if (animations.length === 0) {
      slot.remove();
      return;
    }
    let cancelled = false;
    Promise.all(animations.map((a) => a.finished))
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) slot.remove();
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  const glyph = VARIANT_ICON[variant];
  const close = () => {
    if (slot !== null) slot.dismiss();
    else onDismiss?.();
  };

  return (
    <div
      ref={ref}
      className={cx("rata-toast", `rata-toast--${variant}`, leaving && "rata-toast--leaving")}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={(event: FocusEvent<HTMLDivElement>) => {
        const from = event.relatedTarget as HTMLElement | null;
        if (from !== null && !event.currentTarget.contains(from)) returnFocus.current = from;
        setFocusInside(true);
      }}
      onBlur={(event: FocusEvent<HTMLDivElement>) => {
        const to = event.relatedTarget as Node | null;
        if (to === null || !event.currentTarget.contains(to)) setFocusInside(false);
      }}
    >
      {glyph && <Icon icon={glyph} className="rata-toast-icon" />}

      {/* A paragraph, as in Notice: the message is one sentence of text. */}
      <p className="rata-toast-message">{children}</p>

      {action !== undefined && (
        <Button
          variant="secondary"
          size="sm"
          className="rata-toast-action"
          onClick={() => {
            action.onAction();
            close();
          }}
        >
          {action.label}
        </Button>
      )}

      <button
        type="button"
        /* Notice's dismiss control, unchanged. --flush because it has no
           border of its own. */
        className="rata-toast-dismiss rata-state-layer rata-state-layer--flush"
        aria-label={dismissLabel}
        onClick={close}
      >
        <Icon icon={X} />
      </button>
    </div>
  );
}
