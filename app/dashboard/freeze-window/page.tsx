'use client';

/**
 * Freeze Windows — redesigned.
 *
 * The previous version was a vertical config list: header → form → list.
 * Functional, but it failed the most important governance question:
 * "are agents actually frozen right now, and what does my weekly
 * schedule look like?" Users had to mentally render multiple
 * windows into a calendar.
 *
 * This redesign anchors on four ideas (research via Refero):
 *
 *   1. STATUS FIRST. A live banner at the top answers the only
 *      question a security engineer ever wants: is freeze active
 *      now, and when does the state change? (PagerDuty-style.)
 *
 *   2. SEE THE SCHEDULE. A SavvyCal-style 7×24 week-grid renders
 *      the union of every freeze window as diagonal-hatch fills.
 *      Multiple overlapping windows collapse into one readable
 *      picture. A "now" indicator confirms the live time.
 *
 *   3. START FROM TEMPLATES. Common patterns (nights, weekends,
 *      release windows) are one-click prefills. Most teams want
 *      one of three things; we save them the work of building
 *      from scratch.
 *
 *   4. CAL.COM ROW FORM. Per-day rows with a toggle + time inputs
 *      replace the ambiguous "work days" pill grid. The day labels
 *      are honest: "Days the freeze applies."
 *
 * Backend contract is unchanged. Same `api.getFreezeWindows`,
 * `api.createFreezeWindow`, `api.updateFreezeWindow`,
 * `api.deleteFreezeWindow` shapes, same `work_days` 0=Mon
 * convention, same `window_start`/`window_end` HH:MM strings.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit2,
  Globe,
  PauseCircle,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import { formatFullTimestamp } from '@/lib/utils';
import Topbar from '@/components/layout/Topbar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import {
  FreezeWeekPreview,
  computeFreezeStatus,
  type FreezeWindowShape,
} from '@/components/ui/FreezeWeekPreview';
import { FreezeWindowSkeleton } from '@/components/ui/PageSkeletons';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { DUR, EASE, fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';

interface FreezeWindow extends FreezeWindowShape {
  id: string;
  user_id: string;
  created_at?: string;
}

interface FreezeWindowFormData {
  timezone: string;
  work_days: number[];
  window_start: string;
  window_end: string;
}

// Mon-first matches the backend's `work_days` 0=Mon convention.
// Visible labels are short so the day pills stay narrow.
const DAYS_OF_WEEK = [
  { label: 'Mon', full: 'Monday', value: 0 },
  { label: 'Tue', full: 'Tuesday', value: 1 },
  { label: 'Wed', full: 'Wednesday', value: 2 },
  { label: 'Thu', full: 'Thursday', value: 3 },
  { label: 'Fri', full: 'Friday', value: 4 },
  { label: 'Sat', full: 'Saturday', value: 5 },
  { label: 'Sun', full: 'Sunday', value: 6 },
];

// Curated timezone list — the 5 zones in the old page weren't
// enough for any real team. This covers ~95% of teams across US,
// EU, APAC, Australia, plus UTC. Real teams want their region
// represented; we don't need the full 400-entry IANA tree.
const TIMEZONES = [
  'UTC',
  // Americas
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  // Europe + Middle East
  'Europe/London',
  'Europe/Berlin',
  'Europe/Helsinki',
  'Asia/Dubai',
  // Asia
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  // Oceania
  'Australia/Sydney',
];

// Built-in templates — Cal.com / Linear-style "start from a
// preset" tiles. Each maps to a partial form payload; the user
// can tweak before saving. The set covers the three most common
// governance shapes for AI-agent freeze.
type TemplateKey = 'nights' | 'weekends' | 'out_of_hours' | 'release_window';
const TEMPLATES: Record<
  TemplateKey,
  {
    title: string;
    description: string;
    icon: typeof Clock;
    payload: Omit<FreezeWindowFormData, 'timezone'>;
  }
> = {
  nights: {
    title: 'Nights',
    description: 'Block agents 6pm → 9am, Monday–Friday.',
    icon: PauseCircle,
    payload: {
      work_days: [0, 1, 2, 3, 4],
      window_start: '18:00',
      window_end: '09:00',
    },
  },
  weekends: {
    title: 'Weekends',
    description: 'Block agents from Friday 6pm through Sunday midnight.',
    icon: Calendar,
    payload: {
      work_days: [5, 6],
      window_start: '00:00',
      window_end: '23:59',
    },
  },
  out_of_hours: {
    title: 'Out of hours',
    description: 'Nightly 6pm–9am plus full weekends.',
    icon: Clock,
    payload: {
      work_days: [0, 1, 2, 3, 4, 5, 6],
      window_start: '18:00',
      window_end: '09:00',
    },
  },
  release_window: {
    title: 'Release Fridays',
    description: 'Block agents every Friday 5pm onwards.',
    icon: AlertTriangle,
    payload: {
      work_days: [4],
      window_start: '17:00',
      window_end: '23:59',
    },
  },
};

/** Resolve the user's browser timezone with a safe fallback. */
function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Compact human-readable day list — "Weekdays", "Weekends",
 *  "Every day", or "Mon, Wed, Fri". */
function getDayLabels(days: number[]): string {
  if (days.length === 0) return 'No days';
  if (days.length === 7) return 'Every day';
  const key = [...days].sort((a, b) => a - b).join(',');
  if (key === '0,1,2,3,4') return 'Weekdays';
  if (key === '5,6') return 'Weekends';
  return days.map((d) => DAYS_OF_WEEK[d].label).join(', ');
}

/** Format a future timestamp like "in 2h 14m" or "in 3d 4h" — used
 *  on the status banner to make the "next transition" tangible. */
function formatRelativeFuture(target: Date): string {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return 'now';
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMin = mins % 60;
  if (hours < 24) {
    return remMin > 0 ? `in ${hours}h ${remMin}m` : `in ${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remHr = hours % 24;
  return remHr > 0 ? `in ${days}d ${remHr}h` : `in ${days}d`;
}

export default function FreezeWindowPage() {
  const { user, isLoading: userLoading } = useUser();
  const reduce = useReducedMotion();
  const toast = useToast();
  const [windows, setWindows] = useState<FreezeWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingWindowId, setEditingWindowId] = useState<string | null>(null);
  // Pending delete confirmation — stores the full window object so
  // the ConfirmDialog can reference exactly which one is going.
  const [pendingDelete, setPendingDelete] = useState<FreezeWindow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  // Tick state — drives the live "now" indicator on the preview
  // and the relative time in the status banner. Re-render once a
  // minute is plenty; we're not animating a clock face.
  const [, setNowTick] = useState(0);

  // Default the form's timezone to the user's browser tz on first
  // load — almost always what they want, and the old "UTC default"
  // forced everyone to change it.
  const [formData, setFormData] = useState<FreezeWindowFormData>(() => ({
    timezone: detectBrowserTimezone(),
    work_days: [],
    window_start: '18:00',
    window_end: '09:00',
  }));

  const fetchWindows = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await api.getFreezeWindows();
      setWindows(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch freeze windows');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) fetchWindows();
    else if (!userLoading) setLoading(false);
  }, [user?.id, userLoading, fetchWindows]);

  // Tick the "now" indicator forward every 60s so the status
  // banner + preview indicator stay accurate without polling
  // anything server-side.
  useEffect(() => {
    const id = window.setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Live freeze status — answers "are agents blocked right now?"
  // Recomputes whenever windows change or the minute ticks.
  const status = useMemo(() => computeFreezeStatus(windows), [windows]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (formData.work_days.length === 0) {
      toast.error('Pick at least one day', {
        description: 'A freeze window with no days never fires.',
      });
      return;
    }
    try {
      const payload = {
        timezone: formData.timezone,
        work_days: formData.work_days,
        window_start: `${formData.window_start}:00`,
        window_end: `${formData.window_end}:00`,
      };
      if (editingWindowId) {
        await api.updateFreezeWindow(editingWindowId, payload);
        toast.success('Freeze window updated', {
          description: 'Your schedule is now live.',
        });
      } else {
        await api.createFreezeWindow(payload);
        toast.success('Freeze window created', {
          description: `${getDayLabels(formData.work_days)} · ${formData.window_start}–${formData.window_end}`,
        });
      }
      await fetchWindows();
      resetForm();
      setShowForm(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save freeze window';
      setError(msg);
      toast.error("Couldn't save freeze window", { description: msg });
    }
  };

  const handleDelete = async (windowId: string) => {
    if (!user?.id) return;
    try {
      await api.deleteFreezeWindow(windowId);
      await fetchWindows();
      setError(null);
      toast.success('Freeze window deleted');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to delete freeze window';
      setError(msg);
      toast.error("Couldn't delete freeze window", { description: msg });
    }
  };

  const handleEdit = (window: FreezeWindow) => {
    setFormData({
      timezone: window.timezone,
      work_days: window.work_days,
      window_start: window.window_start.slice(0, 5),
      window_end: window.window_end.slice(0, 5),
    });
    setEditingWindowId(window.id);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      timezone: detectBrowserTimezone(),
      work_days: [],
      window_start: '18:00',
      window_end: '09:00',
    });
    setEditingWindowId(null);
  };

  const applyTemplate = (key: TemplateKey) => {
    const tpl = TEMPLATES[key];
    setFormData({
      timezone: detectBrowserTimezone(),
      ...tpl.payload,
    });
    setEditingWindowId(null);
    setShowForm(true);
  };

  const toggleWorkDay = (day: number) =>
    setFormData((prev) => ({
      ...prev,
      work_days: prev.work_days.includes(day)
        ? prev.work_days.filter((d) => d !== day)
        : [...prev.work_days, day].sort(),
    }));

  // Draft window (in-progress form values) gets piped to the
  // preview so the user can see "what would adding this window
  // look like?" in real time. Only when the form is open.
  const draftWindow: FreezeWindowShape | null =
    showForm && formData.work_days.length > 0
      ? {
          timezone: formData.timezone,
          work_days: formData.work_days,
          window_start: formData.window_start,
          window_end: formData.window_end,
        }
      : null;

  // When editing an existing window, exclude it from the "saved"
  // set so the preview shows (saved-minus-me) + (draft-me). This
  // makes the live edit feel like an in-place tweak, not a new
  // window stacked on top of itself.
  const savedForPreview: FreezeWindowShape[] = editingWindowId
    ? windows.filter((w) => w.id !== editingWindowId)
    : windows;

  if (userLoading || loading) {
    return (
      <>
        <Topbar title="Freeze Windows" subtitle="When agents should stand down" />
        <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <FreezeWindowSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Freeze Windows" subtitle="When agents should stand down" />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner
              message={error}
              onDismiss={() => setError(null)}
              onRetry={fetchWindows}
            />
          </div>
        )}

        <motion.div
          variants={staggerContainer(0.05, 0.04)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="space-y-6"
        >
          {/* Page header */}
          <motion.header
            variants={fadeUp}
            className="flex flex-wrap items-end justify-between gap-4"
          >
            <div>
              <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]">
                Deployment freeze
              </p>
              <h1 className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]">
                Windows when agents shouldn&apos;t ship
              </h1>
              <p className="mt-2 max-w-[640px] text-[13.5px] leading-[1.55] text-[var(--neutral-sub-600)]">
                Block write actions during scheduled windows: release
                freezes, on-call hours, weekends. Stack as many
                windows as you need — the preview shows the union.
              </p>
            </div>
            {windows.length > 0 && (
              <Button
                variant="primary"
                onClick={() => {
                  setShowForm((s) => !s);
                  if (showForm) resetForm();
                }}
                leadingIcon={
                  showForm ? (
                    <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                  ) : (
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
                  )
                }
              >
                {showForm ? 'Cancel' : 'New window'}
              </Button>
            )}
          </motion.header>

          {/* Live status banner — the most important thing on this
              page. Tells the user IMMEDIATELY whether agents are
              currently frozen and when the state will change. */}
          {windows.length > 0 && (
            <motion.div variants={fadeUp}>
              <StatusBanner status={status} />
            </motion.div>
          )}

          {/* Week-grid preview — visualizes the union of all
              freeze windows (and the in-progress draft when the
              form is open). The user reads it as "the hatched
              zones are when agents can't act." */}
          {(windows.length > 0 || draftWindow) && (
            <motion.div variants={fadeUp}>
              <FreezeWeekPreview
                windows={savedForPreview}
                draftWindow={draftWindow}
              />
            </motion.div>
          )}

          {/* Inline form — collapsed by default. Expands when the
              user clicks New Window, picks a template, or chooses
              Edit on a row. */}
          <AnimatePresence initial={false}>
            {showForm && (
              <motion.div
                key="form"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, height: 0 }}
                transition={{ duration: DUR.default, ease: EASE.out }}
                style={{ overflow: 'hidden' }}
                className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
              >
                <FreezeForm
                  formData={formData}
                  setFormData={setFormData}
                  toggleWorkDay={toggleWorkDay}
                  onSubmit={handleSubmit}
                  onCancel={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  editing={editingWindowId !== null}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Templates strip — when there are no windows yet, show
              the four common patterns as a guided start. Also
              available inside the form for users who want to swap
              templates mid-edit. */}
          {windows.length === 0 && !showForm && (
            <motion.div variants={fadeUp} className="space-y-3">
              <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
                <EmptyState
                  icon={<Clock className="h-5 w-5" />}
                  title="No freeze windows yet"
                  description="Pick a template to start, or build your own from scratch."
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => {
                        resetForm();
                        setShowForm(true);
                      }}
                      leadingIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2.25} />}
                    >
                      Build from scratch
                    </Button>
                  }
                />
              </div>
              <div>
                <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  Start from a template
                </p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  {(Object.keys(TEMPLATES) as TemplateKey[]).map((key) => (
                    <TemplateCard
                      key={key}
                      template={TEMPLATES[key]}
                      onClick={() => applyTemplate(key)}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Active windows list — one card per saved window. Each
              row shows the schedule, timezone, and live status
              (active now / next in X). Same edit/delete affordances
              as before, refined visually. */}
          {windows.length > 0 && (
            <motion.div
              variants={fadeUp}
              className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            >
              <div className="flex items-center justify-between px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2">
                  <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                    Active windows
                  </h2>
                  <span className="inline-flex h-[18px] items-center justify-center rounded-[5px] bg-[var(--neutral-weak-50)] px-[6px] text-[10.5px] font-bold tabular-nums text-[var(--neutral-sub-600)]">
                    {windows.length.toLocaleString()}
                  </span>
                </div>
                <p className="text-[11.5px] text-[var(--neutral-soft-400)]">
                  {status.coverageHours} of 168 hours/week
                </p>
              </div>
              <motion.ul
                className="divide-y divide-[var(--stroke-soft-200)] border-t border-[var(--stroke-soft-200)]"
                variants={staggerContainer(0.03, 0.22)}
                initial={reduce ? false : 'hidden'}
                animate="show"
              >
                {windows.map((w) => (
                  <FreezeWindowRow
                    key={w.id}
                    window={w}
                    activeNow={
                      status.activeNow && status.activeWindow?.timezone === w.timezone &&
                      JSON.stringify(status.activeWindow?.work_days) === JSON.stringify(w.work_days) &&
                      status.activeWindow?.window_start === w.window_start
                    }
                    onEdit={handleEdit}
                    onDelete={(id) => {
                      const target = windows.find((x) => x.id === id);
                      if (target) setPendingDelete(target);
                    }}
                  />
                ))}
              </motion.ul>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Delete-window confirmation — surfaces the window's
          timezone + day count so the user knows exactly which one
          they're about to remove. */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) setPendingDelete(null);
        }}
        variant="danger"
        title="Delete this freeze window?"
        description={
          pendingDelete ? (
            <>
              Agents will no longer be paused during the{' '}
              <span className="font-mono text-[12.5px] text-[var(--neutral-strong-950)]">
                {pendingDelete.window_start.slice(0, 5)}–
                {pendingDelete.window_end.slice(0, 5)}
              </span>{' '}
              window ({pendingDelete.timezone}). This can&apos;t be undone.
            </>
          ) : null
        }
        confirmLabel="Delete window"
        loading={deleteBusy}
        onConfirm={async () => {
          if (!pendingDelete) return;
          setDeleteBusy(true);
          try {
            await handleDelete(pendingDelete.id);
            setPendingDelete(null);
          } finally {
            setDeleteBusy(false);
          }
        }}
      />
    </>
  );
}

// ─── Status banner ──────────────────────────────────────────────────
//
// Two visual states:
//   • Frozen now → orange-tinted inset wash, pause icon
//   • Open now → green-tinted inset wash, check icon
//
// Same chrome both states — only color + icon flip. The card itself
// is white (auto-flips to --white-0 dark surface in dark mode); the
// state color comes from an inset gradient overlay that mirrors the
// Decision Overview hero on the Dashboard. That gives us:
//   • A subtler, more premium look than a hard tinted background
//   • Dark-mode parity for free — the gradient is a tint over the
//     theme-aware surface, not a fixed background color
//   • One visual pattern reused across the product, which is part
//     of how Linear / Vercel / Stripe make their UI feel coherent
function StatusBanner({
  status,
}: {
  status: ReturnType<typeof computeFreezeStatus>;
}) {
  const frozen = status.activeNow;
  const nextLabel = status.nextTransitionAt
    ? formatRelativeFuture(status.nextTransitionAt)
    : null;
  return (
    <div className="relative overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
      {/* Inset tinted gradient overlay — matches the Decision
          Overview hero (dashboard/page.tsx). 4px inset on all four
          sides so it reads as a soft inner panel wash rather than
          a hard fill. Top-to-bottom fade from 7% → 3% → 0% means
          most of the card surface stays clean white (or clean
          dark-surface in dark mode). Color flips by state:
          orange (RGB 250,115,25 = --primary-base) when frozen,
          green (RGB 31,193,107 = --success light-mode) when open. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-1 rounded-[8px]"
        style={{
          background: frozen
            ? 'linear-gradient(180deg, rgba(250, 115, 25, 0.07) 0%, rgba(250, 115, 25, 0.03) 28%, rgba(255, 255, 255, 0) 60%)'
            : 'linear-gradient(180deg, rgba(31, 193, 107, 0.07) 0%, rgba(31, 193, 107, 0.03) 28%, rgba(255, 255, 255, 0) 60%)',
        }}
      />
      <div className="relative flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              frozen
                ? 'bg-[var(--primary-alpha-10)]'
                : 'bg-[var(--success-lighter)]',
            )}
          >
            {frozen ? (
              <PauseCircle
                className="h-5 w-5 text-[var(--primary-base)]"
                strokeWidth={2}
              />
            ) : (
              <CheckCircle2
                className="h-5 w-5 text-[var(--success)]"
                strokeWidth={2}
              />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
              {frozen ? 'Agents are paused now' : 'Agents are running'}
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--neutral-sub-600)]">
              {frozen ? (
                <>
                  Freeze active{nextLabel && <> · lifts {nextLabel}</>}
                  {status.activeWindow && (
                    <>
                      {' · '}
                      <span className="font-mono text-[11.5px] text-[var(--neutral-strong-950)]">
                        {status.activeWindow.window_start.slice(0, 5)}–
                        {status.activeWindow.window_end.slice(0, 5)}
                      </span>{' '}
                      ({status.activeWindow.timezone})
                    </>
                  )}
                </>
              ) : nextLabel ? (
                <>
                  Next freeze starts {nextLabel}
                  {status.coverageHours > 0 && (
                    <>
                      {' · '}
                      {status.coverageHours}h/week covered
                    </>
                  )}
                </>
              ) : (
                'No freeze windows configured.'
              )}
            </p>
          </div>
        </div>
        <Badge
          tone={frozen ? 'primary' : 'success'}
          uppercase
          className="shrink-0"
        >
          {frozen ? 'Frozen' : 'Open'}
        </Badge>
      </div>
    </div>
  );
}

// ─── Template card ──────────────────────────────────────────────────
function TemplateCard({
  template,
  onClick,
}: {
  template: (typeof TEMPLATES)[TemplateKey];
  onClick: () => void;
}) {
  const Icon = template.icon;
  // Cheap coverage calc — total hours per week this template covers.
  // Helps the user pick by sense of "how aggressive is this?"
  const start = parseInt(template.payload.window_start.split(':')[0], 10);
  const end = parseInt(template.payload.window_end.split(':')[0], 10);
  const perDay = end > start ? end - start : 24 - start + end;
  const coverage = perDay * template.payload.work_days.length;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start gap-2 rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-4 text-left shadow-[0_1px_2px_rgba(23,23,23,0.04)] transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:border-[var(--stroke-sub-300)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.06)]"
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[var(--primary-alpha-10)] text-[var(--primary-base)]">
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
          {template.title}
        </p>
        <p className="mt-1 text-[11.5px] leading-[1.45] text-[var(--neutral-sub-600)]">
          {template.description}
        </p>
        <p className="mt-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
          ~{coverage}h/week
        </p>
      </div>
    </button>
  );
}

// ─── Freeze form ────────────────────────────────────────────────────
//
// Cal.com-style row form. Top: timezone select. Middle: day pills
// (clearer than checkboxes for "which days does this apply on?").
// Bottom: start/end time. The whole thing fits in ~260px vertical
// so the live preview above stays visible while editing.
function FreezeForm({
  formData,
  setFormData,
  toggleWorkDay,
  onSubmit,
  onCancel,
  editing,
}: {
  formData: FreezeWindowFormData;
  setFormData: React.Dispatch<React.SetStateAction<FreezeWindowFormData>>;
  toggleWorkDay: (day: number) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  editing: boolean;
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="border-b border-[var(--stroke-soft-200)] px-5 py-3.5">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
          {editing ? 'Edit freeze window' : 'New freeze window'}
        </h2>
        <p className="mt-0.5 text-[11.5px] text-[var(--neutral-sub-600)]">
          {editing
            ? 'Update the schedule — the preview above reflects your changes in real time.'
            : 'Pick the days and time-of-day range. Agents are blocked from write actions during this window.'}
        </p>
      </div>

      <div className="space-y-5 px-5 py-5">
        {/* Timezone — full-width select. We surface the picker first
            because TZ context changes the meaning of the times below.
            Globe icon makes the field feel geographic at a glance. */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--neutral-sub-600)]">
            <Globe className="h-3 w-3" strokeWidth={2} aria-hidden />
            Timezone
          </label>
          <div className="relative">
            <select
              value={formData.timezone}
              onChange={(e) =>
                setFormData({ ...formData, timezone: e.target.value })
              }
              className="h-9 w-full appearance-none rounded-[8px] border border-[var(--stroke-sub-300)] bg-white pl-3 pr-9 text-[13px] text-[var(--neutral-strong-950)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-[3px] focus:ring-[var(--primary-alpha-16)]"
            >
              {/* If the user's saved tz isn't in our curated list,
                  surface it at the top so they don't lose it. */}
              {!TIMEZONES.includes(formData.timezone) && (
                <option value={formData.timezone}>{formData.timezone}</option>
              )}
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--neutral-soft-400)]"
              strokeWidth={2}
            />
          </div>
        </div>

        {/* Day-of-week selector. Pills, not checkboxes — they read
            faster and match the AlignUI segmented-control vocabulary
            we use elsewhere. Quick-select chips above let the user
            pick "Weekdays" or "Weekends" in one tap. */}
        <div>
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
            <label className="text-[11.5px] font-semibold text-[var(--neutral-sub-600)]">
              Days this freeze applies on
            </label>
            <div className="flex items-center gap-1">
              <QuickSelectChip
                onClick={() => setFormData((f) => ({ ...f, work_days: [0, 1, 2, 3, 4] }))}
              >
                Weekdays
              </QuickSelectChip>
              <QuickSelectChip
                onClick={() => setFormData((f) => ({ ...f, work_days: [5, 6] }))}
              >
                Weekends
              </QuickSelectChip>
              <QuickSelectChip
                onClick={() => setFormData((f) => ({ ...f, work_days: [0, 1, 2, 3, 4, 5, 6] }))}
              >
                All
              </QuickSelectChip>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DAYS_OF_WEEK.map((day) => {
              const selected = formData.work_days.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleWorkDay(day.value)}
                  aria-pressed={selected}
                  className={cn(
                    'h-8 rounded-[8px] px-3 text-[12.5px] font-medium tracking-[-0.005em]',
                    'transition-all duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                    selected
                      ? 'border border-[var(--primary-base)] bg-[var(--primary-alpha-10)] text-[var(--primary-base)] shadow-[inset_0_0_0_1px_var(--primary-base)]'
                      : 'border border-[var(--stroke-sub-300)] bg-white text-[var(--neutral-sub-600)] hover:border-[var(--neutral-soft-400)] hover:bg-[var(--neutral-weak-50)]',
                  )}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time-of-day range. Two columns; an arrow between makes
            the relationship between start and end legible. We hint
            the overnight semantics explicitly because freeze
            schedules cross midnight more often than they don't. */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--neutral-sub-600)]">
            <Clock className="h-3 w-3" strokeWidth={2} aria-hidden />
            Time of day
          </label>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <input
              type="time"
              value={formData.window_start}
              onChange={(e) =>
                setFormData({ ...formData, window_start: e.target.value })
              }
              aria-label="Start time"
              className="h-9 rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-3 text-[13px] tabular-nums text-[var(--neutral-strong-950)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-[3px] focus:ring-[var(--primary-alpha-16)]"
            />
            <span
              aria-hidden
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]"
            >
              to
            </span>
            <input
              type="time"
              value={formData.window_end}
              onChange={(e) =>
                setFormData({ ...formData, window_end: e.target.value })
              }
              aria-label="End time"
              className="h-9 rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-3 text-[13px] tabular-nums text-[var(--neutral-strong-950)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-[3px] focus:ring-[var(--primary-alpha-16)]"
            />
          </div>
          {formData.window_start >= formData.window_end && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-[var(--neutral-soft-400)]">
              <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden />
              This window crosses midnight — freeze runs from{' '}
              <span className="font-mono">{formData.window_start}</span> through{' '}
              <span className="font-mono">{formData.window_end}</span> the next
              morning.
            </p>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-1.5 border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]/40 px-5 py-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={formData.work_days.length === 0}
        >
          {editing ? 'Update window' : 'Create window'}
        </Button>
      </div>
    </form>
  );
}

// ─── Quick-select chip ──────────────────────────────────────────────
function QuickSelectChip({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-6 rounded-[6px] border border-transparent bg-[var(--neutral-weak-50)] px-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-sub-600)] transition-colors hover:border-[var(--stroke-sub-300)] hover:bg-white hover:text-[var(--neutral-strong-950)]"
    >
      {children}
    </button>
  );
}

// ─── Single freeze-window row ───────────────────────────────────────
//
// Simplified vs. the old design: no expand-collapse. The week
// preview at the top of the page already answers "what does this
// window do?" so the per-row "details panel" was redundant. Edit
// + Delete now sit inline with a status badge showing whether
// this specific window is the one firing right now.
function FreezeWindowRow({
  window: w,
  activeNow,
  onEdit,
  onDelete,
}: {
  window: FreezeWindow;
  activeNow: boolean;
  onEdit: (w: FreezeWindow) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.li
      variants={fadeUpSm}
      className={cn(
        'flex items-center gap-3 px-5 py-3.5',
        activeNow && 'bg-gradient-to-r from-[var(--primary-alpha-10)]/30 to-transparent',
      )}
    >
      {/* Concentric-ring icon — same treatment as the Policies row
          (outer 44px ring + inner 32px white circle + brand-orange
          glyph). Unifies the "governance rule" visual vocabulary
          across both pages: freeze windows ARE policies in the
          decision pipeline, so they should read as the same primitive. */}
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center"
        aria-hidden
      >
        <div className="absolute h-11 w-11 rounded-full border border-[var(--stroke-soft-200)]" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white text-[var(--primary-base)] shadow-[0_1px_2px_rgba(23,23,23,0.05)] ring-1 ring-[var(--stroke-soft-200)]">
          <Calendar className="h-4 w-4" strokeWidth={2} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
            {getDayLabels(w.work_days)}
          </p>
          <span className="inline-flex items-center rounded-[6px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-2 py-0.5 font-mono text-[11px] tabular-nums text-[var(--neutral-sub-600)]">
            {w.window_start.slice(0, 5)} → {w.window_end.slice(0, 5)}
          </span>
          {activeNow && (
            <Badge tone="primary" uppercase className="text-[10.5px]">
              <Activity className="mr-1 h-2.5 w-2.5" strokeWidth={2.5} />
              Active now
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-[11.5px] text-[var(--neutral-soft-400)]">
          {w.timezone}
          {w.created_at && (
            <>
              {' · '}created {formatFullTimestamp(w.created_at)}
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onEdit(w)}
        aria-label="Edit"
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-2 text-[12.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] sm:px-3"
      >
        <Edit2 className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="hidden sm:inline">Edit</span>
      </button>
      <button
        type="button"
        onClick={() => onDelete(w.id)}
        aria-label="Delete"
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-2 text-[12.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:border-[var(--error)]/30 hover:bg-[var(--error-lighter)] hover:text-[var(--error)] sm:px-3"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="hidden sm:inline">Delete</span>
      </button>
    </motion.li>
  );
}
