'use client';

/**
 * Toast system — Linear / Resend / Vercel pattern, AlignUI-themed.
 *
 * Design notes:
 * - Anchored bottom-right (off-canvas safe-area aware via tailwind insets).
 * - Width: 360px. Each toast is a self-contained card with a tinted
 *   leading-icon disc, title, optional description, optional action, and
 *   a close button.
 * - Tone colors mirror our Badge component (success/error/warning/info/
 *   feature/primary) — saturated icon, soft rgba background tint, dark
 *   semantic text. AlignUI-aligned, anti-AI-slop.
 * - Motion: AnimatePresence with emphasized-decel easing. Enters
 *   sliding up from below (+ small scale-in), exits sliding right with
 *   a soft fade. Stacks newer-on-top with reverse-order rendering.
 * - Auto-dismiss after 5s (override via `duration`); `loading` variant
 *   never auto-dismisses. Hovering the stack pauses every timer.
 * - Imperative API mirrors `sonner`/`react-hot-toast`:
 *     const t = useToast();
 *     t.success('Saved');
 *     t.error('Failed', { description: 'Try again' });
 *     const id = t.loading('Saving…');
 *     t.update(id, { variant: 'success', title: 'Saved' });
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  Check,
  Info,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────

export type ToastVariant =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'feature'
  | 'loading';

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  /** Auto-dismiss in ms. Default 5000. `loading` defaults to Infinity. */
  duration?: number;
  /** Optional action button — appears on the right of the toast body. */
  action?: { label: string; onClick: () => void };
}

interface Toast extends Required<Pick<ToastOptions, 'variant'>> {
  id: string;
  title: string;
  description?: string;
  duration: number;
  action?: ToastOptions['action'];
  createdAt: number;
}

interface ToastContextValue {
  push: (title: string, opts?: ToastOptions) => string;
  update: (id: string, opts: ToastOptions) => void;
  dismiss: (id: string) => void;
  success: (title: string, opts?: Omit<ToastOptions, 'variant'>) => string;
  error: (title: string, opts?: Omit<ToastOptions, 'variant'>) => string;
  warning: (title: string, opts?: Omit<ToastOptions, 'variant'>) => string;
  info: (title: string, opts?: Omit<ToastOptions, 'variant'>) => string;
  feature: (title: string, opts?: Omit<ToastOptions, 'variant'>) => string;
  loading: (title: string, opts?: Omit<ToastOptions, 'variant'>) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ── Variant styling — halo + saturated disc + white knockout glyph ─────────
// Pattern from Sonner / Vercel toasts / Linear: a soft outer halo (24px,
// low-alpha tint) frames a saturated semantic-color disc (18px) with a
// crisp white glyph (11px, stroke 3) centered inside. Loading is the
// exception — no inner disc, just the halo with a primary-color spinner
// so it doesn't read as a "completed" state.

type IconVariantStyle = {
  halo: string;
  disc: string;
  Icon: typeof Check;
};

const variantStyles: Record<ToastVariant, IconVariantStyle> = {
  success: {
    halo: 'rgba(31, 193, 107, 0.18)',
    disc: 'var(--success)',
    Icon: Check,
  },
  error: {
    halo: 'rgba(251, 55, 72, 0.16)',
    disc: 'var(--error)',
    Icon: X,
  },
  warning: {
    halo: 'rgba(246, 181, 30, 0.22)',
    disc: 'var(--warning)',
    Icon: AlertTriangle,
  },
  info: {
    halo: 'rgba(51, 92, 255, 0.14)',
    disc: 'var(--information)',
    Icon: Info,
  },
  feature: {
    halo: 'rgba(125, 82, 244, 0.16)',
    disc: 'var(--feature)',
    Icon: Sparkles,
  },
  loading: {
    // Loading uses only the halo — the spinner replaces the inner disc.
    halo: 'rgba(250, 115, 25, 0.16)',
    disc: 'transparent',
    Icon: Loader2,
  },
};

// ── Provider ────────────────────────────────────────────────────────────────

let _nextId = 0;
const nextId = () => `t${++_nextId}`;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paused, setPaused] = useState(false);
  const timers = useRef<Map<string, number>>(new Map());

  const clearTimer = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) {
      window.clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [clearTimer],
  );

  const scheduleDismiss = useCallback(
    (id: string, duration: number) => {
      if (duration === Infinity || duration <= 0) return;
      clearTimer(id);
      const handle = window.setTimeout(() => dismiss(id), duration);
      timers.current.set(id, handle);
    },
    [clearTimer, dismiss],
  );

  // Pause / resume all timers based on hover state of the viewport stack.
  // Re-schedule remaining time on resume — keeps the UX correct.
  const pausedAt = useRef<number | null>(null);
  useEffect(() => {
    if (paused) {
      pausedAt.current = Date.now();
      timers.current.forEach((handle) => window.clearTimeout(handle));
      timers.current.clear();
    } else if (pausedAt.current != null) {
      const pauseDuration = Date.now() - pausedAt.current;
      pausedAt.current = null;
      setToasts((curr) =>
        curr.map((t) => ({ ...t, createdAt: t.createdAt + pauseDuration })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  // When unpaused, re-arm timers for whatever time is remaining.
  useEffect(() => {
    if (paused) return;
    const now = Date.now();
    toasts.forEach((t) => {
      if (timers.current.has(t.id)) return;
      if (t.duration === Infinity) return;
      const elapsed = now - t.createdAt;
      const remaining = Math.max(0, t.duration - elapsed);
      scheduleDismiss(t.id, remaining);
    });
    return () => {
      // No cleanup — timers are managed by dismiss/clearTimer paths.
    };
  }, [paused, toasts, scheduleDismiss]);

  const push = useCallback(
    (title: string, opts: ToastOptions = {}) => {
      const id = nextId();
      const variant: ToastVariant = opts.variant ?? 'info';
      const duration =
        opts.duration ?? (variant === 'loading' ? Infinity : 5000);
      const toast: Toast = {
        id,
        title,
        description: opts.description,
        variant,
        duration,
        action: opts.action,
        createdAt: Date.now(),
      };
      setToasts((prev) => [...prev, toast]);
      scheduleDismiss(id, duration);
      return id;
    },
    [scheduleDismiss],
  );

  const update = useCallback(
    (id: string, opts: ToastOptions) => {
      setToasts((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const variant = opts.variant ?? t.variant;
          const duration =
            opts.duration ??
            (variant === 'loading'
              ? Infinity
              : variant !== t.variant
                ? 5000
                : t.duration);
          return {
            ...t,
            ...opts,
            title: opts.title ?? t.title,
            variant,
            duration,
            createdAt: Date.now(),
          };
        }),
      );
      // Re-arm the timer for the (possibly new) duration.
      const newDuration =
        opts.duration ??
        (opts.variant === 'loading' ? Infinity : 5000);
      scheduleDismiss(id, newDuration);
    },
    [scheduleDismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      update,
      dismiss,
      success: (title, opts) => push(title, { ...opts, variant: 'success' }),
      error: (title, opts) => push(title, { ...opts, variant: 'error' }),
      warning: (title, opts) => push(title, { ...opts, variant: 'warning' }),
      info: (title, opts) => push(title, { ...opts, variant: 'info' }),
      feature: (title, opts) => push(title, { ...opts, variant: 'feature' }),
      loading: (title, opts) => push(title, { ...opts, variant: 'loading' }),
    }),
    [push, update, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport
        toasts={toasts}
        onDismiss={dismiss}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      />
    </ToastContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside a <ToastProvider>');
  }
  return ctx;
}

// ── Viewport (portal-rendered stack) ────────────────────────────────────────

const EASE_EMPH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

function ToastViewport({
  toasts,
  onDismiss,
  onMouseEnter,
  onMouseLeave,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  // Render to <body> via portal so the viewport escapes any stacking
  // contexts the app creates (sticky topbar, sidebar drawer, etc.).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <ol
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      // Bottom-right on lg+; bottom-centered on small screens so the
      // toasts don't fight the page padding or hug the edge awkwardly.
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-4 sm:bottom-4 sm:right-4 sm:left-auto sm:items-end sm:px-0 sm:pb-0"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
        ))}
      </AnimatePresence>
    </ol>,
    document.body,
  );
}

// ── Single card ─────────────────────────────────────────────────────────────

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const reduce = useReducedMotion();
  const { halo, disc, Icon } = variantStyles[toast.variant];
  const isLoading = toast.variant === 'loading';
  // Warning's AlertTriangle reads better at a slightly smaller size — the
  // triangle's bounding box is wider than the others, so 10px keeps it
  // visually balanced inside the 18px disc.
  const glyphPx = toast.variant === 'warning' ? 10 : 11;

  return (
    <motion.li
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={
        reduce
          ? { opacity: 0 }
          : { opacity: 0, x: 24, scale: 0.96, transition: { duration: 0.18 } }
      }
      transition={{ duration: 0.24, ease: EASE_EMPH }}
      role="status"
      className={cn(
        'pointer-events-auto w-full max-w-[380px] sm:w-[360px]',
        // Single-line toasts (no description) use `items-center` so the
        // icon disc and the title text align on the same horizontal axis.
        // Multi-line toasts (with description) keep `items-start` so the
        // icon anchors to the title's top row instead of floating mid-card.
        'flex gap-3 rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-3.5 pr-2.5',
        toast.description ? 'items-start' : 'items-center',
        'shadow-[0_8px_24px_rgba(23,23,23,0.10),0_2px_6px_rgba(23,23,23,0.05)]',
      )}
    >
      {/* Leading icon — halo + saturated disc + white knockout glyph.
          Outer 24×24 span anchors the layout; inside, an absolute-
          positioned halo sits behind a relatively-positioned inner disc
          (so the glyph stays crisply centered with no math). */}
      <span
        className="relative mt-[1px] inline-flex h-6 w-6 shrink-0 items-center justify-center"
        aria-hidden
      >
        {/* Soft outer halo — extends the full 24×24 footprint */}
        <span
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: halo }}
        />

        {isLoading ? (
          // Loading: no inner disc — just the halo with a spinner in the
          // primary brand color, so it reads as "in progress" rather than
          // "completed in primary".
          <Loader2
            className="relative h-[14px] w-[14px] animate-spin"
            strokeWidth={2.5}
            style={{ color: 'var(--primary-base)' }}
          />
        ) : (
          // Saturated 18×18 disc with a centered white knockout glyph.
          <span
            className="relative inline-flex h-[18px] w-[18px] items-center justify-center rounded-full"
            style={{ backgroundColor: disc }}
          >
            <Icon
              className="text-white"
              style={{ width: glyphPx, height: glyphPx }}
              strokeWidth={3}
            />
          </span>
        )}
      </span>

      {/* Body */}
      <div className="min-w-0 flex-1 pt-[1px]">
        <p className="text-[13.5px] font-semibold leading-[1.35] tracking-[-0.01em] text-[var(--neutral-strong-950)]">
          {toast.title}
        </p>
        {toast.description && (
          <p className="mt-0.5 text-[12.5px] leading-[1.45] text-[var(--neutral-sub-600)]">
            {toast.description}
          </p>
        )}
      </div>

      {/* Trailing action + close */}
      <div className="flex shrink-0 items-center gap-1">
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss();
            }}
            className="rounded-[7px] px-2 py-1 text-[12px] font-medium text-[var(--primary-base)] transition-colors hover:bg-[var(--primary-alpha-10)]"
          >
            {toast.action.label}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded-[7px] p-1 text-[var(--neutral-soft-400)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </motion.li>
  );
}
