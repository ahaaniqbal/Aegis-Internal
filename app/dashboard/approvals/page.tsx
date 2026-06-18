'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Bell, Check, ChevronDown, ChevronRight, Clock, Minus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import { MCPApproval } from '@/lib/types';
import { extractPullRequestUrl, formatRelativeTime } from '@/lib/utils';
import { RelativeTime } from '@/components/ui/RelativeTime';
import Topbar from '@/components/layout/Topbar';
import { AgentMark } from '@/components/ui/AgentMark';
import DecisionBadge from '@/components/ui/DecisionBadge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import JsonViewer from '@/components/ui/JsonViewer';
import { ApprovalsSkeleton } from '@/components/ui/PageSkeletons';
import { BulkActionBar } from '@/components/ui/BulkActionBar';
import { Button } from '@/components/ui/Button';
import { CodeChip } from '@/components/ui/CodeChip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FreshnessBanner } from '@/components/ui/FreshnessBanner';
import { PullRequestLink } from '@/components/ui/PullRequestLink';
import { useToast } from '@/components/ui/Toast';
import { DUR, EASE, fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';
import { AuthError } from '@/lib/api';
import { useRouter } from 'next/navigation';

type ApprovalFilter = 'all' | 'pending' | 'approved' | 'rejected';

// ─── Pending-card visual treatment (FLAG) ──────────────────────────
//
// The pending approval cards previously used a loud pinkish wash
// (full-card gradient from primary-lighter). That reads as urgent
// but heavy, and clashes with the more restrained inset-tint
// pattern we use on the Decision Overview hero on the Dashboard
// and the freeze-window status banner.
//
// Flip this flag to `false` to revert the pending cards to the
// original loud treatment — useful if the subtler version turns
// out to under-signal "urgency" once we have real volume in the
// approval queue. No other code paths are affected.
const USE_INSET_GRADIENT_ON_APPROVAL_CARDS = true;

// Inset gradient values — same shape as the Decision Overview hero.
// `pending` = subtle 7% top fade; `selected` = stronger 14% top
// fade so the "queued for batch action" state still anchors
// against a row of unselected pending cards.
const APPROVAL_CARD_GRADIENTS = {
  pending:
    'linear-gradient(180deg, rgba(250, 115, 25, 0.07) 0%, rgba(250, 115, 25, 0.03) 28%, rgba(255, 255, 255, 0) 60%)',
  selected:
    'linear-gradient(180deg, rgba(250, 115, 25, 0.14) 0%, rgba(250, 115, 25, 0.07) 28%, rgba(255, 255, 255, 0) 65%)',
} as const;

function normalizeStatus(status: string): 'pending' | 'approved' | 'rejected' {
  const value = (status ?? '').toLowerCase();
  if (value === 'approved' || value === 'rejected') return value;
  return 'pending';
}

const FILTER_TABS: { value: ApprovalFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function ApprovalsPage() {
  const { user, isLoading: userLoading } = useUser();
  const reduce = useReducedMotion();
  const router = useRouter();
  const toast = useToast();
  const [approvals, setApprovals] = useState<MCPApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ApprovalFilter>('all');
  const [actioningIds, setActioningIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Pending Deny confirmation — null when no dialog is open. Storing
  // the full approval (not just the id) gives the dialog context for
  // its description (tool name + agent + repo). Approve is fire-and-
  // forget, no confirm — only Deny gates because it's destructive
  // (agent's session gets blocked, cascading effects).
  const [pendingDeny, setPendingDeny] = useState<MCPApproval | null>(null);
  // Bulk selection. Only pending approvals are selectable — already-
  // approved/denied items have nothing to bulk-action against. The
  // floating BulkActionBar appears when this set is non-empty.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Pending bulk-deny confirmation. When non-empty, the ConfirmDialog
  // opens with "Deny N requests?" copy. Separate from single-row
  // pendingDeny so the two confirmation flows don't conflict.
  const [pendingBulkDeny, setPendingBulkDeny] = useState<string[] | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  // Freshness tracking — `seenPendingIds` is the set of pending-
  // approval ids the user has acknowledged. Every poll diffs the
  // current pending set against this; the difference count drives
  // the floating "N new" pill at the top of the page. A ref (not
  // state) because we never want a seen-ids change to trigger a
  // rerender — only the derived `newCount` should.
  const seenPendingIdsRef = useRef<Set<string>>(new Set());
  const [newCount, setNewCount] = useState(0);

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      if (!userLoading) {
        setApprovals([]);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      const data = await api.getMcpApprovals(user.id);
      setApprovals(data);
      setError(null);

      // Compute the freshness count — how many pending ids in the
      // newly-fetched data are NOT in the seen set yet. The very
      // first fetch (seen set empty) primes the seen set silently
      // so we don't flash "N new" for the initial load.
      const currentPending = data
        .filter((a) => normalizeStatus(a.status) === 'pending')
        .map((a) => a.id);
      if (seenPendingIdsRef.current.size === 0) {
        // First fetch — prime, don't count.
        seenPendingIdsRef.current = new Set(currentPending);
        setNewCount(0);
      } else {
        const fresh = currentPending.filter(
          (id) => !seenPendingIdsRef.current.has(id),
        );
        setNewCount(fresh.length);
      }
    } catch (err) {
      if (err instanceof AuthError) {
        router.push('/auth');
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load approvals'
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id, userLoading]);

  useEffect(() => {
    if (user?.id) fetchData();
    else if (!userLoading) {
      setApprovals([]);
      setLoading(false);
    }
  }, [user?.id, userLoading, fetchData]);

  const { lastUpdated } = useAutoRefresh(fetchData, 30000);

  const handleAction = async (id: string, reject: boolean) => {
    setActioningIds((prev) => new Set(prev).add(id));
    try {
      await api.executeMcpApproval(id, reject);
      setError(null);
      await fetchData();
      if (reject) {
        toast.warning('Request denied', {
          description: 'The agent will receive the rejection.',
        });
      } else {
        toast.success('Request approved', {
          description: 'The agent can proceed with the action.',
        });
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to update approval status';
      setError(msg);
      toast.error("Couldn't update approval", { description: msg });
    } finally {
      setActioningIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Bulk-approve all currently-selected pending approvals. Fires
  // sequentially (one at a time) rather than parallel — the
  // backend handles single approvals atomically, and parallel
  // requests would race on the dependent state. Sequential keeps
  // ordering predictable and lets a single failure short-circuit
  // the batch.
  const handleBulkApprove = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(true);
    setActioningIds(new Set(ids));
    let succeeded = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await api.executeMcpApproval(id, false);
        succeeded += 1;
      } catch {
        failed += 1;
      }
    }
    await fetchData();
    setSelectedIds(new Set());
    setActioningIds(new Set());
    setBulkBusy(false);
    if (failed === 0) {
      toast.success(
        succeeded === 1
          ? '1 request approved'
          : `${succeeded.toLocaleString()} requests approved`,
        { description: 'The agents can proceed with their actions.' },
      );
    } else {
      toast.warning(
        `${succeeded.toLocaleString()} approved, ${failed.toLocaleString()} failed`,
        { description: 'Some requests could not be processed. Try again.' },
      );
    }
  };

  // Bulk-deny — same sequential pattern as bulk approve. Wired
  // through the ConfirmDialog so a careless click can't fire a
  // batch of denials (cascading effects: every agent in the batch
  // gets blocked).
  const handleBulkDeny = async () => {
    if (!pendingBulkDeny) return;
    const ids = pendingBulkDeny;
    setBulkBusy(true);
    setActioningIds(new Set(ids));
    let succeeded = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await api.executeMcpApproval(id, true);
        succeeded += 1;
      } catch {
        failed += 1;
      }
    }
    await fetchData();
    setSelectedIds(new Set());
    setActioningIds(new Set());
    setPendingBulkDeny(null);
    setBulkBusy(false);
    if (failed === 0) {
      toast.warning(
        succeeded === 1
          ? '1 request denied'
          : `${succeeded.toLocaleString()} requests denied`,
        { description: 'The agents have been notified.' },
      );
    } else {
      toast.error(
        `${succeeded.toLocaleString()} denied, ${failed.toLocaleString()} failed`,
        { description: 'Some denials could not be processed. Try again.' },
      );
    }
  };

  const counts = useMemo(
    () =>
      approvals.reduce(
        (acc, approval) => {
          const normalized = normalizeStatus(approval.status);
          acc[normalized] += 1;
          return acc;
        },
        { pending: 0, approved: 0, rejected: 0 } as Record<
          'pending' | 'approved' | 'rejected',
          number
        >,
      ),
    [approvals],
  );

  const filteredApprovals = useMemo(
    () =>
      approvals.filter((approval) => {
        if (statusFilter === 'all') return true;
        return normalizeStatus(approval.status) === statusFilter;
      }),
    [approvals, statusFilter],
  );

  const tabCount = (tab: ApprovalFilter) =>
    tab === 'all' ? approvals.length : counts[tab];

  // Select-all derived state — only pending approvals can be
  // bulk-actioned, so the "select all" affordance scopes to the
  // VISIBLE pending items (filtered by the status tabs).
  //
  // selectionState has three values that map to a tri-state checkbox:
  //   • 'none'    → nothing selected (empty box)
  //   • 'partial' → some-but-not-all selected (minus icon)
  //   • 'all'     → every visible pending row selected (check icon)
  //
  // Toggle behavior: clicking the checkbox flips between 'all' ↔
  // anything-else. Partial selections collapse to either all or none
  // depending on intent — Mercury / Linear both jump to 'all' on
  // first click from a partial state (assumes the user wants more,
  // not less). We do the same.
  const visiblePendingIds = useMemo(
    () =>
      filteredApprovals
        .filter((a) => normalizeStatus(a.status) === 'pending')
        .map((a) => a.id),
    [filteredApprovals],
  );
  const visiblePendingCount = visiblePendingIds.length;
  const selectedVisibleCount = visiblePendingIds.filter((id) =>
    selectedIds.has(id),
  ).length;
  const selectionState: 'none' | 'partial' | 'all' =
    selectedVisibleCount === 0
      ? 'none'
      : selectedVisibleCount === visiblePendingCount
      ? 'all'
      : 'partial';

  const toggleSelectAll = () => {
    if (selectionState === 'all') {
      setSelectedIds(new Set());
    } else {
      // Preserve any selections from items outside the current
      // filter (e.g. a previously-selected pending item that the
      // current tab doesn't display) so the user doesn't lose state
      // when toggling filters.
      const next = new Set(selectedIds);
      visiblePendingIds.forEach((id) => next.add(id));
      setSelectedIds(next);
    }
  };

  if (userLoading || loading) {
    return (
      <>
        <Topbar title="Approvals" subtitle="Actions requiring review" />
        <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <ApprovalsSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Approvals"
        subtitle="Actions requiring review"
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
        unreadCount={counts.pending}
      />
      {/* Floating freshness pill — appears below the topbar when
          auto-refresh detects new pending approvals the reviewer
          hasn't acknowledged yet. Click → ack all + scroll to top. */}
      <FreshnessBanner
        count={newCount}
        label="new approval"
        onReveal={() => {
          // Add every current pending id to the seen set, then
          // clear the counter. Scroll to top so the reviewer lands
          // on the freshest items.
          seenPendingIdsRef.current = new Set(
            approvals
              .filter((a) => normalizeStatus(a.status) === 'pending')
              .map((a) => a.id),
          );
          setNewCount(0);
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
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
            Approvals queue
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
          >
            Review what your agents want to do
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-2 text-[13.5px] text-[var(--neutral-sub-600)]"
          >
            <span className="font-semibold" style={{ color: 'var(--primary-base)' }}>
              {counts.pending.toLocaleString()}
            </span>{' '}
            pending,{' '}
            <span className="font-semibold" style={{ color: 'var(--success)' }}>
              {counts.approved.toLocaleString()}
            </span>{' '}
            approved,{' '}
            <span className="font-semibold" style={{ color: 'var(--error)' }}>
              {counts.rejected.toLocaleString()}
            </span>{' '}
            rejected.
          </motion.p>
        </motion.header>

        {/* Filter tabs */}
        <motion.div
          className="mb-6 inline-flex gap-1 rounded-[10px] border border-[var(--stroke-soft-200)] bg-white p-1 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.default, ease: EASE.out, delay: 0.18 }}
        >
          {FILTER_TABS.map((tab) => {
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={[
                  'inline-flex h-7 items-center gap-1.5 rounded-[7px] px-3 text-[12.5px] font-medium transition-colors',
                  active
                    ? 'bg-[var(--primary-alpha-10)] text-[var(--primary-base)]'
                    : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
                ].join(' ')}
              >
                {tab.label}
                <span
                  className="text-[10.5px] font-bold tabular-nums"
                  style={{
                    color: active ? 'var(--primary-base)' : 'var(--neutral-soft-400)',
                  }}
                >
                  {tabCount(tab.value).toLocaleString()}
                </span>
              </button>
            );
          })}
        </motion.div>

        {/* Select-all row — only renders when there's at least one
            visible pending approval to act on. Tri-state checkbox
            (empty / minus / check) mirrors the canonical Mercury +
            Linear pattern for bulk-selection chrome. Label updates
            with the state to make the affordance obvious without
            needing a tooltip. */}
        {visiblePendingCount > 0 && (
          <div className="mb-3 px-1">
            <label className="group/sa inline-flex cursor-pointer items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={selectionState === 'all'}
                onChange={toggleSelectAll}
                aria-label={
                  selectionState === 'all'
                    ? 'Clear selection'
                    : `Select all ${visiblePendingCount} pending`
                }
                className="peer sr-only"
              />
              <span
                className={`inline-flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors ${
                  selectionState === 'none'
                    ? 'border-[var(--stroke-sub-300)] bg-white text-transparent group-hover/sa:border-[var(--neutral-soft-400)]'
                    : 'border-[var(--primary-base)] bg-[var(--primary-base)] text-white'
                } peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--primary-alpha-24)]`}
                aria-hidden
              >
                {selectionState === 'all' && (
                  <Check className="h-3 w-3" strokeWidth={2.75} />
                )}
                {selectionState === 'partial' && (
                  <Minus className="h-3 w-3" strokeWidth={3} />
                )}
              </span>
              <span className="text-[12.5px] font-medium tracking-[-0.005em] text-[var(--neutral-sub-600)] transition-colors group-hover/sa:text-[var(--neutral-strong-950)]">
                {selectionState === 'none' &&
                  `Select all ${visiblePendingCount.toLocaleString()} pending`}
                {selectionState === 'partial' &&
                  `${selectedVisibleCount.toLocaleString()} of ${visiblePendingCount.toLocaleString()} selected`}
                {selectionState === 'all' &&
                  `All ${visiblePendingCount.toLocaleString()} selected`}
              </span>
            </label>
          </div>
        )}

        {filteredApprovals.length === 0 ? (
          <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <EmptyState
              icon={<Bell className="h-5 w-5" />}
              title={statusFilter === 'pending' ? 'All clear' : 'Nothing here'}
              description={
                statusFilter === 'pending'
                  ? 'No approvals waiting for review.'
                  : 'No approval requests match this filter.'
              }
            />
          </div>
        ) : (
          <motion.ul
            className="space-y-3"
            variants={staggerContainer(0.04, 0.26)}
            initial={reduce ? false : 'hidden'}
            animate="show"
          >
            {filteredApprovals.map((approval) => {
              const approvalStatus = normalizeStatus(approval.status);
              const isPending = approvalStatus === 'pending';
              const isActioning = actioningIds.has(approval.id);
              const isExpanded = expanded.has(approval.id);
              const toggle = () =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(approval.id)) next.delete(approval.id);
                  else next.add(approval.id);
                  return next;
                });

              const contextUser =
                typeof approval.context?.user === 'string'
                  ? approval.context.user
                  : 'Agent';
              const repo =
                typeof approval.arguments?.repo === 'string'
                  ? approval.arguments.repo
                  : null;
              const branch =
                typeof approval.arguments?.branch === 'string'
                  ? approval.arguments.branch
                  : null;
              const summary =
                typeof approval.action_summary === 'string'
                  ? approval.action_summary
                  : `Requested tool: ${approval.tool_name}`;

              const prUrl = extractPullRequestUrl({
                action_pointers: approval.action_pointers,
                result: approval.result,
                context: approval.context,
                arguments: approval.arguments,
              });

              return (
                <ApprovalItem
                  key={approval.id}
                  approval={approval}
                  contextUser={contextUser}
                  summary={summary}
                  repo={repo}
                  branch={branch}
                  prUrl={prUrl}
                  isPending={isPending}
                  isActioning={isActioning}
                  isExpanded={isExpanded}
                  toggle={toggle}
                  isSelected={selectedIds.has(approval.id)}
                  onSelectChange={(checked) => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(approval.id);
                      else next.delete(approval.id);
                      return next;
                    });
                  }}
                  onAction={(id, reject) => {
                    // Approve fires immediately; Deny gates through
                    // a confirmation dialog. Denial blocks the agent's
                    // session + cascades into the audit log, so an
                    // accidental click should not commit it.
                    if (reject) {
                      const target = approvals.find((a) => a.id === id);
                      if (target) setPendingDeny(target);
                    } else {
                      handleAction(id, false);
                    }
                  }}
                />
              );
            })}
          </motion.ul>
        )}
      </div>
      {/* Deny confirmation. The description surfaces the action's
          tool + repo so a reviewer can sanity-check what they're
          about to block before committing. Closes on Cancel; on
          Confirm, runs the real deny path. */}
      <ConfirmDialog
        open={pendingDeny !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeny(null);
        }}
        variant="danger"
        title="Deny this action?"
        description={
          pendingDeny ? (
            <>
              The agent will be blocked from running{' '}
              <span className="font-mono text-[12.5px] text-[var(--neutral-strong-950)]">
                {pendingDeny.tool_name}
              </span>{' '}
              on{' '}
              <span className="font-mono text-[12.5px] text-[var(--neutral-strong-950)]">
                {pendingDeny.arguments?.repo ?? 'this repository'}
              </span>
              . The denial appears in the audit log and can't be undone.
            </>
          ) : null
        }
        confirmLabel="Deny request"
        loading={pendingDeny ? actioningIds.has(pendingDeny.id) : false}
        onConfirm={async () => {
          if (!pendingDeny) return;
          const id = pendingDeny.id;
          setPendingDeny(null);
          await handleAction(id, true);
        }}
      />
      {/* Bulk action toolbar — appears when one or more pending
          approvals are selected. Mercury Bank pattern: floating
          pill at bottom-center with action buttons + clear control.
          The Approve-all path is fire-and-forget; Deny-all gates
          through its own ConfirmDialog because the batch effect
          (multiple agent sessions blocked) is destructive. */}
      <BulkActionBar
        count={selectedIds.size}
        itemLabel="request"
        onClear={() => setSelectedIds(new Set())}
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={bulkBusy}
              onClick={() => setPendingBulkDeny(Array.from(selectedIds))}
              leadingIcon={<X className="h-3.5 w-3.5" strokeWidth={2} />}
            >
              Deny all
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={bulkBusy}
              onClick={handleBulkApprove}
              leadingIcon={<Check className="h-3.5 w-3.5" strokeWidth={2.25} />}
            >
              Approve all
            </Button>
          </>
        }
      />
      {/* Bulk-deny confirmation. Same destructive guard as the
          single-deny dialog, scaled to the batch — copy reflects
          the count so the reviewer knows the blast radius. */}
      <ConfirmDialog
        open={pendingBulkDeny !== null}
        onOpenChange={(open) => {
          if (!open && !bulkBusy) setPendingBulkDeny(null);
        }}
        variant="danger"
        title={
          pendingBulkDeny && pendingBulkDeny.length === 1
            ? 'Deny this request?'
            : `Deny ${pendingBulkDeny?.length.toLocaleString() ?? 0} requests?`
        }
        description={
          pendingBulkDeny ? (
            <>
              {pendingBulkDeny.length === 1 ? 'The agent' : 'These agents'} will
              be blocked from running their requested actions. All denials
              appear in the audit log and can't be undone.
            </>
          ) : null
        }
        confirmLabel={
          pendingBulkDeny && pendingBulkDeny.length === 1
            ? 'Deny request'
            : `Deny ${pendingBulkDeny?.length.toLocaleString() ?? 0}`
        }
        loading={bulkBusy}
        onConfirm={handleBulkDeny}
      />
    </>
  );
}

function ApprovalItem({
  approval,
  contextUser,
  summary,
  repo,
  branch,
  prUrl,
  isPending,
  isActioning,
  isExpanded,
  toggle,
  onAction,
  isSelected,
  onSelectChange,
}: {
  approval: MCPApproval;
  contextUser: string;
  summary: string;
  repo: string | null;
  branch: string | null;
  prUrl: string | null;
  isPending: boolean;
  isActioning: boolean;
  isExpanded: boolean;
  toggle: () => void;
  onAction: (id: string, reject: boolean) => void;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
}) {
  // Container styling — branched on the inset-gradient feature flag
  // so reverting to the loud-pink original is a one-line change.
  //   • Inset-gradient mode (default): white card + neutral stroke +
  //     absolutely-positioned 4px-inset gradient overlay (rendered
  //     below). Mirrors Decision Overview / freeze status banner.
  //   • Legacy mode: full-card pinkish gradient with a primary
  //     border tint, matching the historical approval-page look.
  const containerClass = isPending
    ? isSelected
      ? USE_INSET_GRADIENT_ON_APPROVAL_CARDS
        ? // Selected + inset: keep the colored border + ring so the
          // "queued for batch action" anchor reads clearly; the
          // gradient itself is the stronger of the two presets.
          'border-[var(--primary-base)]/40 bg-white ring-1 ring-[var(--primary-base)]/25'
        : 'border-[var(--primary-base)]/50 bg-gradient-to-b from-[var(--primary-alpha-16)] via-[var(--primary-alpha-10)] to-[var(--white-0)] ring-1 ring-[var(--primary-base)]/30'
      : USE_INSET_GRADIENT_ON_APPROVAL_CARDS
        ? // Unselected + inset: neutral stroke, white card surface.
          // All color signal comes from the inset overlay below.
          'border-[var(--stroke-soft-200)] bg-white'
        : 'border-[var(--primary-base)]/20 bg-gradient-to-b from-[var(--primary-lighter)]/55 via-[var(--white-0)] to-[var(--white-0)]'
    : 'border-[var(--stroke-soft-200)] bg-white opacity-75';

  return (
    <motion.li
      variants={fadeUpSm}
      data-card-hover
      className={`group relative overflow-hidden rounded-[12px] border shadow-[0_1px_2px_rgba(23,23,23,0.04)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.06)] transition-colors ${containerClass}`}
    >
      {/* Inset tinted gradient overlay — same shape as the Decision
          Overview hero. Only rendered for pending cards and only
          when the flag is on, so resolved (approved/rejected) cards
          stay clean neutral. */}
      {USE_INSET_GRADIENT_ON_APPROVAL_CARDS && isPending && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-1 rounded-[8px]"
          style={{
            background: isSelected
              ? APPROVAL_CARD_GRADIENTS.selected
              : APPROVAL_CARD_GRADIENTS.pending,
          }}
        />
      )}

      <div className="relative p-5">
        {/* Top row: avatar + agent + meta on left, status pill on right */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* Selection checkbox — visible only for pending rows
                (already-resolved approvals have nothing to bulk-action
                against). Click toggles selection; the row's gradient
                deepens above. Matches the FilterChip checkbox pattern:
                a visually-hidden native input (kept for keyboard +
                screen-reader access) with a styled span beside it
                that shows the actual Check icon when selected. */}
            {isPending && (
              <label className="group/cb relative flex shrink-0 cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => onSelectChange(e.target.checked)}
                  aria-label={`Select request from ${contextUser}`}
                  className="peer sr-only"
                />
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors ${
                    isSelected
                      ? 'border-[var(--primary-base)] bg-[var(--primary-base)] text-white'
                      : 'border-[var(--stroke-sub-300)] bg-white text-transparent group-hover/cb:border-[var(--neutral-soft-400)]'
                  } peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--primary-alpha-24)]`}
                  aria-hidden
                >
                  <Check className="h-3 w-3" strokeWidth={2.75} />
                </span>
              </label>
            )}
            <AgentMark name={contextUser} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-[var(--neutral-strong-950)]">
                {contextUser}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[var(--neutral-soft-400)]">
                <Clock className="h-3 w-3" strokeWidth={2} />
                <RelativeTime timestamp={approval.created_at} />
                {approval.approved_at && (
                  <>
                    <span>·</span>
                    <span>actioned <RelativeTime timestamp={approval.approved_at} /></span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <DecisionBadge decision={approval.status} />
            {prUrl && <PullRequestLink url={prUrl} variant="chip" />}
          </div>
        </div>

        {/* Action summary — headline */}
        <p className="mt-4 text-[14.5px] font-medium leading-[1.5] tracking-[-0.01em] text-[var(--neutral-strong-950)]">
          {summary}
        </p>

        {/* Metadata grid — labeled cells separated from the action summary
            by a thin top divider, no surrounding panel surface so the
            CodeChips read cleanly against pure white. */}
        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-[var(--stroke-soft-200)] pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetaCell label="Tool">
            <CodeChip>{approval.tool_name}</CodeChip>
          </MetaCell>
          {repo && (
            <MetaCell label="Repository">
              <CodeChip>{repo}</CodeChip>
            </MetaCell>
          )}
          {branch && (
            <MetaCell label="Branch">
              <CodeChip>{branch}</CodeChip>
            </MetaCell>
          )}
          {approval.context?.model && (
            <MetaCell label="Model">
              <CodeChip>{String(approval.context.model)}</CodeChip>
            </MetaCell>
          )}
          {approval.context?.conversation_id && (
            <MetaCell label="Conversation">
              <CodeChip>{String(approval.context.conversation_id)}</CodeChip>
            </MetaCell>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={toggle}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]"
          >
            {isExpanded ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                Hide details
              </>
            ) : (
              <>
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                Show details
              </>
            )}
          </button>

          {isPending && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={isActioning}
                onClick={() => onAction(approval.id, true)}
                leadingIcon={<X className="h-3.5 w-3.5" strokeWidth={2} />}
              >
                Deny
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={isActioning}
                onClick={() => onAction(approval.id, false)}
                leadingIcon={<Check className="h-3.5 w-3.5" strokeWidth={2.25} />}
              >
                Approve
              </Button>
            </div>
          )}
        </div>

        {isExpanded && approval.arguments && (
          <div className="mt-4">
            <JsonViewer
              data={approval.arguments}
              collapsed={false}
              label="Arguments"
            />
          </div>
        )}
      </div>
    </motion.li>
  );
}

function MetaCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
        {label}
      </p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
