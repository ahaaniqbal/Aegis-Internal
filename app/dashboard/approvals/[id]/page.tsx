'use client';

/**
 * Approval detail — `/dashboard/approvals/[id]`.
 *
 * Drill-in for a single REQUIRE_APPROVAL request. Shows everything a
 * reviewer needs to make the call:
 *
 *   • Agent + delegation chain (who is acting, in what role, for which
 *     scope, expiring when)
 *   • The action itself (tool, action_summary, full args via JsonViewer)
 *   • Risk profile (BlastRadiusChip + RiskScoreBar + AnomalyChip full
 *     when CIL flagged it)
 *   • Policy that fired (PolicyChip + link to the policy page)
 *   • Similar prior approvals from the same agent + tool (so the
 *     reviewer can check "have I seen this before?" in one glance)
 *   • Sticky right-rail Approve / Deny CTA
 *
 * The list-page row stays a queue view; this page is the considered
 * decision view. Same shape as Linear's issue detail or Stripe's payment
 * detail — the queue tells you what to look at, the detail page tells
 * you what to do.
 */

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  Clock,
  GitBranch,
  History,
  Loader2,
  ShieldAlert,
  ShieldX,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { AgentMark } from '@/components/ui/AgentMark';
import { AnomalyChip, RiskScoreBar } from '@/components/ui/AnomalyChip';
import { SemanticTypeChip } from '@/components/ui/SemanticTypeChip';
import { BlastRadiusChip } from '@/components/ui/BlastRadiusChip';
import { Button } from '@/components/ui/Button';
import { CodeChip } from '@/components/ui/CodeChip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ConnectorIcon, getConnectorForTool } from '@/components/ui/ConnectorMark';
import DecisionBadge from '@/components/ui/DecisionBadge';
import { DelegationChain } from '@/components/ui/DelegationChain';
import EmptyState from '@/components/ui/EmptyState';
import JsonViewer from '@/components/ui/JsonViewer';
import { PolicyChip } from '@/components/ui/PolicyChip';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import { useDashboardData } from '@/lib/dashboardDataContext';
import {
  blastRadiusRank,
  formatFullTimestamp,
  readBlastRadius,
} from '@/lib/utils';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';
import type { MCPApproval, SessionAction } from '@/lib/types';

export default function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Next 16 Server-/Client-component contract: params is a Promise. We
  // unwrap with React's `use()` so the rest of the component renders
  // synchronously against the resolved value.
  const { id } = use(params);
  const router = useRouter();
  const reduce = useReducedMotion();
  const toast = useToast();
  const { user } = useUser();
  const { sessionActions: runs } = useDashboardData();

  const [approval, setApproval] = useState<MCPApproval | null>(null);
  const [allApprovals, setAllApprovals] = useState<MCPApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);
  const [showDenyConfirm, setShowDenyConfirm] = useState(false);

  // Load approvals once. The detail page deliberately bypasses the
  // shared dashboard context because approvals churn quickly — once a
  // reviewer approves something, we want a fresh fetch on next mount.
  const reload = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await api.getMcpApprovals(user.id);
      setAllApprovals(data);
      setApproval(data.find((a) => a.id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // ── Decision handlers ─────────────────────────────────────────
  const handleAction = useCallback(
    async (reject: boolean) => {
      if (!approval) return;
      setActioning(true);
      try {
        await api.executeMcpApproval(approval.id, reject);
        if (reject) {
          toast.warning('Request denied', {
            description: 'The agent will receive the rejection.',
          });
        } else {
          toast.success('Request approved', {
            description: 'The agent can proceed with the action.',
          });
        }
        // Back to the queue after a moment — the queue will re-fetch
        // and this approval will no longer be pending.
        router.push('/dashboard/approvals');
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to update approval';
        toast.error('Approval failed', { description: msg });
      } finally {
        setActioning(false);
      }
    },
    [approval, router, toast],
  );

  // ── Derive a representative SessionAction for chip rendering ──
  // The MCPApproval shape doesn't carry blast_radius / risk_score /
  // anomaly directly — but the underlying run for the same tool +
  // session does. Match the most recent run from the same agent +
  // tool to extract those signals. Falls back gracefully when no
  // matching run is found (shows policy + args only).
  const matchingRun = useMemo<SessionAction | undefined>(() => {
    if (!approval) return undefined;
    const agent =
      typeof approval.context?.user === 'string'
        ? approval.context.user
        : undefined;
    return runs.find(
      (r) =>
        r.tool_name === approval.tool_name &&
        (!agent || r.agent_name === agent),
    );
  }, [approval, runs]);

  // ── Similar prior approvals (same agent + tool, excluding self) ─
  const similar = useMemo(() => {
    if (!approval) return [];
    const agent =
      typeof approval.context?.user === 'string'
        ? approval.context.user
        : null;
    return allApprovals
      .filter(
        (a) =>
          a.id !== approval.id &&
          a.tool_name === approval.tool_name &&
          (!agent ||
            (typeof a.context?.user === 'string' && a.context.user === agent)),
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 4);
  }, [allApprovals, approval]);

  if (loading) {
    return (
      <>
        <Topbar title="Approvals" subtitle="Loading…" />
        <div className="mx-auto flex max-w-[1320px] items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
          <Loader2
            className="h-5 w-5 animate-spin text-[var(--neutral-soft-400)]"
            strokeWidth={2}
          />
        </div>
      </>
    );
  }

  if (!approval) {
    return (
      <>
        <Topbar title="Approvals" subtitle="Not found" />
        <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <EmptyState
            icon={<ShieldX className="h-5 w-5" />}
            title="This approval is no longer pending"
            description="Either it was approved, denied, or expired. Head back to the queue to see what's still open."
            action={
              <Link href="/dashboard/approvals">
                <Button variant="primary">Back to Approvals</Button>
              </Link>
            }
          />
        </div>
      </>
    );
  }

  const agentName =
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
  const connector = getConnectorForTool(approval.tool_name);
  const status = (approval.status ?? '').toLowerCase();
  const isPending = status === 'pending' || status === '' || status === 'open';

  return (
    <>
      <Topbar title="Approvals" subtitle={`Request · ${id.slice(0, 8)}`} />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {/* Breadcrumb */}
        <motion.nav
          aria-label="Breadcrumb"
          className="mb-3 flex items-center gap-1 text-[11.5px] text-[var(--neutral-soft-400)]"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DUR.default, ease: EASE.out }}
        >
          <Link
            href="/dashboard/approvals"
            className="group inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 transition-colors duration-150 hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
          >
            <ArrowLeft
              className="h-3 w-3 transition-transform duration-150 group-hover:-translate-x-px"
              strokeWidth={2}
              aria-hidden
            />
            Approvals
          </Link>
          <span aria-hidden className="text-[var(--neutral-soft-400)]">
            /
          </span>
          <span className="font-mono text-[10.5px] font-medium text-[var(--neutral-sub-600)]">
            {id.slice(0, 12)}
          </span>
        </motion.nav>

        <motion.div
          variants={staggerContainer(0.05, 0.04)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
        >
          {/* ── Main column ───────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Hero card */}
            <motion.section
              variants={fadeUp}
              className="relative overflow-hidden rounded-[14px] border border-[var(--stroke-soft-200)] bg-white p-5 shadow-[0_1px_2px_rgba(23,23,23,0.04)] sm:p-6"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-1 rounded-[10px]"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(250, 115, 25, 0.07) 0%, rgba(250, 115, 25, 0.03) 28%, rgba(255, 255, 255, 0) 60%)',
                }}
              />
              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <AgentMark name={agentName} size="md" />
                  <div className="min-w-0">
                    <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                      Approval request · created{' '}
                      <RelativeTime
                        timestamp={approval.created_at}
                        className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]"
                      />
                    </p>
                    <h1 className="text-[22px] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--neutral-strong-950)] sm:text-[24px]">
                      {agentName} wants to call{' '}
                      <span className="font-mono text-[var(--primary-base)]">
                        {approval.tool_name}
                      </span>
                    </h1>
                    {approval.action_summary && (
                      <p className="mt-2 max-w-[640px] text-[13.5px] leading-[1.55] text-[var(--neutral-sub-600)]">
                        {approval.action_summary}
                      </p>
                    )}
                  </div>
                </div>
                <DecisionBadge decision="REQUIRE_APPROVAL" />
              </div>

              {/* Context chips */}
              <div className="relative mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--stroke-soft-200)] pt-4">
                {connector && (
                  <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--stroke-soft-200)] bg-white px-2 py-1 text-[11.5px] font-medium text-[var(--neutral-sub-600)]">
                    <ConnectorIcon id={connector} size={12} />
                    {connector}
                  </span>
                )}
                {repo && (
                  <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--stroke-soft-200)] bg-white px-2 py-1 text-[11.5px] font-medium text-[var(--neutral-sub-600)]">
                    <GitBranch className="h-3 w-3" strokeWidth={2} />
                    <span className="font-mono text-[11px]">{repo}</span>
                  </span>
                )}
                {branch && <CodeChip>{branch}</CodeChip>}
                <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--neutral-soft-400)]">
                  <Clock className="h-3 w-3" strokeWidth={2} />
                  {formatFullTimestamp(approval.created_at)}
                </span>
              </div>
            </motion.section>

            {/* Delegation chain — identity-of-record */}
            {matchingRun?.delegation && (
              <motion.section variants={fadeUp}>
                <DelegationChain
                  delegation={matchingRun.delegation}
                  variant="full"
                />
              </motion.section>
            )}

            {/* Layer 2 (CIL) reasoning trace — the canonical
                semantic_type chip + the full 4-context evidence panel.
                THIS is the moat made tangible. Every context signal
                the classifier evaluated, exposed inline so an auditor
                can read exactly why this action got this verdict.
                If anyone asks "why did Aegis decide this?", this is
                the answer. */}
            {matchingRun?.semantic_type && (
              <motion.section variants={fadeUp}>
                <SemanticTypeChip
                  semantic_type={matchingRun.semantic_type}
                  reason={matchingRun.blast_radius_reason}
                  variant="full"
                />
              </motion.section>
            )}

            {/* 4-Context Evidence Inspector — light card matching the
                rest of the approval detail page. The "audit evidence"
                feel comes from the mono key=value typography + 2x2
                grid (stacks on mobile). Color-coded values via
                semantic tokens. */}
            {matchingRun && (matchingRun.session_context_snapshot || matchingRun.repo_context_snapshot || matchingRun.branch_context_snapshot || matchingRun.env_context_snapshot) && (
              <motion.section
                variants={fadeUp}
                className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-3 sm:px-5">
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--primary-dark)]">
                      Context evidence
                    </p>
                    <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                      Four signals the classifier evaluated
                    </h2>
                  </div>
                  {matchingRun.classifier_confidence != null && (
                    <span className="inline-flex items-baseline gap-1.5 font-mono text-[10.5px] text-[var(--neutral-soft-400)]">
                      <span className="uppercase tracking-[0.08em]">confidence</span>
                      <span className="font-semibold tabular-nums text-[var(--neutral-strong-950)]">
                        {matchingRun.classifier_confidence.toFixed(2)}
                      </span>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 divide-y divide-[var(--stroke-soft-200)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  {/* SessionContext */}
                  {matchingRun.session_context_snapshot && (
                    <ContextBlock title="SessionContext">
                      <ContextRow label="agent" value={matchingRun.session_context_snapshot.agent_name ?? '—'} mono />
                      <ContextRow label="human_initiator" value={matchingRun.session_context_snapshot.human_initiator ?? '—'} mono />
                      <ContextRow label="push_count" value={String(matchingRun.session_context_snapshot.push_count ?? 0)} />
                      <ContextRow
                        label="denial_count"
                        value={String(matchingRun.session_context_snapshot.denial_count ?? 0)}
                        warn={(matchingRun.session_context_snapshot.denial_count ?? 0) >= 2}
                      />
                      <ContextRow
                        label="ci_failure_streak"
                        value={String(matchingRun.session_context_snapshot.ci_failure_streak ?? 0)}
                        warn={(matchingRun.session_context_snapshot.ci_failure_streak ?? 0) >= 3}
                      />
                      <ContextRow label="workflow_stage" value={matchingRun.session_context_snapshot.workflow_stage ?? '—'} />
                      <ContextRow label="linked_ticket" value={matchingRun.session_context_snapshot.linked_ticket ?? '—'} mono />
                    </ContextBlock>
                  )}

                  {/* RepoContext */}
                  {matchingRun.repo_context_snapshot && (
                    <ContextBlock title="RepoContext">
                      <ContextRow label="target_branch" value={matchingRun.repo_context_snapshot.target_branch ?? '—'} mono />
                      <ContextRow
                        label="is_protected_branch"
                        value={matchingRun.repo_context_snapshot.is_protected_branch ? 'true' : 'false'}
                        warn={matchingRun.repo_context_snapshot.is_protected_branch === true}
                      />
                      <ContextRow
                        label="ci_passing"
                        value={matchingRun.repo_context_snapshot.ci_passing ? 'true' : 'false'}
                        warn={matchingRun.repo_context_snapshot.ci_passing === false}
                        ok={matchingRun.repo_context_snapshot.ci_passing === true}
                      />
                      {matchingRun.repo_context_snapshot.ci_failure_reason && (
                        <ContextRow label="ci_failure_reason" value={matchingRun.repo_context_snapshot.ci_failure_reason} mono />
                      )}
                      <ContextRow
                        label="freeze_window_active"
                        value={matchingRun.repo_context_snapshot.freeze_window_active ? 'true' : 'false'}
                        warn={matchingRun.repo_context_snapshot.freeze_window_active === true}
                      />
                      {matchingRun.repo_context_snapshot.freeze_window_label && (
                        <ContextRow label="freeze_window_label" value={matchingRun.repo_context_snapshot.freeze_window_label} />
                      )}
                      <ContextRow label="sensitivity_level" value={matchingRun.repo_context_snapshot.sensitivity_level ?? 'standard'} warn={matchingRun.repo_context_snapshot.sensitivity_level === 'critical'} />
                    </ContextBlock>
                  )}

                  {/* BranchContext */}
                  {matchingRun.branch_context_snapshot && (
                    <ContextBlock title="BranchContext">
                      <ContextRow label="branch_name" value={matchingRun.branch_context_snapshot.branch_name ?? '—'} mono />
                      <ContextRow
                        label="is_aegis_managed"
                        value={matchingRun.branch_context_snapshot.is_aegis_managed ? 'true' : 'false'}
                        ok={matchingRun.branch_context_snapshot.is_aegis_managed === true}
                      />
                      <ContextRow label="session_owner_match" value={matchingRun.branch_context_snapshot.session_owner_match ? 'true' : 'false'} />
                      <ContextRow label="has_open_pr" value={matchingRun.branch_context_snapshot.has_open_pr ? 'true' : 'false'} />
                      {matchingRun.branch_context_snapshot.pr_number && (
                        <ContextRow label="pr_number" value={`#${matchingRun.branch_context_snapshot.pr_number}`} mono />
                      )}
                      <ContextRow
                        label="branch_age"
                        value={formatBranchAge(matchingRun.branch_context_snapshot.branch_age_seconds)}
                      />
                      <ContextRow label="commits_this_session" value={String(matchingRun.branch_context_snapshot.commit_count_this_session ?? 0)} />
                    </ContextBlock>
                  )}

                  {/* EnvContext */}
                  {matchingRun.env_context_snapshot && (
                    <ContextBlock title="EnvContext">
                      <ContextRow
                        label="environment_tier"
                        value={matchingRun.env_context_snapshot.environment_tier ?? 'dev'}
                        warn={matchingRun.env_context_snapshot.environment_tier === 'production'}
                      />
                      <ContextRow
                        label="active_incident"
                        value={matchingRun.env_context_snapshot.active_incident ? 'true' : 'false'}
                        warn={matchingRun.env_context_snapshot.active_incident === true}
                      />
                      {matchingRun.env_context_snapshot.incident_severity && (
                        <ContextRow label="incident_severity" value={matchingRun.env_context_snapshot.incident_severity} warn />
                      )}
                      <ContextRow label="within_business_hours" value={matchingRun.env_context_snapshot.within_business_hours ? 'true' : 'false'} />
                      <ContextRow label="timezone" value={matchingRun.env_context_snapshot.timezone ?? 'UTC'} mono />
                      <ContextRow
                        label="deploy_locked"
                        value={matchingRun.env_context_snapshot.deploy_locked ? 'true' : 'false'}
                        warn={matchingRun.env_context_snapshot.deploy_locked === true}
                      />
                    </ContextBlock>
                  )}
                </div>
                {matchingRun.canonical_action_type && (
                  <div className="border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-3 sm:px-5">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-[10.5px]">
                      <span className="font-bold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">canonical_action_type</span>
                      <span className="text-[var(--stroke-sub-300)]">=</span>
                      <span className="break-all font-semibold text-[var(--neutral-strong-950)]">{matchingRun.canonical_action_type}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-[1.5] text-[var(--neutral-sub-600)]">
                      Normalized action type that policies evaluate against. The same rule applies to this canonical type from any MCP server that emits it.
                    </p>
                  </div>
                )}
              </motion.section>
            )}

            {/* Behavioral amplifier callout — secondary signal when
                CIL's statistical baseline ALSO flagged this action.
                Shown below the canonical Layer 2 panel as a "and the
                stats engine agrees" overlay. */}
            {matchingRun?.anomaly && (
              <motion.section variants={fadeUp}>
                <AnomalyChip
                  anomaly
                  reason={matchingRun.anomaly_reason}
                  variant="full"
                />
              </motion.section>
            )}

            {/* Policy + risk profile (paired sidebar-style block) */}
            <motion.section
              variants={fadeUp}
              className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            >
              <div className="border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-5 py-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                  Why this needs approval
                </p>
                <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Policy verdict + risk signals
                </h2>
              </div>
              <div className="grid grid-cols-1 divide-y divide-[var(--stroke-soft-200)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <DetailCell label="Policy verdict">
                  <PolicyChip policy={matchingRun?.policy ?? null} />
                </DetailCell>
                <DetailCell label="Blast radius">
                  <BlastRadiusChip value={readBlastRadius(matchingRun ?? {})} />
                  <p className="mt-1.5 text-[10.5px] text-[var(--neutral-soft-400)]">
                    Rank {blastRadiusRank(readBlastRadius(matchingRun ?? {}))} of 5
                  </p>
                </DetailCell>
                <DetailCell label="CIL risk score">
                  {typeof matchingRun?.risk_score === 'number' ? (
                    <RiskScoreBar score={matchingRun.risk_score} />
                  ) : (
                    <span className="text-[12px] italic text-[var(--neutral-soft-400)]">
                      Not yet scored
                    </span>
                  )}
                </DetailCell>
              </div>
            </motion.section>

            {/* Arguments */}
            <motion.section variants={fadeUp}>
              <JsonViewer
                data={approval.arguments}
                collapsed={false}
                label="Tool arguments"
              />
            </motion.section>

            {/* Similar prior approvals */}
            <motion.section
              variants={fadeUp}
              className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            >
              <div className="flex items-center gap-2 border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-5 py-3">
                <History
                  className="h-3.5 w-3.5 text-[var(--primary-base)]"
                  strokeWidth={2}
                />
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                  Similar prior requests
                </p>
                {similar.length > 0 && (
                  <span className="ml-auto text-[11px] tabular-nums text-[var(--neutral-sub-600)]">
                    {similar.length} found
                  </span>
                )}
              </div>
              {similar.length > 0 ? (
                <ul className="divide-y divide-[var(--stroke-soft-200)]">
                  {similar.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center gap-3 px-5 py-3"
                    >
                      <DecisionBadge decision={s.status ?? 'PENDING'} />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--neutral-strong-950)]">
                        {s.action_summary || s.tool_name}
                      </span>
                      <RelativeTime
                        timestamp={s.created_at}
                        className="text-[11px] tabular-nums text-[var(--neutral-soft-400)]"
                      />
                      <Link
                        href={`/dashboard/approvals/${s.id}`}
                        className="text-[11.5px] font-medium text-[var(--neutral-sub-600)] underline-offset-4 hover:text-[var(--primary-base)] hover:underline"
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-5 py-6 text-center">
                  <p className="text-[12.5px] text-[var(--neutral-sub-600)]">
                    First time this agent has requested{' '}
                    <span className="font-mono text-[12px] text-[var(--neutral-strong-950)]">
                      {approval.tool_name}
                    </span>
                    .
                  </p>
                </div>
              )}
            </motion.section>
          </div>

          {/* ── Decision sidebar ────────────────────────────────── */}
          <motion.aside
            variants={fadeUp}
            className="lg:sticky lg:top-[80px] lg:self-start"
          >
            <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
              <div className="border-b border-[var(--stroke-soft-200)] px-5 py-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                  Decision
                </p>
                <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Approve or deny
                </h2>
                <p className="mt-1 text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">
                  The agent is paused until you act. Approve to let it
                  proceed; deny to block with an audit-logged reason.
                </p>
              </div>
              <div className="space-y-2 p-4">
                {isPending ? (
                  <>
                    <Button
                      variant="primary"
                      fullWidth
                      disabled={actioning}
                      leadingIcon={<Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                      onClick={() => handleAction(false)}
                    >
                      Approve request
                    </Button>
                    <Button
                      variant="secondary"
                      fullWidth
                      disabled={actioning}
                      leadingIcon={<ShieldX className="h-3.5 w-3.5" strokeWidth={2.25} />}
                      onClick={() => setShowDenyConfirm(true)}
                    >
                      Deny request
                    </Button>
                    <p className="pt-2 text-center text-[10.5px] text-[var(--neutral-soft-400)]">
                      Both decisions are written to the audit trail
                    </p>
                  </>
                ) : (
                  <div className="rounded-[8px] bg-[var(--neutral-weak-50)] p-4 text-center">
                    <ShieldAlert
                      className="mx-auto mb-2 h-5 w-5 text-[var(--neutral-soft-400)]"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <p className="text-[12.5px] font-medium text-[var(--neutral-strong-950)]">
                      Already decided
                    </p>
                    <p className="mt-1 text-[11.5px] text-[var(--neutral-soft-400)]">
                      Status: {status || 'closed'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        </motion.div>
      </div>

      <ConfirmDialog
        open={showDenyConfirm}
        onOpenChange={setShowDenyConfirm}
        variant="danger"
        title="Deny this request?"
        description={
          <>
            The agent will be blocked from running{' '}
            <span className="font-mono text-[12.5px] text-[var(--neutral-strong-950)]">
              {approval.tool_name}
            </span>
            {repo ? (
              <>
                {' '}
                on{' '}
                <span className="font-mono text-[12.5px] text-[var(--neutral-strong-950)]">
                  {repo}
                </span>
              </>
            ) : null}
            . The denial appears in the audit log and can&apos;t be undone.
          </>
        }
        confirmLabel="Deny request"
        loading={actioning}
        onConfirm={async () => {
          setShowDenyConfirm(false);
          await handleAction(true);
        }}
      />
    </>
  );
}

// ─── Single cell in the policy + risk profile row ────────────────────
function DetailCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white p-4">
      <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

// ─── 4-Context Evidence Inspector building blocks ────────────────────
/**
 * One context struct block. Light surface, mono uppercase title in
 * muted gray, key=value rows below. Tight vertical rhythm.
 */
function ContextBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--white-0)] px-4 py-4 sm:px-5">
      <p className="mb-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
        {title}
      </p>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

/**
 * One key:value row inside a ContextBlock. Renders as a key=value
 * assignment, monospace throughout. `warn` uses --error for signals
 * that triggered the verdict; `ok` uses --success for safe signals;
 * everything else uses --neutral-strong-950.
 */
function ContextRow({
  label,
  value,
  warn,
  ok,
}: {
  label: string;
  value: string;
  mono?: boolean;
  warn?: boolean;
  ok?: boolean;
}) {
  const valueColor = warn
    ? 'var(--error)'
    : ok
      ? 'var(--success)'
      : 'var(--neutral-strong-950)';
  return (
    <div className="flex items-baseline justify-between gap-3 font-mono text-[10.5px] leading-[1.5]">
      <dt className="shrink-0 text-[var(--neutral-soft-400)]">{label}</dt>
      <dd
        className="min-w-0 break-all text-right font-semibold"
        style={{ color: valueColor }}
      >
        {value}
      </dd>
    </div>
  );
}

/** Format branch_age_seconds into a human-readable string. */
function formatBranchAge(seconds?: number): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}
