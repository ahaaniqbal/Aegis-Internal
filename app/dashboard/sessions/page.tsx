'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  GitBranch,
  Hash,
  Layers,
  Timer,
} from 'lucide-react';
import { useUser } from '@/lib/hooks';
import { useDashboardData } from '@/lib/dashboardDataContext';
import { AggregatedSessionAction, PaginatedResponse } from '@/lib/types';
import PaginatedLayout from '@/components/ui/PaginatedLayout';
import { SessionAction } from '@/lib/types';
import {
  extractPullRequestUrl,
  formatDuration,
  formatExecutionTimeMs,
  formatRelativeTime,
  readBlastRadius,
} from '@/lib/utils';
import { RelativeTime } from '@/components/ui/RelativeTime';
import Topbar from '@/components/layout/Topbar';
import { AgentMark } from '@/components/ui/AgentMark';
import DecisionBadge from '@/components/ui/DecisionBadge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import JsonViewer from '@/components/ui/JsonViewer';
import { SessionsSkeleton } from '@/components/ui/PageSkeletons';
import { BlastRadiusChip } from '@/components/ui/BlastRadiusChip';
import { CodeChip } from '@/components/ui/CodeChip';
import { PolicyChip } from '@/components/ui/PolicyChip';
import { PullRequestLink } from '@/components/ui/PullRequestLink';
import { DUR, EASE, fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';

export default function SessionsPage() {
  const [data, setData] = useState<
    PaginatedResponse<AggregatedSessionAction>
  >({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
    pages: 0,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const { user, isLoading: userLoading } = useUser();
  const reduce = useReducedMotion();
  const { fetchAggregatedPage, globalDataEpoch, lastUpdated } =
  useDashboardData();

  const fetchData = useCallback(
  async (options?: { soft?: boolean }) => {
    if (!user?.id) {
      if (!userLoading) {
        setData({
          items: [],
          total: 0,
          page: 1,
          page_size: 20,
          pages: 0,
        });
        setLoading(false);
      }
      return;
    }

    if (!options?.soft) setLoading(true);

    try {
      const result = await fetchAggregatedPage(page, {
        force: false,
      });

      setData(result);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load data.items'
      );
    } finally {
      if (!options?.soft) setLoading(false);
    }
  },
  [user?.id, userLoading, page, fetchAggregatedPage]
);

  useEffect(() => {
    if (user?.id) fetchData();
    else if (!userLoading) {
      setData({
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
        pages: 0,
      });
      setLoading(false);
    }
  }, [user?.id, userLoading, fetchData]);

  if (userLoading || loading) {
    return (
      <>
        <Topbar title="Sessions" subtitle="Agent working sessions" showDateRange />
        <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <SessionsSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Sessions"
        subtitle="Agent working sessions"
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
        showDateRange
      />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner
              message={error}
              onDismiss={() => setError(null)}
              onRetry={fetchData}
            />
          </div>
        )}

        <motion.header
          className="mb-6"
          variants={staggerContainer(0.05, 0.04)}
          initial={reduce ? false : 'hidden'}
          animate="show"
        >
          <motion.p
            variants={fadeUp}
            className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]"
          >
            Agent sessions
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
          >
            Every working session, grouped
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-2 text-[13.5px] text-[var(--neutral-sub-600)]"
          >
            <span className="font-semibold text-[var(--neutral-strong-950)]">
              {data.items.length.toLocaleString()}
            </span>{' '}
            {data.items.length === 1 ? 'session' : 'sessions'} · click any row to inspect its actions.
          </motion.p>
        </motion.header>

        {data.items.length === 0 ? (
          <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <EmptyState
              icon={<Layers className="h-5 w-5" />}
              title="No sessions yet"
              description="A session groups every action from one agent conversation. They appear automatically once your agent runs its first tool."
            />
          </div>
        ) : (
        <PaginatedLayout
            total={data.total}
            page={data.page}
            pages={data.pages}
            page_size={data.page_size}
            onPageChange={setPage}
          >
          <motion.div
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.16 }}
          >
            <motion.ul
              className="divide-y divide-[var(--stroke-soft-200)]"
              variants={staggerContainer(0.03, 0.24)}
              initial={reduce ? false : 'hidden'}
              animate="show"
            >
              {data.items.map((session) => (
                <SessionRow
                  key={session.session_id}
                  session={session}
                  userId={user?.id}
                  isExpanded={expandedSession === session.session_id}
                  onToggle={() =>
                    setExpandedSession(
                      expandedSession === session.session_id ? null : session.session_id,
                    )
                  }
                />
              ))}
            </motion.ul>
          </motion.div>
        </PaginatedLayout>)}
      </div>
    </>
  );
}

function SessionRow({
  session,
  userId,
  isExpanded,
  onToggle,
}: {
  session: AggregatedSessionAction;
  userId?: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {

  const agentName =
    session.sessions[0]?.agent_name || 'Agent';

  const repos = [
    ...new Set(
      session.sessions
        .map((a) => a.target_repo)
        .filter(Boolean)
    ),
  ];

  const totalDecisions = session.sessions.length;
  const allows = session.sessions.filter(
    (a) => a.decision?.toUpperCase() === 'ALLOW'
  ).length;

  const denies = session.sessions.filter(
    (a) => a.decision?.toUpperCase() === 'DENY'
  ).length;

  const rewrites = session.sessions.filter(
    (a) => a.decision?.toUpperCase() === 'REWRITE'
  ).length;

  const approvals = session.sessions.filter(
    (a) => a.decision?.toUpperCase() === 'APPROVE'
  ).length;

  // Delayed visual-expanded state — keeps the trigger button's gradient
  // styling on screen until the panel's exit animation completes, so the
  // trigger doesn't "snap" back to white while the panel is still
  // collapsing below it.
  const [stillExpanded, setStillExpanded] = useState(isExpanded);
  useEffect(() => {
    if (isExpanded) setStillExpanded(true);
  }, [isExpanded]);

  return (
    <motion.li variants={fadeUpSm} className="bg-white">
      <button
        onClick={onToggle}
        className={
          stillExpanded
            ? // Top half of the continuous orange → white wash. End-stop
              // (/45) matches the panel's start-stop below so the gradient
              // reads as one smooth fade across the whole expanded block.
              'flex w-full items-center gap-3 bg-gradient-to-b from-[var(--primary-lighter)]/55 to-[var(--primary-lighter)]/45 px-4 py-[14px] text-left transition-colors sm:gap-4 sm:px-6'
            : // Default: subtle hover-orange when contracted (matches Table TR).
              'flex w-full items-center gap-3 px-4 py-[14px] text-left transition-colors hover:bg-[var(--primary-lighter)]/60 sm:gap-4 sm:px-6'
        }
      >
        <AgentMark name={agentName} size="sm" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span className="truncate text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
              {agentName}
            </span>
            {/* Session-id chip — hidden on tiny screens to save space */}
            <span className="hidden sm:inline-flex">
              <CodeChip>{session.session_id?.substring(0, 8)}…</CodeChip>
            </span>
          </div>
          <div className="mt-[3px] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--neutral-soft-400)]">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" strokeWidth={2} />
              <RelativeTime timestamp={session.started_at} />
            </span>
            <span className="text-[var(--stroke-sub-300)]">·</span>
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3 w-3" strokeWidth={2} />
              <span className="font-semibold text-[var(--neutral-sub-600)]">
                {Number(session.action_count).toLocaleString()}
              </span>{' '}
              {Number(session.action_count) === 1 ? 'action' : 'actions'}
            </span>
            {repos.length > 0 && (
              <>
                <span className="hidden text-[var(--stroke-sub-300)] sm:inline">·</span>
                <span className="hidden items-center gap-1 sm:inline-flex">
                  <GitBranch className="h-3 w-3" strokeWidth={2} />
                  <span className="truncate max-w-[260px]">{repos.join(', ')}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Decision distribution — hidden below md; on mobile the pills
            push other content and are redundant with the expanded panel. */}
        <div className="hidden w-[220px] shrink-0 justify-end md:flex">
          {totalDecisions > 0 ? (
            <div className="flex items-center gap-1.5">
              <DecisionStat value={allows} color="var(--success)" label="allow" />
              <DecisionStat value={rewrites} color="var(--feature)" label="rewrite" />
              <DecisionStat value={approvals} color="var(--warning)" label="approve" />
              <DecisionStat value={denies} color="var(--error)" label="deny" />
            </div>
          ) : (
            <span className="text-[11.5px] italic text-[var(--neutral-soft-400)]">
              No actions
            </span>
          )}
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--neutral-soft-400)] transition-transform duration-200 ${
            isExpanded ? 'rotate-0' : '-rotate-90'
          }`}
          strokeWidth={2}
        />
      </button>

      <AnimatePresence
        initial={false}
        onExitComplete={() => setStillExpanded(false)}
      >
      {isExpanded && (
        <motion.div
          key="expanded"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ overflow: 'hidden', willChange: 'height' }}
          // Bottom half of the continuous orange → white wash. Start-stop
          // (/45) matches the trigger's end-stop above so the gradient
          // hands off seamlessly into the panel.
          className="bg-gradient-to-b from-[var(--primary-lighter)]/45 to-[var(--white-0)]"
        >
        <div className="px-4 pb-5 pt-1 sm:px-6">
          {/* Inner surface — pure white card so it reads as a true nested panel */}
          <div className="overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            {/* Header strip with session meta */}
            <div className="flex items-center justify-between border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-2.5">
              <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                <Hash className="h-3 w-3" strokeWidth={2.25} />
                <span>Action timeline</span>
                {session.sessions && (
                  <span className="text-[var(--neutral-sub-600)]">
                    · {session.sessions.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--neutral-soft-400)]">
                <Timer className="h-3 w-3" strokeWidth={2} />
                <span className="tabular-nums">
                  {formatDuration(session.started_at, session.ended_at)}
                </span>
              </div>
            </div>

            {session.sessions && session.sessions.length > 0 ? (
              <ol className="px-4 py-3">
                {session.sessions.map((action, idx) => {
                  const actionPrUrl = extractPullRequestUrl({
                    action_pointers: action.action_pointers,
                    result: action.result,
                    arguments: action.arguments,
                  });
                  return (
                  <li
                    key={action.id}
                    className="relative flex gap-3 pb-3 last:pb-0"
                  >
                    {/* Continuous timeline line, positioned absolutely on
                        the li so it can bridge the `pb-3` gap between
                        items (the previous in-gutter line couldn't reach
                        across that 12px gap, producing visible breaks).
                          • Starts at y=17 (gutter pt 8 + dot 9), so it
                            sits BELOW the current dot — no "weird line
                            above" the first node.
                          • Ends at bottom: -8 (8px past the li's bottom
                            edge), reaching the top of the NEXT li's dot
                            (which is at its own pt-8 offset). The result
                            is a single visually-continuous line
                            connecting consecutive dots.
                          • left-[7px] = center of the 14px gutter.
                          • Skipped on the last item (idx check). */}
                    {idx < session.sessions.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute left-[7px] top-[17px] -bottom-2 w-px -translate-x-1/2 bg-[var(--stroke-soft-200)]"
                      />
                    )}
                    <div className="relative flex w-[14px] shrink-0 justify-center pt-[8px]">
                      <span
                        aria-hidden
                        className="relative inline-block h-[9px] w-[9px] rounded-full bg-[var(--neutral-soft-400)]"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="rounded-[8px] border border-[var(--stroke-soft-200)] bg-white p-3 transition-colors hover:border-[var(--stroke-sub-300)]">
                        {/* Summary row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-[10.5px] font-semibold tabular-nums text-[var(--neutral-soft-400)]">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <CodeChip>{action.tool_name}</CodeChip>
                              {action.execution_time !== undefined &&
                                action.execution_time !== null && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--neutral-soft-400)]">
                                    <Timer className="h-3 w-3" strokeWidth={2} />
                                    <span className="tabular-nums">
                                      {formatExecutionTimeMs(action.execution_time)}
                                    </span>
                                  </span>
                                )}
                              <span className="text-[var(--stroke-sub-300)] text-[11px]">·</span>
                              <RelativeTime
                                timestamp={action.timestamp}
                                className="text-[11px] text-[var(--neutral-soft-400)]"
                              />
                            </div>
                            <p className="mt-1.5 text-[13px] leading-[1.45] text-[var(--neutral-strong-950)]">
                              {action.action_summary}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <DecisionBadge decision={action.decision} />
                            <PolicyChip policy={action.policy} />
                            <BlastRadiusChip value={readBlastRadius(action)} />
                            {actionPrUrl && (
                              <PullRequestLink url={actionPrUrl} variant="chip" />
                            )}
                          </div>
                        </div>

                        {/* Arguments — full-width below the summary row so the
                            JSON panel has equal breathing room left & right. */}
                        {action.arguments &&
                          Object.keys(action.arguments).length > 0 && (
                            <div className="mt-2.5">
                              <JsonViewer
                                data={action.arguments}
                                collapsed={false}
                                label="Arguments"
                              />
                            </div>
                          )}
                      </div>
                    </div>
                  </li>
                  );
                })}
              </ol>
            ) : (
              <p className="py-8 text-center text-[12.5px] text-[var(--neutral-soft-400)]">
                No actions found.
              </p>
            )}

            {session.sessions && session.sessions.length > 0 && (
              <div className="flex items-center justify-end gap-2 border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-2.5">
                <Link
                  href={`/dashboard/runs?session=${session.session_id}`}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--neutral-sub-600)] hover:text-[var(--primary-base)]"
                >
                  View all runs
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                </Link>
              </div>
            )}
          </div>
        </div>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.li>
  );
}

function DecisionStat({
  value,
  color,
  label,
}: {
  value: number;
  color: string;
  label: string;
}) {
  if (!value) return null;
  return (
    <span
      title={`${value} ${label}${value === 1 ? '' : 's'}`}
      className="inline-flex h-[22px] items-center gap-1.5 rounded-[6px] border border-[var(--stroke-soft-200)] bg-white px-2 text-[11.5px] font-semibold tabular-nums"
      style={{ color }}
    >
      <span
        aria-hidden
        className="inline-block h-[6px] w-[6px] rounded-full"
        style={{ backgroundColor: color }}
      />
      {value.toLocaleString()}
    </span>
  );
}
