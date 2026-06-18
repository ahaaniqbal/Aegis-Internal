'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { DateRange } from 'react-day-picker';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Search,
  Sparkles,
  Pencil,
  X,
  XCircle,
} from 'lucide-react';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import { SessionAction } from '@/lib/types';
import { formatFullTimestamp, truncate } from '@/lib/utils';
import Topbar from '@/components/layout/Topbar';
import { AgentMark } from '@/components/ui/AgentMark';
import DecisionBadge, { decisionColor } from '@/components/ui/DecisionBadge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import JsonViewer from '@/components/ui/JsonViewer';
import { AuditSkeleton } from '@/components/ui/PageSkeletons';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { CodeChip } from '@/components/ui/CodeChip';
import { FilterChip } from '@/components/ui/FilterChip';
import { useToast } from '@/components/ui/Toast';
import {
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TRExpanded,
} from '@/components/ui/Table';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';

export default function AuditPage() {
  const { user, isLoading: userLoading } = useUser();
  const toast = useToast();
  const reduce = useReducedMotion();
  const [events, setEvents] = useState<SessionAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const pageSize = 20;

  // Filter state — client-side filtering layered over the fetched
  // page. Empty arrays = "all" (no filter). For a governance product
  // with potentially thousands of events, this is the difference
  // between "useless infinite list" and "find every DENY on aegis/api
  // by claude-sonnet last Tuesday." Server-side filtering would be
  // the next step once the backend supports it.
  const [agentFilter, setAgentFilter] = useState<string[]>([]);
  const [decisionFilter, setDecisionFilter] = useState<string[]>([]);
  const [repoFilter, setRepoFilter] = useState<string[]>([]);
  const [toolFilter, setToolFilter] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const initialRange = useMemo<DateRange>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { from: start, to: today };
  }, []);
  const [range, setRange] = useState<DateRange | undefined>(initialRange);

  const startDate = (range?.from ?? initialRange.from!).toISOString().split('T')[0];
  const endDate = (range?.to ?? range?.from ?? initialRange.to!).toISOString().split('T')[0];

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      if (!userLoading) {
        setEvents([]);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      const data = await api.getAuditTrail(user.id, pageSize, page * pageSize);
      setEvents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, user?.id, userLoading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derive unique filter options from the loaded events. Memoized
  // so we don't rebuild the option arrays on every render — only
  // when the events list changes.
  const filterOptions = useMemo(() => {
    const agents = new Set<string>();
    const decisions = new Set<string>();
    const repos = new Set<string>();
    const tools = new Set<string>();
    for (const ev of events) {
      if (ev.agent_name) agents.add(ev.agent_name);
      if (ev.decision) decisions.add(ev.decision);
      if (ev.target_repo) repos.add(ev.target_repo);
      if (ev.tool_name) tools.add(ev.tool_name);
    }
    const sorted = (s: Set<string>) =>
      Array.from(s)
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value }));
    return {
      agents: sorted(agents),
      decisions: sorted(decisions),
      repos: sorted(repos),
      tools: sorted(tools),
    };
  }, [events]);

  // Apply all filters + free-text search to derive the visible rows.
  // Free-text matches across summary, tool, repo, branch, and agent —
  // covers most reviewer use cases ("find anything mentioning X").
  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter((ev) => {
      if (agentFilter.length && !agentFilter.includes(ev.agent_name)) {
        return false;
      }
      if (decisionFilter.length && !decisionFilter.includes(ev.decision)) {
        return false;
      }
      if (repoFilter.length && !repoFilter.includes(ev.target_repo ?? '')) {
        return false;
      }
      if (toolFilter.length && !toolFilter.includes(ev.tool_name)) {
        return false;
      }
      if (q) {
        const hay = [
          ev.action_summary,
          ev.tool_name,
          ev.target_repo,
          ev.target_branch,
          ev.agent_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, agentFilter, decisionFilter, repoFilter, toolFilter, searchQuery]);

  // Tracks whether any non-date filter is active. Drives the
  // "Clear filters" affordance in the filter bar.
  const hasActiveFilters =
    agentFilter.length > 0 ||
    decisionFilter.length > 0 ||
    repoFilter.length > 0 ||
    toolFilter.length > 0 ||
    searchQuery.trim().length > 0;

  const clearAllFilters = () => {
    setAgentFilter([]);
    setDecisionFilter([]);
    setRepoFilter([]);
    setToolFilter([]);
    setSearchQuery('');
  };

  const exportJson = async () => {
    if (!user?.id) {
      setError('No authenticated user found for export');
      return;
    }
    try {
      const allEvents = await api.getAuditTrailByDateRange(
        user.id,
        `${startDate}T00:00:00Z`,
        `${endDate}T23:59:59Z`,
      );
      const exportData = {
        exported_at: new Date().toISOString(),
        exported_by: user?.username || 'unknown',
        total_records: allEvents.length,
        events: allEvents,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aegis-audit-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Audit trail exported', {
        description: `${allEvents.length.toLocaleString()} events downloaded as JSON.`,
      });
    } catch (err) {
      setError('Failed to export audit trail');
      toast.error('Export failed', {
        description:
          err instanceof Error
            ? err.message
            : 'Could not download the audit trail. Try again.',
      });
    }
  };

  if (userLoading || (loading && events.length === 0)) {
    return (
      <>
        <Topbar title="Audit Trail" subtitle="Immutable event log" />
        <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <AuditSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Audit Trail" subtitle="Immutable event log" />
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
            Audit trail
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
          >
            The immutable record of every decision
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-2 text-[13.5px] text-[var(--neutral-sub-600)]"
          >
            Every agent action gets a row here. Filter by date, expand for arguments, export as JSON.
          </motion.p>
        </motion.header>

        {/* Filter bar — all controls in a single wrap row:
            date range, filter chips (agent / decision / repo / tool),
            free-text search, and Export. Was previously split across
            two rows separated by a divider, which made the panel feel
            taller than the actions justified. Single row with
            flex-wrap means everything sits on one line on wide
            viewports and reflows cleanly on narrow ones. */}
        <motion.div
          className="mb-6 rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-3 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.18 }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker
              value={range}
              onChange={setRange}
              defaultPreset="last7"
              size="sm"
            />
            <FilterChip
              label="Agent"
              options={filterOptions.agents}
              value={agentFilter}
              onChange={setAgentFilter}
            />
            <FilterChip
              label="Decision"
              options={filterOptions.decisions}
              value={decisionFilter}
              onChange={setDecisionFilter}
            />
            <FilterChip
              label="Repository"
              options={filterOptions.repos}
              value={repoFilter}
              onChange={setRepoFilter}
            />
            <FilterChip
              label="Tool"
              options={filterOptions.tools}
              value={toolFilter}
              onChange={setToolFilter}
            />
            {/* Free-text search — flex-1 so it expands to fill
                the row. Searches across summary, tool, repo, branch,
                agent. */}
            <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-[280px]">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--neutral-soft-400)]"
                strokeWidth={2}
                aria-hidden
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events…"
                aria-label="Search audit events"
                className="h-7 w-full rounded-[8px] border border-[var(--stroke-sub-300)] bg-white pl-7 pr-2.5 text-[12px] font-medium text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)] shadow-[var(--shadow-regular-xs)] focus:border-[var(--neutral-soft-400)] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--neutral-soft-400)] transition-colors hover:text-[var(--neutral-strong-950)]"
                >
                  <X className="h-3 w-3" strokeWidth={2.25} />
                </button>
              )}
            </div>
            {/* Clear-all only renders when something is filtering.
                Subtle ghost button so it doesn't compete with the
                primary controls when no filters are active. */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex h-7 items-center gap-1 rounded-[8px] px-2 text-[11.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--primary-lighter)]/50 hover:text-[var(--error)]"
              >
                <X className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                Clear filters
              </button>
            )}
            {/* Export sits at the end of the single-row filter bar.
                Compact size="sm" so it matches the height of the
                filter chips and search input (h-7) instead of
                breaking the row's rhythm with a taller button. */}
            <Button
              variant="secondary"
              size="sm"
              onClick={exportJson}
              disabled={!user?.id || userLoading}
              leadingIcon={<Download className="h-3 w-3" strokeWidth={2} />}
            >
              Export JSON
            </Button>
          </div>
          {/* Result-count strip — only shows when filtering is
              active, surfaces "X of Y" so the user can verify the
              filter is doing what they expect. */}
          {hasActiveFilters && (
            <div className="mt-2.5 text-[11px] text-[var(--neutral-soft-400)]">
              Showing {filteredEvents.length.toLocaleString()} of{' '}
              {events.length.toLocaleString()} loaded events
            </div>
          )}
        </motion.div>

        {loading ? (
          <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-[var(--stroke-soft-200)] px-[18px] py-[14px] last:border-b-0"
              >
                <div className="w-[180px]"><Skeleton className="h-[13px] w-32" /></div>
                <div className="flex-1"><Skeleton className="h-[13px] w-24" /></div>
                <div className="w-[100px]"><Skeleton className="h-[13px] w-16" /></div>
                <div className="flex-1"><Skeleton className="h-[13px] w-40" /></div>
                <div className="w-[140px]"><Skeleton className="h-[13px] w-20" /></div>
                <div className="w-[80px]"><Skeleton className="h-[19px] w-16 rounded-[6px]" /></div>
                <div className="w-6"><Skeleton className="h-[13px] w-4" /></div>
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            {events.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-5 w-5" />}
                title="No audit events yet"
                description="Once your agent runs its first action, every decision is logged here with the tool, arguments, and policy outcome."
              />
            ) : (
              // Filtered-empty state — clarifies that data exists,
              // just nothing matches the current filters. Offers an
              // immediate path out.
              <EmptyState
                icon={<FileText className="h-5 w-5" />}
                title="No events match your filters"
                description="Adjust or clear the filters to see other events from this date range."
                action={
                  <Button variant="secondary" onClick={clearAllFilters}>
                    Clear filters
                  </Button>
                }
              />
            )}
          </div>
        ) : (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.26 }}
          >
            <Table>
              <THead>
                <tr>
                  <TH className="w-[180px]">Timestamp</TH>
                  <TH>Agent</TH>
                  <TH>Tool</TH>
                  <TH>Summary</TH>
                  <TH>Repository</TH>
                  <TH>Decision</TH>
                  <TH aria-label="Expand" className="w-8" />
                </tr>
              </THead>
              <TBody>
                {filteredEvents.map((event) => (
                  <AuditRow
                    key={event.id}
                    event={event}
                    isExpanded={expandedRow === event.id}
                    onToggle={() =>
                      setExpandedRow(expandedRow === event.id ? null : event.id)
                    }
                  />
                ))}
              </TBody>
            </Table>

            <div className="mt-4 flex items-center justify-between text-[12.5px] text-[var(--neutral-soft-400)]">
              <span>Page {page + 1}</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  leadingIcon={<ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />}
                >
                  Prev
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={events.length < pageSize}
                  trailingIcon={<ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />}
                >
                  Next
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </>
  );
}

function DecisionIcon({ decision }: { decision: string }) {
  const upper = (decision ?? '').toUpperCase();
  const color = decisionColor(decision);

  let Icon = CheckCircle2;
  if (upper === 'DENY' || upper === 'REJECTED' || upper === 'DENIED') Icon = XCircle;
  // REWRITE icon iteration history: started as Wand2 ("AI magic" vibe,
  // wrong for a security tool), tried Replace ("barely understandable
  // at small sizes" per user feedback). Pencil is the universal
  // "edited / modified" icon — instantly recognizable at 14px and
  // doesn't carry the AI-magic connotation Wand2 did.
  else if (upper === 'REWRITE') Icon = Pencil;
  else if (upper.includes('APPROVAL') || upper === 'PENDING') Icon = Sparkles;

  return (
    <Icon
      className="h-3.5 w-3.5 shrink-0"
      style={{ color }}
      strokeWidth={2}
      aria-hidden
    />
  );
}

function AuditRow({
  event,
  isExpanded,
  onToggle,
}: {
  event: SessionAction;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // Keep the trigger row in its expanded visual state (gradient, no
  // divider) until the panel's exit animation completes. Otherwise the
  // row "snaps back" with the divider re-appearing while the panel is
  // still collapsing — perceived as a layout shift.
  const [stillExpanded, setStillExpanded] = useState(isExpanded);
  useEffect(() => {
    if (isExpanded) setStillExpanded(true);
  }, [isExpanded]);

  return (
    <>
      <TR clickable isExpanded={stillExpanded} onClick={onToggle}>
        <TD className="whitespace-nowrap text-[11.5px] text-[var(--neutral-sub-600)]">
          {formatFullTimestamp(event.timestamp)}
        </TD>
        <TD>
          <div className="flex items-center gap-2">
            <DecisionIcon decision={event.decision} />
            <AgentMark name={event.agent_name || ''} size="xs" />
            <span className="font-medium text-[var(--neutral-strong-950)]">
              {event.agent_name || 'Unknown'}
            </span>
          </div>
        </TD>
        <TD>
          <CodeChip>{event.tool_name}</CodeChip>
        </TD>
        <TD className="text-[var(--neutral-sub-600)]">
          {truncate(event.action_summary, 40)}
        </TD>
        <TD className="text-[var(--neutral-sub-600)]">{event.target_repo}</TD>
        <TD>
          <DecisionBadge decision={event.decision} />
        </TD>
        <TD className="w-8 pr-3 text-right">
          <ChevronDown
            className={`ml-auto h-3.5 w-3.5 text-[var(--neutral-soft-400)] transition-transform ${
              isExpanded ? 'rotate-180' : ''
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
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
            Full Summary
          </p>
          <p className="text-[13px] text-[var(--neutral-strong-950)]">
            {event.action_summary || '—'}
          </p>
          {event.arguments && (
            <div className="mt-3">
              <JsonViewer data={event.arguments} collapsed={false} label="Arguments" />
            </div>
          )}
        </TRExpanded>
      )}
      </AnimatePresence>
    </>
  );
}
