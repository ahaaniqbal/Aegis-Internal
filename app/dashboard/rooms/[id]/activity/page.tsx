'use client';

/**
 * Room Activity — per-room audit log scoped to the current room.
 *
 * Replaces the old standalone /dashboard/room-logs route. Now a tab
 * inside the room scope so users land here from the room overview
 * instead of a separate top-level page.
 *
 * Reads roomId from RoomContext (provided by the room layout), so
 * there's no in-page room picker — the URL is the picker. Reuses the
 * same API endpoint (`api.getSessionsByRoomId`) and the same data
 * shape (`RoomSessionAction`) Jenil shipped on the backend.
 *
 * Page composition (top to bottom):
 *   Topbar           ← from room layout
 *   Breadcrumb/Switcher  ← from room layout
 *   Tab strip        ← from room layout (Overview / Activity / ...)
 *   ──────────────── activity tab content starts here ──────────
 *   Status bar       ← total actions + last-updated + refresh
 *   Table            ← user / tool / branch / risk / decision / time
 *     (expandable rows show summary + JSON args)
 *   Pagination
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Activity, ChevronRight, History, RefreshCw } from 'lucide-react';

import { api, AuthError } from '@/lib/api';
import { useAutoRefresh } from '@/lib/hooks';
import { useRoom } from '@/lib/roomContext';
import { PaginatedResponse, RoomSessionAction } from '@/lib/types';
import {
  extractPullRequestUrl,
  formatExecutionTimeMs,
  formatFullTimestamp,
  readBlastRadius,
} from '@/lib/utils';
import { DUR, EASE } from '@/lib/motion';

import AgentAvatar from '@/components/ui/AgentAvatar';
import { BlastRadiusChip } from '@/components/ui/BlastRadiusChip';
import { CodeChip } from '@/components/ui/CodeChip';
import DecisionBadge, { decisionColor } from '@/components/ui/DecisionBadge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import JsonViewer from '@/components/ui/JsonViewer';
import { RoomActivitySkeleton } from '@/components/ui/PageSkeletons';
import PaginatedLayout from '@/components/ui/PaginatedLayout';
import { PolicyChip } from '@/components/ui/PolicyChip';
import { PullRequestLink } from '@/components/ui/PullRequestLink';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { Table, TBody, TD, TH, THead, TR, TRExpanded } from '@/components/ui/Table';
import { ToolLogo, getAgentToolId } from '@/components/ui/ToolLogo';

const PAGE_SIZE = 20;

const EMPTY_PAGE: PaginatedResponse<RoomSessionAction> = {
  items: [],
  total: 0,
  page: 1,
  page_size: PAGE_SIZE,
  pages: 0,
};

export default function RoomActivityPage() {
  const { roomId, room, loading: roomLoading, error: roomError } = useRoom();
  const reduce = useReducedMotion();

  const [data, setData] = useState<PaginatedResponse<RoomSessionAction>>(EMPTY_PAGE);
  const [page, setPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Reset to page 1 whenever the URL room changes (e.g. user uses the
  // RoomSwitcher to hop to another room mid-page). Without this, we'd
  // request page=N against a different room that may only have a few rows.
  useEffect(() => {
    setPage(1);
    setExpandedRow(null);
  }, [roomId]);

  const fetchLogs = useCallback(async () => {
    if (!roomId) {
      setData(EMPTY_PAGE);
      return;
    }
    setLogsLoading(true);
    try {
      const result = await api.getSessionsByRoomId(roomId, page, PAGE_SIZE);
      setData(result);
      setError(null);
    } catch (err) {
      if (err instanceof AuthError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLogsLoading(false);
    }
  }, [roomId, page]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh the visible page every 30s, mirroring Runs.
  const { lastUpdated } = useAutoRefresh(fetchLogs, 30000);

  // Room layout shows its own loading state — only short-circuit the
  // activity card when the room itself is in error, so the layout's
  // recovery UI takes over.
  if (roomError) return null;

  // Roomloading -> we still render an empty status bar + skeleton card
  // so the layout doesn't visually pop.
  if (roomLoading && !room) {
    return (
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-7 lg:px-8 lg:pt-8 lg:pb-8">
        <RoomActivitySkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-7 lg:px-8 lg:pt-8 lg:pb-8">
      {error && (
        <div className="mb-4">
          <ErrorBanner
            message={error}
            onDismiss={() => setError(null)}
            onRetry={fetchLogs}
          />
        </div>
      )}

      {/* Status bar — total actions + last-updated + manual refresh.
          Compact strip above the table so the tab doesn't waste a
          screenful on a redundant page header (the layout already
          renders the room name + breadcrumb + tabs). */}
      <motion.div
        className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--stroke-soft-200)] bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DUR.slow, ease: EASE.out }}
      >
        <div className="flex items-center gap-2 text-[12.5px] text-[var(--neutral-sub-600)]">
          <Activity className="h-3.5 w-3.5 text-[var(--neutral-soft-400)]" strokeWidth={2} />
          <span className="tabular-nums font-semibold text-[var(--neutral-strong-950)]">
            {data.total.toLocaleString()}
          </span>
          <span>{data.total === 1 ? 'action' : 'actions'} from your team in this room</span>
        </div>
        <div className="flex items-center gap-3 text-[11.5px] text-[var(--neutral-soft-400)]">
          {lastUpdated && (
            <span>
              Updated{' '}
              <RelativeTime
                timestamp={lastUpdated.toISOString()}
                className="text-[var(--neutral-sub-600)]"
              />
            </span>
          )}
          <button
            type="button"
            onClick={() => void fetchLogs()}
            disabled={logsLoading}
            aria-label="Refresh activity"
            className="inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${logsLoading ? 'animate-spin' : ''}`}
              strokeWidth={2}
              aria-hidden
            />
          </button>
        </div>
      </motion.div>

      {/* The wrapper here owns animation only — no card chrome. Card
          chrome lives ON the branch that needs it: loading/empty
          states render their own bordered surface, while the Table
          branch lets <Table> provide the card. Wrapping both in an
          outer overflow:hidden card would (a) double-stack borders
          and (b) trap the sticky <thead> inside its containing block,
          which is what made the header look "broken" before. */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.06 }}
      >
        {logsLoading && data.items.length === 0 ? (
          <div className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-10 text-center text-[12.5px] text-[var(--neutral-soft-400)] shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            Loading activity…
          </div>
        ) : data.items.length === 0 ? (
          <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <EmptyState
              icon={<History className="h-5 w-5" />}
              title="No activity yet"
              description="Once teammates run agents against this room, every action will show up here with the user that triggered it."
            />
          </div>
        ) : (
          <PaginatedLayout
            total={data.total}
            page={data.page}
            pages={data.pages}
            page_size={data.page_size}
            onPageChange={(next) => {
              setPage(next);
              setExpandedRow(null);
            }}
          >
            <Table>
              <THead>
                <tr>
                  <TH>User</TH>
                  <TH>Tool</TH>
                  <TH>Branch</TH>
                  {/* Combined Policy + Blast radius. Stacked chips
                      inside a single column so the Time column on the
                      right has room to breathe — matches the Runs
                      page pattern. */}
                  <TH>Risk</TH>
                  <TH>Decision</TH>
                  <TH className="text-right">Time</TH>
                  <TH aria-label="Expand" className="w-8" />
                </tr>
              </THead>
              <TBody>
                {data.items.map((action) => (
                  <RoomActivityRow
                    key={action.id}
                    action={action}
                    isExpanded={expandedRow === action.id}
                    onToggle={() =>
                      setExpandedRow(
                        expandedRow === action.id ? null : action.id,
                      )
                    }
                  />
                ))}
              </TBody>
            </Table>
          </PaginatedLayout>
        )}
      </motion.div>
    </div>
  );
}

// ── A single row + its expanded inspector ─────────────────────────────────

function RoomActivityRow({
  action,
  isExpanded,
  onToggle,
}: {
  action: RoomSessionAction;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // Delayed visual-expanded state — keeps the trigger row in its
  // expanded visual treatment until the panel below has finished its
  // exit animation. Same pattern as the Runs row to avoid the "snap
  // back" layout shift while collapsing.
  const [stillExpanded, setStillExpanded] = useState(isExpanded);
  useEffect(() => {
    if (isExpanded) setStillExpanded(true);
  }, [isExpanded]);

  const userLabel = action.username?.trim() || 'Unknown user';
  const toolId = getAgentToolId(action.agent_name || '');
  const prUrl = extractPullRequestUrl({
    action_pointers: action.action_pointers,
    result: action.result,
    arguments: action.arguments,
  });

  return (
    <>
      <TR clickable isExpanded={stillExpanded} onClick={onToggle}>
        <TD>
          <div className="flex items-center gap-2.5">
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: decisionColor(action.decision) }}
              aria-hidden
            />
            <AgentAvatar name={userLabel} size="xs" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[var(--neutral-strong-950)]">
                {userLabel}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--neutral-soft-400)]">
                {toolId ? (
                  <span
                    className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white ring-1 ring-[var(--stroke-soft-200)]"
                    aria-hidden
                  >
                    <ToolLogo id={toolId} size={9} />
                  </span>
                ) : null}
                <span className="truncate">
                  {action.agent_name || 'Unknown agent'}
                </span>
              </p>
            </div>
          </div>
        </TD>
        <TD>
          <CodeChip>{action.tool_name}</CodeChip>
        </TD>
        <TD>
          {action.target_branch ? (
            <CodeChip className="max-w-[220px]">
              <span className="truncate">{action.target_branch}</span>
            </CodeChip>
          ) : null}
        </TD>
        <TD className="whitespace-nowrap">
          {/* Stacked Policy + Blast radius. Both chips return null
              when their underlying value is missing, so an empty cell
              stays clean instead of leaving vertical whitespace. */}
          <div className="flex flex-col items-start gap-1">
            <PolicyChip policy={action.policy} />
            <BlastRadiusChip value={readBlastRadius(action)} />
          </div>
        </TD>
        <TD className="whitespace-nowrap">
          <div className="flex flex-col items-start gap-1">
            <DecisionBadge decision={action.decision} />
            {prUrl && <PullRequestLink url={prUrl} variant="chip" />}
          </div>
        </TD>
        <TD className="text-right tabular-nums">
          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
            <RelativeTime
              timestamp={action.timestamp}
              className="whitespace-nowrap text-[12px] text-[var(--neutral-soft-400)]"
            />
            {(() => {
              const exec = formatExecutionTimeMs(action.execution_time);
              return exec ? <CodeChip>{exec}</CodeChip> : null;
            })()}
          </div>
        </TD>
        <TD className="w-8 text-right">
          <ChevronRight
            className={`ml-auto h-3.5 w-3.5 text-[var(--neutral-soft-400)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--neutral-strong-950)] ${
              isExpanded ? 'rotate-90' : ''
            }`}
            strokeWidth={2}
          />
        </TD>
      </TR>
      <AnimatePresence
        initial={false}
        onExitComplete={() => setStillExpanded(false)}
      >
        {isExpanded && (
          <TRExpanded key="expanded" colSpan={7}>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                  Full summary
                </p>
                {action.action_summary ? (
                  <p className="text-[13px] text-[var(--neutral-strong-950)]">
                    {action.action_summary}
                  </p>
                ) : (
                  <p className="text-[13px] italic text-[var(--neutral-soft-400)]">
                    No summary provided
                  </p>
                )}
                {Array.isArray(action.action_pointers) &&
                  action.action_pointers.length > 0 && (
                    <ul className="mt-3 space-y-1 text-[12px] text-[var(--neutral-sub-600)]">
                      {action.action_pointers.map((p, i) => (
                        <li key={i} className="flex gap-2">
                          <span
                            aria-hidden
                            className="mt-[5px] inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--neutral-soft-400)]"
                          />
                          <span className="break-words">{p}</span>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-[12px] md:grid-cols-4">
                <Meta
                  label="Repository"
                  value={action.target_repo || 'Not recorded'}
                  muted={!action.target_repo}
                />
                <Meta label="Sequence" value={`#${action.sequence_order}`} />
                <Meta
                  label="Session"
                  href={`/dashboard/sessions?id=${action.session_id}`}
                  value={`${action.session_id?.substring(0, 8) ?? ''}…`}
                  mono
                />
                <Meta
                  label="Timestamp"
                  value={formatFullTimestamp(action.timestamp)}
                />
                <Meta
                  label="Execution"
                  value={formatExecutionTimeMs(action.execution_time)}
                />
                <Meta label="User ID" value={action.user_id} mono />
              </div>
            </div>
            {action.arguments && Object.keys(action.arguments).length > 0 && (
              <div className="mt-4">
                <JsonViewer
                  data={action.arguments}
                  collapsed={false}
                  label="Arguments"
                />
              </div>
            )}
          </TRExpanded>
        )}
      </AnimatePresence>
    </>
  );
}

function Meta({
  label,
  value,
  href,
  mono,
  muted,
}: {
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
  /** Render the value in a dim italic style for "not recorded" placeholders. */
  muted?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
        {label}
      </p>
      {href ? (
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className={[
            'mt-0.5 block truncate text-[var(--primary-base)] hover:underline',
            mono
              ? '[font-family:var(--font-geist-mono),ui-monospace,monospace]'
              : '',
          ].join(' ')}
        >
          {value}
        </Link>
      ) : (
        <p
          className={[
            'mt-0.5 truncate',
            muted
              ? 'italic text-[var(--neutral-soft-400)]'
              : 'text-[var(--neutral-strong-950)]',
            mono
              ? '[font-family:var(--font-geist-mono),ui-monospace,monospace]'
              : '',
          ].join(' ')}
          title={value}
        >
          {value}
        </p>
      )}
    </div>
  );
}
