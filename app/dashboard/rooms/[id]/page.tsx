'use client';

/**
 * Room Overview — the default landing tab for a room.
 *
 * Pulls the per-room story together: recent activity, pending
 * approvals scoped to this room's repo, member count, and a quick-
 * action strip. The point is to make the room feel ALIVE — a live
 * dashboard, not a config screen.
 *
 * All data is client-side filtered from existing endpoints
 * (`getRuns`, `getMcpApprovals`) against the room's repo_name. No
 * backend changes required. When per-room filters land in the
 * backend later, this page swaps to use them transparently.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  ArrowUpRight,
  Bell,
  ChevronRight,
  Plug,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import type { MCPApproval, SessionAction } from '@/lib/types';
import { CodeChip } from '@/components/ui/CodeChip';
import DecisionBadge from '@/components/ui/DecisionBadge';
import EmptyState from '@/components/ui/EmptyState';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { SetupChecklist } from '@/components/ui/SetupChecklist';
import { Skeleton } from '@/components/ui/Skeleton';
import { useRoom } from '@/lib/roomContext';
import { fadeUp, staggerContainer } from '@/lib/motion';

export default function RoomOverviewPage() {
  const { user } = useUser();
  const { roomId, room, members, loading: roomLoading } = useRoom();
  const reduce = useReducedMotion();
  const [recentRuns, setRecentRuns] = useState<SessionAction[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<MCPApproval[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  const repoName = room?.repo_name ?? '';

  // Filter the user's runs + approvals to just this room's repo —
  // client-side until the backend supports per-room queries.
  const loadActivity = useCallback(async () => {
    if (!user?.id || !repoName) return;
    setActivityLoading(true);
    try {
      const [runs, approvals] = await Promise.all([
        api.getRuns(user.id),
        api.getMcpApprovals(user.id),
      ]);
      setRecentRuns(
        runs.filter((r) => r.target_repo === repoName).slice(0, 5),
      );
      setPendingApprovals(
        approvals.filter(
          (a) =>
            (a.arguments as { repo?: string })?.repo === repoName &&
            a.status === 'pending',
        ),
      );
    } catch {
      // Keep the overview functional even if activity load fails —
      // the rest of the page still renders.
    } finally {
      setActivityLoading(false);
    }
  }, [user?.id, repoName]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  if (roomLoading) {
    return (
      <div className="mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-7 lg:px-8 lg:pt-8 lg:pb-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-[12px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-7 lg:px-8 lg:pt-8 lg:pb-8">
      <motion.div
        variants={staggerContainer(0.06)}
        initial={reduce ? false : 'hidden'}
        animate="show"
        className="space-y-6"
      >
        {/* Setup checklist — surfaces immediately after Create.
            Auto-hides once all 3 steps are done (or dismissed) and
            persists per-room in localStorage so it doesn't pop up
            on rooms the user has already configured.
            Rendered WITHOUT an outer motion.div wrapper on purpose:
            SetupChecklist returns null when hidden, but a wrapper
            motion.div still renders (just empty), and the parent's
            `space-y-6` then adds 24px of phantom margin to the next
            sibling. Letting SetupChecklist render directly means a
            hidden checklist creates no DOM at all, and the stat
            strip sits flush against the page's top padding. Its own
            <motion.section> inside handles entry animation, so we
            lose nothing by dropping the wrapper. */}
        <SetupChecklist
          roomId={roomId}
          memberCount={members.length}
          hasFirstRun={recentRuns.length > 0}
        />

        {/* Top-of-page stat strip — three at-a-glance numbers that
            answer "what's happening in this room right now?" */}
        <motion.div
          variants={fadeUp}
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
        >
          <StatCard
            icon={Users}
            label="Members"
            value={members.length.toLocaleString()}
            hint={`${members.length === 1 ? 'person' : 'people'} can use this room`}
            href={`/dashboard/rooms/${room?.room_id ?? room?.id}/members`}
          />
          <StatCard
            icon={Bell}
            label="Pending approvals"
            value={
              activityLoading
                ? '—'
                : pendingApprovals.length.toLocaleString()
            }
            hint={
              pendingApprovals.length > 0
                ? 'waiting for review'
                : 'queue is clear'
            }
            href="/dashboard/approvals"
            tone={pendingApprovals.length > 0 ? 'urgent' : 'neutral'}
          />
          <StatCard
            icon={Activity}
            label="Your Recent activity"
            value={
              activityLoading ? '—' : recentRuns.length.toLocaleString()
            }
            hint="actions in the last sample"
            href="/dashboard/audit"
          />
        </motion.div>

        {/* Two-column: recent activity (left, primary) + quick links (right) */}
        <motion.div
          variants={fadeUp}
          className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
        >
          {/* Recent activity panel — last 5 actions in this repo */}
          <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <div className="flex items-center justify-between border-b border-[var(--stroke-soft-200)] px-5 py-3.5">
              <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Your recent activity in this room
              </h2>
              <Link
                href="/dashboard/audit"
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--primary-base)]"
              >
                View audit
                <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
              </Link>
            </div>
            {activityLoading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-[44px] w-full rounded-[8px]" />
                ))}
              </div>
            ) : recentRuns.length === 0 ? (
              <EmptyState
                icon={<Activity className="h-5 w-5" />}
                title="No activity yet"
                description={`Once an agent runs an action against ${repoName}, it'll appear here.`}
                compact
              />
            ) : (
              <ul className="divide-y divide-[var(--stroke-soft-200)]">
                {recentRuns.map((run) => (
                  <li
                    key={run.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <DecisionBadge decision={run.decision} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-[var(--neutral-strong-950)]">
                        {run.agent_name || 'Agent'}
                      </p>
                      <p className="truncate text-[11px] text-[var(--neutral-soft-400)]">
                        <CodeChip className="!h-[15px] !px-1 !text-[10px]">
                          {run.tool_name}
                        </CodeChip>
                        {run.target_branch && (
                          <span className="ml-1.5">
                            on{' '}
                            <span className="font-mono text-[10.5px] text-[var(--neutral-sub-600)]">
                              {run.target_branch}
                            </span>
                          </span>
                        )}
                      </p>
                    </div>
                    <RelativeTime
                      timestamp={run.timestamp}
                      className="shrink-0 text-[11px] text-[var(--neutral-soft-400)]"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick-actions sidebar — common next steps from the
              Overview tab. */}
          <div className="space-y-3">
            <QuickAction
              icon={Plug}
              title="Connect an agent"
              description="Wire Cursor / Claude Code into this room."
              href={`/dashboard/rooms/${room?.room_id ?? room?.id}/connect`}
            />
            <QuickAction
              icon={Shield}
              title="Adjust tool policies"
              description="Control what agents can do in this repo."
              href={`/dashboard/rooms/${room?.room_id ?? room?.id}/tools`}
            />
            <QuickAction
              icon={Users}
              title="Invite a teammate"
              description="Share access with the right role."
              href={`/dashboard/rooms/${room?.room_id ?? room?.id}/members`}
            />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ─── Stat card ──────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  tone = 'neutral',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  href: string;
  tone?: 'neutral' | 'urgent';
}) {
  return (
    <Link
      href={href}
      className="group block rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)] transition-all hover:border-[var(--stroke-sub-300)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.06)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
            {label}
          </p>
          <p
            className={`mt-1.5 text-[26px] font-semibold leading-[1] tracking-[-0.02em] tabular-nums ${
              tone === 'urgent'
                ? 'text-[var(--primary-base)]'
                : 'text-[var(--neutral-strong-950)]'
            }`}
          >
            {value}
          </p>
          <p className="mt-1 truncate text-[11px] text-[var(--neutral-soft-400)]">
            {hint}
          </p>
        </div>
        <Icon
          className="h-4 w-4 shrink-0 text-[var(--neutral-soft-400)] transition-colors group-hover:text-[var(--neutral-sub-600)]"
          strokeWidth={2}
          aria-hidden
        />
      </div>
    </Link>
  );
}

// ─── Quick-action row ───────────────────────────────────────────────
function QuickAction({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)] transition-all hover:border-[var(--stroke-sub-300)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.06)]"
    >
      {/* Canonical icon box — white surface + 1px ring + soft shadow,
          orange outline icon. Matches the EmptyState pattern the user
          called out, just scaled down for inline use. Replaces the
          previous tinted square so action-style icon containers read
          consistently across the product (QuickAction, DemoWelcome,
          and the rest). */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white text-[var(--primary-base)] shadow-[0_1px_2px_rgba(23,23,23,0.05)] ring-1 ring-[var(--stroke-soft-200)]">
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
          {title}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-[1.45] text-[var(--neutral-sub-600)]">
          {description}
        </p>
      </div>
      <ChevronRight
        className="h-3.5 w-3.5 shrink-0 self-center text-[var(--neutral-soft-400)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--neutral-strong-950)]"
        strokeWidth={2}
        aria-hidden
      />
    </Link>
  );
}
