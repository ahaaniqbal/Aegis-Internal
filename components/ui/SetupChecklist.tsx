'use client';

/**
 * SetupChecklist — post-create onboarding for a new room.
 *
 * Sits at the top of /dashboard/rooms/[id] (Overview tab) so that a
 * newly-created room shows the user what to do next:
 *
 *   1. Set tool policies (Tools tab)
 *   2. Invite teammates (Members tab)  — or skip with "It's just me"
 *   3. Connect your agent (Connect tab)
 *
 * Why this exists: previously, creating a room dropped the user
 * straight into Connect. That works for the individual IC who's
 * testing the product on themselves, but a Tech Lead setting up a
 * team room ends up confused — they want Policy → Members → Connect,
 * not Connect immediately. The checklist serves both paths.
 *
 * Completion signals (mixed automatic + manual):
 *   • Tools: a localStorage flag set by the Tools page after the
 *     first successful save. Manual "Mark done" fallback so users
 *     who skim policies can dismiss it.
 *   • Members: derived from members.length > 1 (real signal) or
 *     a localStorage "skipped" flag from clicking "It's just me."
 *   • Connect: derived from a run existing for this room's repo
 *     (real signal — same call the Connect tab uses).
 *
 * When all three are done/skipped, the checklist auto-hides. A
 * single dismiss-all X is also available — sets all three to
 * "skipped" so the card never returns.
 *
 * State persists per-room in localStorage so a Tech Lead working
 * across multiple rooms doesn't see "Invite teammates" on a room
 * that's already populated.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, Plug, Shield, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

type StepId = 'tools' | 'members' | 'connect';

// localStorage key shape — keyed per room so progress in one room
// doesn't bleed into another.
const stateKey = (roomId: string) => `aegis_setup_${roomId}`;
const dismissKey = (roomId: string) => `aegis_setup_${roomId}_dismissed`;

type StepState = Record<StepId, 'pending' | 'done' | 'skipped'>;

const EMPTY_STATE: StepState = {
  tools: 'pending',
  members: 'pending',
  connect: 'pending',
};

// Exported helpers — other tabs use these to mark a step done from
// where the user actually completes it (e.g. Tools page after save).
export function markSetupStepDone(roomId: string, step: StepId) {
  try {
    const raw = localStorage.getItem(stateKey(roomId));
    const current: StepState = raw ? { ...EMPTY_STATE, ...JSON.parse(raw) } : EMPTY_STATE;
    current[step] = 'done';
    localStorage.setItem(stateKey(roomId), JSON.stringify(current));
  } catch {
    /* localStorage may be unavailable in some envs — checklist still works */
  }
}

interface SetupChecklistProps {
  roomId: string;
  /** How many members are in this room. >1 implies invite step done. */
  memberCount: number;
  /** Whether any agent run has been observed for this room's repo. */
  hasFirstRun: boolean;
}

export function SetupChecklist({
  roomId,
  memberCount,
  hasFirstRun,
}: SetupChecklistProps) {
  const reduce = useReducedMotion();
  const [state, setState] = useState<StepState>(EMPTY_STATE);
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(stateKey(roomId));
      if (stored) {
        setState({ ...EMPTY_STATE, ...JSON.parse(stored) });
      }
      setDismissed(localStorage.getItem(dismissKey(roomId)) === '1');
    } catch {
      /* fine — defaults are correct */
    } finally {
      setHydrated(true);
    }
  }, [roomId]);

  // Persist on change. Skip the initial mount write so we don't
  // clobber any pre-existing state with EMPTY_STATE.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(stateKey(roomId), JSON.stringify(state));
    } catch {
      /* swallow */
    }
  }, [state, roomId, hydrated]);

  // Derived completion — real signals beat localStorage when
  // available. A user could have skipped "members" but later added
  // a teammate; we should reflect that.
  const effective = useMemo<StepState>(() => {
    const next: StepState = { ...state };
    if (memberCount > 1 && next.members === 'pending') next.members = 'done';
    if (hasFirstRun && next.connect === 'pending') next.connect = 'done';
    return next;
  }, [state, memberCount, hasFirstRun]);

  const update = (step: StepId, value: 'done' | 'skipped') => {
    setState((prev) => ({ ...prev, [step]: value }));
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(dismissKey(roomId), '1');
    } catch {
      /* swallow */
    }
  };

  const allDone =
    effective.tools !== 'pending' &&
    effective.members !== 'pending' &&
    effective.connect !== 'pending';

  // Don't render until hydration is complete to avoid a flash of
  // "Set up this room" on a room the user has already configured.
  if (!hydrated || dismissed || allDone) return null;

  const completed = (Object.values(effective).filter((v) => v !== 'pending')).length;

  return (
    <AnimatePresence>
      <motion.section
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
      >
        {/* Inset tinted gradient overlay — matches the Decision
            Overview hero on the Dashboard + the freeze status
            banner. 4px inset on all sides → reads as inner panel
            wash. Subtler than the full-card pinkish gradient we
            had before, and dark-mode-aware for free (the bg-white
            below auto-flips to --white-0). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-1 rounded-[8px]"
          style={{
            background:
              'linear-gradient(180deg, rgba(250, 115, 25, 0.07) 0%, rgba(250, 115, 25, 0.03) 28%, rgba(255, 255, 255, 0) 60%)',
          }}
        />
        <div className="relative flex items-start justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--primary-base)]">
              Get started
            </p>
            <h2 className="mt-0.5 text-[15px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
              Set up this room
            </h2>
            <p className="mt-0.5 text-[11.5px] text-[var(--neutral-sub-600)]">
              {completed} of 3 steps complete — finish to get the most out of
              Aegis.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss setup checklist"
            title="Hide this checklist"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[var(--neutral-soft-400)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <ol className="relative divide-y divide-[var(--stroke-soft-200)]">
          <ChecklistRow
            stepNumber={1}
            icon={<Shield className="h-4 w-4" strokeWidth={2} aria-hidden />}
            title="Set tool policies"
            description="Pick which agent tools each role can use. Templates make this one click."
            state={effective.tools}
            primaryHref={`/dashboard/rooms/${roomId}/tools`}
            primaryLabel="Configure"
            onSkip={() => update('tools', 'skipped')}
          />
          <ChecklistRow
            stepNumber={2}
            icon={<Users className="h-4 w-4" strokeWidth={2} aria-hidden />}
            title="Invite teammates"
            description={
              memberCount > 1
                ? `${memberCount} ${memberCount === 1 ? 'person' : 'people'} in this room.`
                : 'Generate an invite code and share it with your team.'
            }
            state={effective.members}
            primaryHref={`/dashboard/rooms/${roomId}/members`}
            primaryLabel="Invite"
            secondaryLabel="It's just me"
            onSkip={() => update('members', 'skipped')}
          />
          <ChecklistRow
            stepNumber={3}
            icon={<Plug className="h-4 w-4" strokeWidth={2} aria-hidden />}
            title="Connect your agent"
            description="Wire Cursor, Claude Code, or any MCP-compatible agent into this room."
            state={effective.connect}
            primaryHref={`/dashboard/rooms/${roomId}/connect`}
            primaryLabel="Connect"
            onSkip={() => update('connect', 'skipped')}
          />
        </ol>
      </motion.section>
    </AnimatePresence>
  );
}

// ─── Row ────────────────────────────────────────────────────────────
function ChecklistRow({
  stepNumber,
  icon,
  title,
  description,
  state,
  primaryHref,
  primaryLabel,
  secondaryLabel,
  onSkip,
}: {
  stepNumber: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  state: 'pending' | 'done' | 'skipped';
  primaryHref: string;
  primaryLabel: string;
  /** Optional skip CTA label — varies per step ("It's just me" reads
   *  better than "Skip" for the invites step). */
  secondaryLabel?: string;
  onSkip: () => void;
}) {
  const isDone = state !== 'pending';
  return (
    <li className="flex items-start gap-3 px-5 py-3.5">
      {/* Status pill — three states (done / skipped / pending),
          all rendered at the same 24px circle so the progress
          column reads as one consistent vertical rhythm.

          We deliberately give the pending state a FILLED tinted
          background instead of a hollow outline. An outlined
          shape next to a solid filled shape looks smaller at the
          same dimensions — a classic optical-weight illusion —
          and the user kept reading the green circle as bigger.
          Matching the fill style equalizes the visual mass. */}
      {state === 'done' ? (
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--success)] text-white"
          aria-hidden
        >
          {/* h-2.5 w-2.5 (10px) + strokeWidth 2.25 so the check reads
              at roughly the same visual mass as the 11px step number
              in the pending state. Previously h-3 / strokeWidth 2.75
              made the green tick look noticeably bolder than the
              orange number, which read as "the green circle is
              bigger" even though all three circles are h-6 w-6. */}
          <Check className="h-2.5 w-2.5" strokeWidth={2.25} />
        </span>
      ) : state === 'skipped' ? (
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--neutral-weak-50)] text-[var(--neutral-soft-400)]"
          aria-hidden
        >
          <Check className="h-2.5 w-2.5" strokeWidth={2.25} />
        </span>
      ) : (
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary-alpha-16)] text-[11px] font-bold tabular-nums leading-none text-[var(--primary-base)]"
          aria-hidden
        >
          {stepNumber}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'flex items-center gap-2 text-[13px] font-semibold tracking-[-0.005em]',
            isDone
              ? 'text-[var(--neutral-soft-400)] line-through'
              : 'text-[var(--neutral-strong-950)]',
          )}
        >
          <span className="text-[var(--neutral-soft-400)]">{icon}</span>
          {title}
        </p>
        <p
          className={cn(
            'mt-0.5 text-[11.5px] leading-[1.45]',
            isDone
              ? 'text-[var(--neutral-soft-400)]'
              : 'text-[var(--neutral-sub-600)]',
          )}
        >
          {description}
        </p>
      </div>
      {!isDone && (
        <div className="flex shrink-0 items-center gap-1.5">
          {secondaryLabel && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onSkip}
            >
              {secondaryLabel}
            </Button>
          )}
          <Link href={primaryHref}>
            <Button
              size="sm"
              variant="primary"
              trailingIcon={
                <ArrowRight className="h-3 w-3" strokeWidth={2.25} />
              }
            >
              {primaryLabel}
            </Button>
          </Link>
        </div>
      )}
    </li>
  );
}
