'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { DUR, EASE, fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gauge,
  GitMerge as GitMergeIcon,
  History,
  Inbox,
  Shield,
  Sparkles,
  Pencil,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { SemanticTypeChip, SEMANTIC_TYPE_CONFIG } from '@/components/ui/SemanticTypeChip';
import type { SemanticType } from '@/lib/types';
import { api } from '@/lib/api';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import { MCPApproval, Metrics, SessionAction } from '@/lib/types';
import {
  formatExecutionTimeMs,
  formatRelativeTime,
  truncate,
} from '@/lib/utils';
import Topbar from '@/components/layout/Topbar';
import { AgentMark } from '@/components/ui/AgentMark';
import DecisionBadge, { decisionColor } from '@/components/ui/DecisionBadge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { DashboardHomeSkeleton } from '@/components/ui/PageSkeletons';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { Button } from '@/components/ui/Button';
import { CodeChip } from '@/components/ui/CodeChip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { Tooltip } from '@/components/ui/Tooltip';
import { ConnectorIcon, getConnectorForTool } from '@/components/ui/ConnectorMark';
import { IconMark } from '@/components/ui/IconMark';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function normalizeApprovalStatus(status: string): 'pending' | 'approved' | 'rejected' {
  const v = (status ?? '').toLowerCase();
  if (v === 'approved' || v === 'rejected') return v;
  return 'pending';
}

export default function DashboardHomePage() {
  const { user, isLoading: userLoading } = useUser();
  const toast = useToast();
  const reduce = useReducedMotion();
  const [runs, setRuns] = useState<SessionAction[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    total: 0,
    allows: 0,
    denies: 0,
    rewrites: 0,
    approvals: 0,
  });
  const [approvals, setApprovals] = useState<MCPApproval[]>([]);
  const [policyString, setPolicyString] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningIds, setActioningIds] = useState<Set<string>>(new Set());
  // Pending Deny confirmation — null when no dialog is open. Same
  // pattern as /dashboard/approvals: gate the destructive path,
  // let Approve fire-and-forget.
  const [pendingDeny, setPendingDeny] = useState<MCPApproval | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [runsData, metricsData, approvalsData, policyData] = await Promise.all([
        api.getRuns(user.id).catch(() => []),
        api.getMetrics(user.id).catch(() => ({
          total: 0, allows: 0, denies: 0, rewrites: 0, approvals: 0,
        })),
        api.getMcpApprovals(user.id).catch(() => []),
        api.getUserPolicy(user.id).catch(() => null),
      ]);
      setRuns(runsData);
      setMetrics(metricsData);
      setApprovals(approvalsData);
      setPolicyString(policyData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to backend');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) fetchData();
    else if (!userLoading) setLoading(false);
  }, [user?.id, userLoading, fetchData]);

  const { lastUpdated } = useAutoRefresh(fetchData, 30000);

  // ── Derived metrics ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - ONE_WEEK_MS;
    const hourAgo = now - ONE_HOUR_MS;

    const runsThisWeek = runs.filter(
      (r) => new Date(r.timestamp).getTime() >= weekAgo,
    );

    const activeSessionIds = new Set(
      runs
        .filter((r) => new Date(r.timestamp).getTime() >= hourAgo)
        .map((r) => r.session_id)
        .filter(Boolean),
    );

    const blockedThisWeek = runsThisWeek.filter(
      (r) => r.decision?.toUpperCase() === 'DENY',
    ).length;
    const rewritesThisWeek = runsThisWeek.filter(
      (r) => r.decision?.toUpperCase() === 'REWRITE',
    ).length;

    const pendingApprovals = approvals.filter(
      (a) => normalizeApprovalStatus(a.status) === 'pending',
    ).length;

    const policiesActive = policyString
      ? (policyString.match(/1/g)?.length ?? 0)
      : 10;

    // ── CIL + outcomes signals ─────────────────────────────────────
    // CIL classifications this week — the moat metric. Counts every
    // action where the Layer 2 semantic classifier returned a non-ALLOW
    // semantic_type (REWRITE / DENY / REQUIRE_APPROVAL). Demos as
    // "what static rules without context would have missed."
    const cilEventsThisWeek = runsThisWeek.filter(
      (r) =>
        r.semantic_type &&
        r.semantic_type !== 'working_commit' &&
        r.semantic_type !== 'test_only_change' &&
        r.semantic_type !== 'ephemeral_force_push',
    ).length;
    // Keep the legacy behavioral-anomaly count too — it's a secondary
    // amplifier signal (Series-A roadmap), not the canonical moat.
    const behavioralAnomaliesThisWeek = runsThisWeek.filter((r) => r.anomaly).length;
    // Risky actions prevented = DENY + REQUIRE_APPROVAL routed for
    // review. The aggregate "what Aegis blocked from doing damage."
    const approvalsThisWeek = runsThisWeek.filter(
      (r) => r.decision?.toUpperCase() === 'REQUIRE_APPROVAL',
    ).length;
    const preventedThisWeek = blockedThisWeek + approvalsThisWeek;
    // Tools governed = unique connector slugs touched this week.
    // Shows the control-plane breadth without needing to leave the
    // dashboard for the Connectors page. Uses the canonical
    // `getConnectorForTool` lookup so adding new connectors (Datadog,
    // Sentry, K8s, Cloudflare, Notion etc.) automatically counts
    // toward this number without code change. Falls back to 'unknown'
    // for tools the catalog hasn't classified yet — those still
    // contribute to the breadth count since they're real distinct
    // surfaces; the bucket label just isn't pretty.
    const toolsGovernedThisWeek = new Set(
      runsThisWeek
        .map((r) => r.tool_name)
        .filter(Boolean)
        .map((t) => getConnectorForTool(t) ?? `unknown:${t}`),
    ).size;

    return {
      activeSessions: activeSessionIds.size,
      runsThisWeek: runsThisWeek.length,
      pendingApprovals,
      policiesActive,
      blockedThisWeek,
      rewritesThisWeek,
      // CIL + outcomes
      cilEventsThisWeek,
      behavioralAnomaliesThisWeek,
      preventedThisWeek,
      toolsGovernedThisWeek,
    };
  }, [runs, approvals, policyString]);

  const pendingItems = useMemo(
    () =>
      approvals
        .filter((a) => normalizeApprovalStatus(a.status) === 'pending')
        .slice(0, 5),
    [approvals],
  );

  const recentRuns = useMemo(() => runs.slice(0, 8), [runs]);

  /**
   * CIL events callout — top N most-recent runs where the Layer 2
   * semantic classifier returned a non-ALLOW semantic_type. These
   * are the canonical moat moments: every row is a verdict the
   * classifier made because the agent's action plus its real-time
   * context fired a specific rule.
   *
   * The dashboard hero proves "we govern AI agents"; this list proves
   * "and here's exactly what we caught and why."
   */
  const cilEvents = useMemo(
    () =>
      runs
        .filter(
          (r) =>
            r.semantic_type &&
            r.semantic_type !== 'working_commit' &&
            r.semantic_type !== 'test_only_change' &&
            r.semantic_type !== 'ephemeral_force_push',
        )
        .slice(0, 5),
    [runs],
  );

  /**
   * Semantic_type distribution for this week's non-ALLOW classifications.
   * Powers the inline stacked-bar chart in the CIL callout — makes the
   * moat visible on the first dashboard view without navigating to
   * CIL Insights.
   */
  const cilDistribution = useMemo(() => {
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - ONE_WEEK;
    const counts = new Map<SemanticType, number>();
    for (const r of runs) {
      if (!r.semantic_type) continue;
      if (r.semantic_type === 'working_commit') continue;
      if (r.semantic_type === 'test_only_change') continue;
      if (r.semantic_type === 'ephemeral_force_push') continue;
      if (new Date(r.timestamp).getTime() < cutoff) continue;
      counts.set(r.semantic_type as SemanticType, (counts.get(r.semantic_type as SemanticType) ?? 0) + 1);
    }
    const total = Array.from(counts.values()).reduce((s, n) => s + n, 0);
    if (total === 0) return { total: 0, rows: [] as { type: SemanticType; count: number; pct: number }[] };
    return {
      total,
      rows: Array.from(counts.entries())
        .map(([type, count]) => ({ type, count, pct: (count / total) * 100 }))
        .sort((a, b) => b.count - a.count),
    };
  }, [runs]);

  /**
   * REWRITE highlights — the canonical example for the dashboard hero
   * card. We want at least one recent REWRITE action visible so the
   * single most differentiating decision type is on screen at first
   * paint. Falls back to the most recent protected-branch action even
   * if it wasn't decisioned as REWRITE.
   */
  const recentRewrite = useMemo(() => {
    return (
      runs.find(
        (r) => r.decision === 'REWRITE' && r.semantic_type === 'protected_branch_write',
      ) ?? runs.find((r) => r.decision === 'REWRITE') ?? null
    );
  }, [runs]);

  const username = user?.username || 'there';

  // Decision distribution percentages
  const distribution = useMemo(() => {
    const total =
      metrics.allows + metrics.denies + metrics.rewrites + metrics.approvals;
    const safe = total === 0 ? 1 : total;
    return [
      // `color` stays saturated for the distribution bar (needs to read
      // clearly at a glance). `dot` is the pastel variant for the legend
      // swatches — softer, more refined at small sizes.
      { key: 'allow',    label: 'Allow',    value: metrics.allows,    pct: (metrics.allows / safe) * 100,    color: 'var(--success)',     dot: '#bfe7d2' },
      { key: 'rewrite',  label: 'Rewrite',  value: metrics.rewrites,  pct: (metrics.rewrites / safe) * 100,  color: 'var(--feature)',     dot: '#d6c9f6' },
      { key: 'approval', label: 'Approval', value: metrics.approvals, pct: (metrics.approvals / safe) * 100, color: 'var(--warning)',     dot: '#f9dba0' },
      { key: 'deny',     label: 'Deny',     value: metrics.denies,    pct: (metrics.denies / safe) * 100,    color: 'var(--error)',       dot: '#f5b9be' },
    ];
  }, [metrics]);

  // ── Action handlers ────────────────────────────────────────────────────────
  const handleApproval = async (id: string, reject: boolean) => {
    setActioningIds((prev) => new Set(prev).add(id));
    try {
      await api.executeMcpApproval(id, reject);
      await fetchData();
      // Match the /approvals page toast pattern exactly so a reviewer
      // gets identical feedback regardless of which surface they
      // acted on. Approve = success, deny = warning (denial blocks).
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
        err instanceof Error ? err.message : 'Failed to update approval';
      setError(msg);
      toast.error('Approval failed', { description: msg });
    } finally {
      setActioningIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  if (userLoading || loading) {
    return (
      <>
        <Topbar title="Dashboard" subtitle="Overview" showDateRange />
        {/* Same content container as the loaded state (mx-auto +
            max-w-[1320px] 2xl:max-w-[1480px] + horizontal/vertical padding) so the
            skeleton's gray blocks respect the page gutters instead
            of going edge-to-edge — matches every other dashboard
            page's loading layout. */}
        <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <DashboardHomeSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Dashboard"
        subtitle="Overview"
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
        unreadCount={stats.pendingApprovals}
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

        {/* ─── Greeting block ────────────────────────────────────────── */}
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
            Overview · Last 7 days
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
          >
            {greeting(new Date())}, {username}
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-3 max-w-[640px] text-[13.5px] leading-[1.55] text-[var(--neutral-sub-600)]"
          >
            You have{' '}
            <ColoredCount value={stats.pendingApprovals} color="var(--primary-base)" />{' '}
            {stats.pendingApprovals === 1 ? 'approval' : 'approvals'} waiting,{' '}
            <ColoredCount value={stats.blockedThisWeek} color="var(--error)" />{' '}
            blocked {stats.blockedThisWeek === 1 ? 'run' : 'runs'} this week, and{' '}
            <ColoredCount value={stats.activeSessions} color="var(--success)" />{' '}
            active {stats.activeSessions === 1 ? 'session' : 'sessions'} right now.
          </motion.p>
        </motion.header>

        {/* ─── Outcomes Hero ────────────────────────────────────────────
            4-tile row that quantifies the value Aegis delivered this
            week. This is the slide every investor and every VP Eng
            wants to see: dollars saved, risky actions prevented, CIL
            anomalies surfaced, control-plane breadth. Position above
            the Decision Overview because outcomes > activity. */}
        <motion.section
          className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.14 }}
          aria-label="Aegis impact this week"
        >
          {/* Each tile is its own deep-link destination so the hero row
              works as a real navigation surface, not just decoration.
              An investigator who sees "12 anomalies this week" can
              click directly into the filtered Runs view rather than
              scrolling down to the CIL callout to find the link. */}
          <OutcomeTile
            label="Risky actions prevented"
            value={stats.preventedThisWeek}
            color="var(--error)"
            icon={Shield}
            href="/dashboard/approvals"
            footnote={
              stats.preventedThisWeek > 0
                ? `${stats.blockedThisWeek} blocked · ${stats.preventedThisWeek - stats.blockedThisWeek} held for review`
                : 'No risky actions this week'
            }
          />
          <OutcomeTile
            label="CIL classifications"
            value={stats.cilEventsThisWeek}
            color="var(--warning)"
            icon={Sparkles}
            href="/dashboard/insights"
            footnote={
              stats.cilEventsThisWeek > 0
                ? `${stats.rewritesThisWeek} REWRITE · ${stats.blockedThisWeek} DENY · ${stats.cilEventsThisWeek - stats.rewritesThisWeek - stats.blockedThisWeek} APPROVAL`
                : 'No classified events this week'
            }
          />
          <OutcomeTile
            label="Tools governed"
            value={stats.toolsGovernedThisWeek}
            color="var(--primary-base)"
            icon={Inbox}
            href="/dashboard/connectors"
            footnote={
              stats.toolsGovernedThisWeek > 1
                ? 'Across the full agent surface'
                : 'GitHub today; multi-tool shipping'
            }
          />
          <OutcomeTile
            label="Decisions evaluated"
            value={stats.runsThisWeek}
            color="var(--success)"
            icon={CheckCircle2}
            href="/dashboard/runs"
            footnote={`${stats.activeSessions} active sessions right now`}
          />
        </motion.section>

        {/* ─── REWRITE in action — the differentiator ─────────────────
            Light card matching the rest of the dashboard chrome. The
            "audit-inspector" feel comes from the typography (mono
            key=value trace), not from inverting the surface. Brand
            orange used only for the classification step (the moat
            moment); error red on the unsafe target; success green on
            the resulting PR. Mobile: grid-cols-[24px_1fr] gutter stays
            tight; mono strings break-all to prevent overflow. */}
        {recentRewrite && (
          <motion.section
            className="relative mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.18 }}
          >
            {/* Inset orange wash — same family as the CIL callout below,
                anchors this card as part of the "moat" hero row. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-1 rounded-[8px]"
              style={{
                background:
                  'linear-gradient(180deg, rgba(250, 115, 25, 0.07) 0%, rgba(250, 115, 25, 0.03) 28%, rgba(255, 255, 255, 0) 60%)',
              }}
            />
            <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2.5">
                <IconMark icon={GitMergeIcon} color="var(--primary-base)" strokeWidth={2.25} />
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--primary-dark)]">
                    REWRITE in action
                  </p>
                  <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                    {stats.rewritesThisWeek > 0
                      ? `${stats.rewritesThisWeek.toLocaleString()} unsafe ${stats.rewritesThisWeek === 1 ? 'action' : 'actions'} transformed into safe PR ${stats.rewritesThisWeek === 1 ? 'workflow' : 'workflows'} this week`
                      : 'No REWRITE moments yet this week'}
                  </h2>
                </div>
              </div>
              <Link
                href={recentRewrite.rewrite_pr_url ?? `/dashboard/runs?session=${recentRewrite.session_id}`}
                target={recentRewrite.rewrite_pr_url ? '_blank' : undefined}
                rel={recentRewrite.rewrite_pr_url ? 'noopener noreferrer' : undefined}
                className="group inline-flex items-center gap-1 text-[12px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--primary-base)]"
              >
                {recentRewrite.rewrite_pr_url ? 'Open PR' : 'View run'}
                <ArrowUpRight
                  className="h-3 w-3 transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
                  strokeWidth={2}
                />
              </Link>
            </div>

            {/* Request trace — three sequential log lines on the light
                surface. Each row: ordinal gutter + mono key/value
                payload + plain-English description below. */}
            <ol className="relative divide-y divide-[var(--stroke-soft-200)]">
              {/* 01 — Agent intent */}
              <li className="grid grid-cols-[22px_1fr] gap-x-3 px-4 py-3.5 sm:grid-cols-[28px_1fr] sm:px-5">
                <span
                  aria-hidden
                  className="mt-px font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]"
                >
                  01
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--error)]">
                    agent_intent
                  </p>
                  <p className="mt-1.5 break-all font-mono text-[12px] leading-[1.55] text-[var(--neutral-strong-950)]">
                    <span className="text-[var(--neutral-soft-400)]">{recentRewrite.agent_name}</span>
                    <span className="text-[var(--stroke-sub-300)]"> · </span>
                    <span className="font-semibold">{recentRewrite.tool_name}</span>
                    <span className="text-[var(--stroke-sub-300)]"> → </span>
                    <span className="font-semibold text-[var(--error)]">{recentRewrite.target_branch ?? 'main'}</span>
                  </p>
                  <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                    Direct push to a protected branch. Without context-aware governance, this would land on main.
                  </p>
                </div>
              </li>

              {/* 02 — Classification + REWRITE (the moat) */}
              <li className="grid grid-cols-[22px_1fr] gap-x-3 px-4 py-3.5 sm:grid-cols-[28px_1fr] sm:px-5">
                <span
                  aria-hidden
                  className="mt-px font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--primary-base)]"
                >
                  02
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--primary-dark)]">
                    aegis_classify · rewrite
                  </p>
                  <p className="mt-1.5 break-all font-mono text-[12px] leading-[1.55] text-[var(--neutral-strong-950)]">
                    <span className="text-[var(--neutral-soft-400)]">semantic_type</span>
                    <span className="text-[var(--stroke-sub-300)]"> = </span>
                    <span className="font-semibold text-[var(--primary-dark)]">protected_branch_write</span>
                    <span className="text-[var(--stroke-sub-300)]"> → </span>
                    <span className="font-semibold">
                      {recentRewrite.rewrite_target_branch ?? 'feature/aegis-rewrite'}
                    </span>
                  </p>
                  <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                    The Contextual Intelligence Layer identified the protected-branch write. Aegis spawned a safe feature branch from the working tree and opened a PR to{' '}
                    <span className="font-mono text-[11px] text-[var(--neutral-strong-950)]">{recentRewrite.target_branch ?? 'main'}</span>{' '}
                    automatically.
                  </p>
                </div>
              </li>

              {/* 03 — Safe outcome */}
              <li className="grid grid-cols-[22px_1fr] gap-x-3 px-4 py-3.5 sm:grid-cols-[28px_1fr] sm:px-5">
                <span
                  aria-hidden
                  className="mt-px font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]"
                >
                  03
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--success)]">
                    safe_outcome
                  </p>
                  <p className="mt-1.5 break-all font-mono text-[12px] leading-[1.55] text-[var(--neutral-strong-950)]">
                    <span className="text-[var(--neutral-soft-400)]">pull_request</span>
                    <span className="text-[var(--stroke-sub-300)]"> = </span>
                    <span className="font-semibold text-[var(--success)]">
                      #{recentRewrite.rewrite_pr_number ?? '—'} opened
                    </span>
                    <span className="text-[var(--stroke-sub-300)]"> · </span>
                    <span className="text-[var(--neutral-sub-600)]">agent_continued = true</span>
                  </p>
                  <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                    Agent received the PR URL and kept working. No human required. The action happened, just safely.
                  </p>
                </div>
              </li>
            </ol>

            {/* Footer — decision path summary as a single mono line. */}
            <div className="border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-2.5 sm:px-5">
              <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 font-mono text-[10.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                <span className="font-bold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">decision_path</span>
                <span className="text-[var(--stroke-sub-300)]">|</span>
                <span>tool_call</span>
                <span className="text-[var(--stroke-sub-300)]">→</span>
                <span>classify(session,repo,branch,env)</span>
                <span className="text-[var(--stroke-sub-300)]">→</span>
                <span className="font-semibold text-[var(--primary-dark)]">protected_branch_write</span>
                <span className="text-[var(--stroke-sub-300)]">→</span>
                <span className="font-semibold text-[var(--primary-base)]">REWRITE</span>
              </p>
            </div>
          </motion.section>
        )}

        {/* ─── CIL events callout ──────────────────────────────────────
            The moat made concrete. Lists the most recent non-ALLOW
            semantic_types the Layer 2 classifier produced — each with
            the connector mark, the canonical semantic_type chip, and
            the blast_radius_reason the classifier emitted. Each row
            links into Runs so a reviewer can drill into the full
            reasoning trace.

            Empty state reads as a positive: "Classifier quiet" means
            every action this week was a routine ALLOW. */}
        <motion.section
          className="relative mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.2 }}
        >
          {/* Inset orange→white wash — same treatment as the Decision
              Overview hero so the CIL callout reads as part of the
              same hero family. 4px inset on all sides, fades to
              fully transparent before mid-card. The warning tone is
              now carried by the icon hue (when anomalies present),
              not by tinting the whole surface. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-1 rounded-[8px]"
            style={{
              background:
                'linear-gradient(180deg, rgba(250, 115, 25, 0.07) 0%, rgba(250, 115, 25, 0.03) 28%, rgba(255, 255, 255, 0) 60%)',
            }}
          />
          <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-5 py-3">
            <div className="flex items-center gap-2.5">
              {/* Canonical IconMark — concentric sticker with the
                  Sparkles icon hued to warning when anomalies are
                  present, neutral when baselines are healthy. */}
              <IconMark
                icon={Sparkles}
                color={
                  cilEvents.length > 0
                    ? 'var(--warning)'
                    : 'var(--neutral-soft-400)'
                }
              />
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                  Contextual Intelligence Layer
                </p>
                <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  {cilEvents.length > 0
                    ? `${stats.cilEventsThisWeek} context-driven ${stats.cilEventsThisWeek === 1 ? 'classification' : 'classifications'} this week`
                    : 'Classifier quiet · all actions routine ALLOW'}
                </h2>
              </div>
            </div>
            {/* Deep-link header CTA — route to the CIL Insights page
                for the full distribution + canonical example. */}
            <Link
              href="/dashboard/insights"
              className="group inline-flex items-center gap-1 text-[12px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--primary-base)]"
            >
              {cilEvents.length > 0 ? 'View full distribution' : 'View CIL insights'}
              <ArrowUpRight
                className="h-3 w-3 transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
                strokeWidth={2}
              />
            </Link>
          </div>

          {cilEvents.length > 0 ? (
            <>
              {/* Inline semantic_type distribution — stacked horizontal
                  bar showing the breakdown of this week's non-ALLOW
                  classifications. Makes the Layer 2 intelligence
                  visible without navigating away. */}
              {cilDistribution.total > 0 && (
                <div className="relative border-b border-[var(--stroke-soft-200)] px-5 py-3.5">
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                      Distribution this week
                    </p>
                    <p className="text-[10.5px] font-mono text-[var(--neutral-soft-400)]">
                      {cilDistribution.total} {cilDistribution.total === 1 ? 'classification' : 'classifications'}
                    </p>
                  </div>
                  {/* Stacked bar */}
                  <div
                    className="flex h-2.5 w-full overflow-hidden rounded-full ring-1 ring-[var(--stroke-soft-200)]"
                    role="img"
                    aria-label="semantic_type distribution stacked bar"
                  >
                    {cilDistribution.rows.map((row) => {
                      const cfg = SEMANTIC_TYPE_CONFIG[row.type];
                      const color =
                        cfg?.tone === 'primary' ? 'var(--primary-base)'
                        : cfg?.tone === 'error'  ? 'var(--error)'
                        : cfg?.tone === 'warning'? 'var(--warning)'
                        : cfg?.tone === 'success'? 'var(--success)'
                        : 'var(--neutral-sub-600)';
                      return (
                        <span
                          key={row.type}
                          style={{ width: `${row.pct}%`, backgroundColor: color }}
                          title={`${row.type}: ${row.count} (${row.pct.toFixed(0)}%)`}
                        />
                      );
                    })}
                  </div>
                  {/* Legend */}
                  <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
                    {cilDistribution.rows.slice(0, 6).map((row) => {
                      const cfg = SEMANTIC_TYPE_CONFIG[row.type];
                      const color =
                        cfg?.tone === 'primary' ? 'var(--primary-base)'
                        : cfg?.tone === 'error'  ? 'var(--error)'
                        : cfg?.tone === 'warning'? 'var(--warning)'
                        : cfg?.tone === 'success'? 'var(--success)'
                        : 'var(--neutral-sub-600)';
                      return (
                        <li key={row.type} className="inline-flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-mono text-[10.5px] text-[var(--neutral-strong-950)]">
                            {row.type}
                          </span>
                          <span className="font-mono text-[10.5px] tabular-nums text-[var(--neutral-soft-400)]">
                            {row.count}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <ul className="relative divide-y divide-[var(--stroke-soft-200)]">
                {cilEvents.map((run) => (
                  <AnomalyListItem key={run.id} run={run} />
                ))}
              </ul>
            </>
          ) : (
            <div className="relative px-5 py-6">
              <p className="text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                The Contextual Intelligence Layer saw every agent action this week
                land as a routine ALLOW (working_commit, test_only_change, or
                ephemeral_force_push). No protected-branch writes, no freeze-window
                violations, no credential exposure, no sensitive-path changes. The
                classifier is still watching every call.
              </p>
            </div>
          )}
        </motion.section>

        {/* ─── Hero — Decision distribution ─────────────────────────── */}
        <motion.section
          className="relative mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.18 }}
        >
          {/* Subtle inset orange-tinted gradient — 4px inset on all four
              sides so it reads as a soft "inner panel" wash rather than
              a hard fill. Fades to fully transparent before mid-card so
              most of the surface stays clean white. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-1 rounded-[8px]"
            style={{
              background:
                'linear-gradient(180deg, rgba(250, 115, 25, 0.07) 0%, rgba(250, 115, 25, 0.03) 28%, rgba(255, 255, 255, 0) 60%)',
            }}
          />
          <div className="relative flex flex-wrap items-end justify-between gap-3 px-6 pt-6">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <SectionIcon icon={Gauge} />
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                  Decision overview
                </p>
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="text-[30px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--neutral-strong-950)] sm:text-[38px]">
                  {metrics.total.toLocaleString()}
                </span>
                <span className="text-[13px] text-[var(--neutral-sub-600)]">
                  total decisions evaluated
                </span>
              </div>
            </div>
            <Link
              href="/dashboard/runs"
              className="group inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--primary-base)]"
            >
              View all runs
              <ArrowUpRight
                className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
                strokeWidth={2}
              />
            </Link>
          </div>

          {/* Distribution bar */}
          <div className="relative px-6 pt-6">
            <div className="flex h-[10px] w-full items-stretch gap-[2px] overflow-hidden">
              {distribution.map((seg, i) =>
                seg.pct > 0 ? (
                  // AlignUI-styled custom tooltip replaces the native
                  // `title=` (which read as a generic OS tooltip and
                  // broke design hygiene against the rest of the bar).
                  // Shows "ALLOW · 1,247 · 62%" so the user gets the
                  // raw count AND the share in one glance.
                  <Tooltip
                    key={seg.key}
                    content={
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className="font-semibold uppercase tracking-[0.05em]">
                          {seg.label}
                        </span>
                        <span className="opacity-50">·</span>
                        <span className="tabular-nums">
                          {seg.value.toLocaleString()}
                        </span>
                        <span className="opacity-50">·</span>
                        <span className="tabular-nums opacity-80">
                          {seg.pct.toFixed(1)}%
                        </span>
                      </span>
                    }
                  >
                    <motion.span
                      className="block rounded-[3px]"
                      style={{ backgroundColor: seg.color }}
                      initial={reduce ? { width: `${seg.pct}%` } : { width: 0 }}
                      animate={{ width: `${seg.pct}%` }}
                      transition={{
                        duration: DUR.bar,
                        ease: EASE.out,
                        delay: 0.4 + i * 0.08,
                      }}
                    />
                  </Tooltip>
                ) : null,
              )}
              {metrics.total === 0 && (
                <span
                  className="block flex-1 rounded-[3px]"
                  style={{ backgroundColor: 'var(--neutral-soft-200)' }}
                />
              )}
            </div>
          </div>

          {/* Legend — 4 cells separated by vertical dividers */}
          <motion.div
            className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 divide-y divide-[var(--stroke-soft-200)] sm:divide-x sm:divide-y-0 border-t border-[var(--stroke-soft-200)]"
            variants={staggerContainer(0.04, 0.5)}
            initial={reduce ? false : 'hidden'}
            animate="show"
          >
            {distribution.map((seg) => (
              <motion.div key={seg.key} variants={fadeUpSm} className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span
                    className="h-[7px] w-[7px] rounded-full ring-1 ring-inset"
                    style={{
                      backgroundColor: seg.dot,
                      // Faint ring of the saturated hue at low alpha — gives
                      // the pastel dot a subtle outline so it doesn't look
                      // washed-out on the white card.
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      ['--tw-ring-color' as any]: `color-mix(in srgb, ${seg.color} 24%, transparent)`,
                    }}
                    aria-hidden
                  />
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
                    {seg.label}
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--neutral-strong-950)]">
                    {seg.value.toLocaleString()}
                  </span>
                  <span className="text-[12px] text-[var(--neutral-soft-400)] tabular-nums">
                    {metrics.total === 0 ? '0%' : `${Math.round(seg.pct)}%`}
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>

        {/* ─── 6-cell stat strip ───────────────────────────────────── */}
        <motion.section
          className="mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.28 }}
        >
          <motion.div
            className="grid grid-cols-2 divide-y divide-[var(--stroke-soft-200)] sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-6 lg:divide-x lg:divide-y-0"
            variants={staggerContainer(0.04, 0.4)}
            initial={reduce ? false : 'hidden'}
            animate="show"
          >
            <StatCell
              label="Active sessions"
              value={stats.activeSessions}
              color={stats.activeSessions > 0 ? 'var(--success)' : undefined}
              live={stats.activeSessions > 0}
            />
            <StatCell label="Runs this week" value={stats.runsThisWeek} />
            <StatCell
              label="Pending approvals"
              value={stats.pendingApprovals}
              color={stats.pendingApprovals > 0 ? 'var(--primary-base)' : undefined}
            />
            <StatCell label="Policies active" value={stats.policiesActive} />
            <StatCell
              label="Blocked this week"
              value={stats.blockedThisWeek}
              color={stats.blockedThisWeek > 0 ? 'var(--error)' : undefined}
            />
            <StatCell
              label="Rewrites this week"
              value={stats.rewritesThisWeek}
              color={stats.rewritesThisWeek > 0 ? 'var(--feature)' : undefined}
            />
          </motion.div>
        </motion.section>

        {/* ─── Two-column: activity feed + pending approvals ───────────────
             items-start so each column is its natural height (no stretch
             leaving empty space below the shorter one), and the left
             column is sticky-top so it stays visible if approvals scrolls
             much taller than activity. */}
        <motion.div
          className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.42 }}
        >
          {/* Recent activity */}
          <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)] lg:sticky lg:top-[72px]">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <SectionIcon icon={History} />
                <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Recent activity
                </h2>
                <span className="inline-flex h-[18px] items-center justify-center rounded-[5px] bg-[var(--neutral-weak-50)] px-[6px] text-[10.5px] font-bold tabular-nums text-[var(--neutral-sub-600)]">
                  {runs.length.toLocaleString()}
                </span>
              </div>
              <Link
                href="/dashboard/runs"
                className="group inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--primary-base)]"
              >
                View all
                <ArrowUpRight
                  className="h-3 w-3 transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
                  strokeWidth={2}
                />
              </Link>
            </div>

            {recentRuns.length === 0 ? (
              <div className="border-t border-[var(--stroke-soft-200)]">
                <EmptyState
                  icon={<Shield className="h-5 w-5" />}
                  title="No agent activity yet"
                  description="Create a Room, then wire up your agent from its Connect tab."
                  action={
                    <Link href="/dashboard/rooms">
                      <Button variant="primary">Go to Rooms</Button>
                    </Link>
                  }
                  compact
                />
              </div>
            ) : (
              <motion.ul
                className="divide-y divide-[var(--stroke-soft-200)] border-t border-[var(--stroke-soft-200)]"
                variants={staggerContainer(0.03, 0.55)}
                initial={reduce ? false : 'hidden'}
                animate="show"
              >
                {recentRuns.map((run) => (
                  <ActivityRow key={run.id} run={run} />
                ))}
              </motion.ul>
            )}
          </section>

          {/* Pending approvals */}
          <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <SectionIcon icon={Inbox} />
                <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Pending approvals
                </h2>
                {stats.pendingApprovals > 0 && (
                  <span
                    className="inline-flex h-[18px] items-center justify-center rounded-[5px] px-[6px] text-[10.5px] font-bold text-white tabular-nums"
                    style={{ backgroundColor: 'var(--primary-base)' }}
                  >
                    {stats.pendingApprovals.toLocaleString()}
                  </span>
                )}
              </div>
              <Link
                href="/dashboard/approvals"
                className="group inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--primary-base)]"
              >
                All
                <ArrowUpRight
                  className="h-3 w-3 transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
                  strokeWidth={2}
                />
              </Link>
            </div>

            {pendingItems.length === 0 ? (
              <div className="border-t border-[var(--stroke-soft-200)]">
                <EmptyState
                  icon={<Bell className="h-5 w-5" />}
                  title="All clear"
                  description="No approvals waiting for review."
                  compact
                />
              </div>
            ) : (
              <motion.ul
                className="divide-y divide-[var(--stroke-soft-200)] border-t border-[var(--stroke-soft-200)]"
                variants={staggerContainer(0.04, 0.55)}
                initial={reduce ? false : 'hidden'}
                animate="show"
              >
                {pendingItems.map((approval) => (
                  <ApprovalRow
                    key={approval.id}
                    approval={approval}
                    isActioning={actioningIds.has(approval.id)}
                    onAction={(id, reject) => {
                      if (reject) {
                        const target = pendingItems.find((a) => a.id === id);
                        if (target) setPendingDeny(target);
                      } else {
                        handleApproval(id, false);
                      }
                    }}
                  />
                ))}
              </motion.ul>
            )}
          </section>
        </motion.div>
      </div>
      {/* Deny confirmation. Same shape as /dashboard/approvals so
          the destructive interaction feels consistent across both
          surfaces where pending approvals can be acted on. */}
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
          await handleApproval(id, true);
        }}
      />
    </>
  );
}

// ── Coloured inline value ────────────────────────────────────────────────────
function ColoredCount({ value, color }: { value: number; color: string }) {
  return (
    <span
      className="font-semibold tabular-nums"
      style={{ color }}
    >
      {value.toLocaleString()}
    </span>
  );
}

// ── Single stat cell ─────────────────────────────────────────────────────────
function StatCell({
  label,
  value,
  color,
  live,
}: {
  label: string;
  value: number;
  color?: string;
  live?: boolean;
}) {
  return (
    <div className="px-6 py-4">
      <div className="flex items-center gap-1.5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
          {label}
        </p>
        {live && (
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: 'var(--success)' }}
            aria-hidden
          />
        )}
      </div>
      <p
        className="mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums"
        style={{ color: color ?? 'var(--neutral-strong-950)' }}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

// ── Decision icon ────────────────────────────────────────────────────────────
function DecisionIcon({ decision }: { decision: string }) {
  const upper = (decision ?? '').toUpperCase();
  const color = decisionColor(decision);

  let Icon = CheckCircle2;
  if (upper === 'DENY' || upper === 'REJECTED' || upper === 'DENIED') Icon = XCircle;
  // REWRITE icon: Pencil = universal "edited/modified" — instantly
  // recognizable at 14px. Iteration history: Wand2 (felt AI-magic),
  // Replace (barely readable at this size per user). Pencil sticks.
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

// ── Activity row ─────────────────────────────────────────────────────────────
function ActivityRow({ run }: { run: SessionAction }) {
  return (
    <motion.li variants={fadeUpSm}>
      <Link
        href="/dashboard/runs"
        className="flex items-center gap-3 px-6 py-3.5 transition-colors hover:bg-[var(--primary-lighter)]/60"
      >
        <DecisionIcon decision={run.decision} />
        <AgentMark name={run.agent_name || ''} size="xs" />
        <span className="shrink-0 text-[13px] font-medium text-[var(--neutral-strong-950)]">
          {run.agent_name || 'Unknown'}
        </span>
        <span className="hidden sm:inline-flex">
          <CodeChip>{run.tool_name}</CodeChip>
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--neutral-sub-600)]">
          {truncate(run.action_summary, 60)}
        </span>
        {run.execution_time != null && (
          <span className="hidden text-[11px] text-[var(--neutral-soft-400)] tabular-nums md:inline">
            {formatExecutionTimeMs(run.execution_time)}
          </span>
        )}
        <RelativeTime
          timestamp={run.timestamp}
          className="hidden text-[11px] text-[var(--neutral-soft-400)] tabular-nums lg:inline"
        />
        <DecisionBadge decision={run.decision} />
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 text-[var(--neutral-soft-400)]"
          strokeWidth={2}
        />
      </Link>
    </motion.li>
  );
}

// ── Approval row ─────────────────────────────────────────────────────────────
function ApprovalRow({
  approval,
  isActioning,
  onAction,
}: {
  approval: MCPApproval;
  isActioning: boolean;
  onAction: (id: string, reject: boolean) => void;
}) {
  const agentName =
    typeof approval.context?.user === 'string' ? approval.context.user : 'Agent';
  const repo =
    typeof approval.arguments?.repo === 'string' ? approval.arguments.repo : null;
  const branch =
    typeof approval.arguments?.branch === 'string'
      ? approval.arguments.branch
      : null;
  const summary =
    typeof approval.action_summary === 'string'
      ? approval.action_summary
      : `Requested tool: ${approval.tool_name}`;

  return (
    <motion.li
      variants={fadeUpSm}
      className="group px-6 py-4 transition-colors hover:bg-[var(--primary-lighter)]/60"
    >
      <div className="flex items-center gap-2">
        {/* Inline status dot — sits between the start of the row and the
            avatar so it has proper breathing room from the card edge. */}
        <span
          className="aegis-live-dot inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: 'var(--primary-base)', color: 'var(--primary-base)' }}
          aria-hidden
        />
        <AgentMark name={agentName} size="xs" />
        <span className="truncate text-[12.5px] font-semibold text-[var(--neutral-strong-950)]">
          {agentName}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--neutral-soft-400)]">
          <Clock className="h-3 w-3" strokeWidth={2} />
          <RelativeTime timestamp={approval.created_at} />
        </span>
      </div>

      <p
        className="mt-2 line-clamp-2 text-[12.5px] font-medium leading-[1.5] tracking-[-0.01em] text-[var(--neutral-strong-950)]"
        title={summary}
      >
        {summary}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <CodeChip>{approval.tool_name}</CodeChip>
        {branch && <CodeChip>{branch}</CodeChip>}
        {repo && <CodeChip>{repo}</CodeChip>}
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          disabled={isActioning}
          onClick={() => onAction(approval.id, true)}
        >
          Deny
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={isActioning}
          onClick={() => onAction(approval.id, false)}
        >
          Approve
        </Button>
      </div>
    </motion.li>
  );
}

function ChipLabel_DEPRECATED({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * Bare 24×24 Lucide icon next to the card title in brand orange. No box —
 * the icon acts as a typographic anchor that signals the section's identity.
 */
function SectionIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <Icon
      className="h-4 w-4 shrink-0"
      style={{ color: 'var(--primary-base)' }}
      strokeWidth={2}
      aria-hidden
    />
  );
}

/**
 * AnomalyListItem — one row in the dashboard's CIL events callout.
 *
 * Renders the canonical semantic_type chip + the classifier's
 * blast_radius_reason (the actual audit-line reasoning trace). Every
 * row is a moment where the Layer 2 classifier produced a non-ALLOW
 * verdict; clicking through deep-links into the Runs filtered view.
 */
function AnomalyListItem({ run }: { run: SessionAction }) {
  const connector = getConnectorForTool(run.tool_name);
  const reasoning = run.blast_radius_reason ?? run.anomaly_reason;
  return (
    <li>
      <Link
        href={
          run.semantic_type
            ? `/dashboard/runs?semantic_type=${run.semantic_type}`
            : '/dashboard/runs'
        }
        className="group block px-5 py-3 transition-colors duration-150 hover:bg-[var(--primary-lighter)]/40"
      >
        <div className="flex items-start gap-3">
          {/* Canonical concentric IconMark — outer ring + inner sticker. */}
          <div
            aria-hidden
            className="relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center"
          >
            <div className="absolute h-11 w-11 rounded-full border border-[var(--stroke-soft-200)]" />
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-[0_1px_2px_rgba(23,23,23,0.05)] ring-1 ring-[var(--stroke-soft-200)]">
              {connector ? (
                <ConnectorIcon id={connector} size={16} />
              ) : (
                <AlertTriangle
                  className="h-4 w-4 text-[var(--warning)]"
                  strokeWidth={2}
                />
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {run.semantic_type ? (
                <SemanticTypeChip
                  semantic_type={run.semantic_type}
                  reason={reasoning ?? undefined}
                />
              ) : (
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--warning-dark)]">
                  CIL event
                </span>
              )}
              <span className="text-[11px] text-[var(--neutral-soft-400)]">
                {run.agent_name}
              </span>
              <span className="text-[11px] text-[var(--neutral-soft-400)]">·</span>
              <CodeChip>{run.tool_name}</CodeChip>
            </div>
            {reasoning && (
              <p className="mt-1 text-[12.5px] leading-[1.45] text-[var(--neutral-strong-950)]">
                {reasoning}
              </p>
            )}
            {run.target_repo && (
              <p className="mt-0.5 text-[11px] text-[var(--neutral-soft-400)]">
                {run.target_repo}
                {run.target_branch ? ` · ${run.target_branch}` : ''}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <RelativeTime
              timestamp={run.timestamp}
              className="text-[11px] text-[var(--neutral-soft-400)]"
            />
            <ChevronRight
              className="h-3 w-3 text-[var(--neutral-soft-400)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
              strokeWidth={2}
              aria-hidden
            />
          </div>
        </div>
      </Link>
    </li>
  );
}

/**
 * Outcome tile — one of four cells in the dashboard's outcome hero row.
 *
 * Big tabular number, semantic color, footnote underneath. Tone-colored
 * micro-shadow under the icon ties the visual treatment back to the
 * notification panel's icon marks, so the dashboard feels like a single
 * design system not a collage.
 *
 * Numbers come from the `stats` memo above. Footnotes are short,
 * context-aware strings so this tile reads as a sentence not a stat.
 */
function OutcomeTile({
  label,
  value,
  color,
  icon: Icon,
  footnote,
  href,
}: {
  label: string;
  value: number;
  color: string;
  icon: LucideIcon;
  footnote?: string;
  /** Optional deep-link destination. When set, the entire tile becomes
   *  clickable and the footnote gains a hover arrow so the affordance
   *  is clear without changing the calm stat-tile presentation. */
  href?: string;
}) {
  const interactive = !!href;
  // Compact redesign — synthesized from Resend's metrics dashboard and
  // Rox's enterprise stat strip (researched via Refero). Replaces the
  // heavy 30-34px value + concentric 44×44 IconMark + radial corner
  // glow with a restrained pattern: small 24×24 sticker icon, 22-24px
  // numeric value, no tone-tinted background, AlignUI-grade typography.
  //
  // Hover treatment scales with interactivity: interactive tiles lift +
  // shift border tone; passive tiles just bump the shadow slightly so
  // they still feel alive without suggesting a click target.
  // Lift via Framer Motion (GPU-composited translate3d) instead of
  // CSS `hover:-translate-y` — same pattern as the Agents, PolicyPack,
  // and Connectors cards. Border + shadow stay on CSS transitions so
  // they settle a frame before the motion completes.
  const baseClass = interactive
    ? 'group relative block overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)] bg-white p-3.5 shadow-[0_1px_2px_rgba(23,23,23,0.04)] transition-[box-shadow,border-color] duration-[220ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:border-[var(--primary-base)]/30 hover:shadow-[0_8px_20px_rgba(23,23,23,0.06),0_2px_6px_rgba(250,115,25,0.05)]'
    : 'group relative block overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)] bg-white p-3.5 shadow-[0_1px_2px_rgba(23,23,23,0.04)] transition-shadow duration-200 hover:shadow-[0_3px_8px_rgba(23,23,23,0.05),0_1px_2px_rgba(23,23,23,0.04)]';
  const focusClass = interactive
    ? ' focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-24)]'
    : '';
  const content = (
    <>
      {/* Header row — small 24×24 sticker (no concentric ring, that's
          reserved for the heavier IconMark surfaces) carrying the
          tone-coloured icon, followed by the uppercase eyebrow label.
          Inline always: at 24px the sticker is small enough that even
          the narrowest 133px-wide tile fits the icon + label without
          wrap-cramming. */}
      <div className="relative flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_1px_2px_rgba(23,23,23,0.05)] ring-1 ring-[var(--stroke-soft-200)]"
        >
          <Icon className="h-3 w-3" style={{ color }} strokeWidth={2.25} />
        </span>
        <p className="min-w-0 truncate text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
          {label}
        </p>
      </div>
      <p
        className="relative mt-2.5 text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--neutral-strong-950)] sm:text-[24px]"
      >
        {value.toLocaleString()}
      </p>
      {footnote && (
        <p className="relative mt-1 inline-flex items-center gap-1 text-[11px] leading-[1.4] text-[var(--neutral-sub-600)]">
          {footnote}
          {interactive && (
            // Resting opacity 50% so the affordance is visible on touch
            // devices (no hover state). Climbs to 100% on hover and
            // nudges right + up so the click target reads as a verb.
            <ArrowUpRight
              aria-hidden
              className="h-3 w-3 shrink-0 opacity-50 transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:opacity-100"
              strokeWidth={2}
              style={{ color }}
            />
          )}
        </p>
      )}
    </>
  );
  if (interactive) {
    // motion.div wraps the Link so the GPU-composited hover lift can
    // run independently of the click-target (the Link itself). Focus
    // styling stays on the Link because that's what receives keyboard
    // focus — putting focus-visible on the motion.div wouldn't ever
    // light up since the wrapper isn't tabbable.
    return (
      <motion.div
        whileHover={{
          y: -3,
          transition: { duration: 0.26, ease: [0.32, 0.72, 0.32, 1] },
        }}
        whileTap={{
          y: -1,
          transition: { duration: 0.12, ease: [0.4, 0, 0.2, 1] },
        }}
      >
        <Link href={href!} className={baseClass + focusClass}>
          <Inner />
        </Link>
      </motion.div>
    );
  }
  return (
    <div className={baseClass}>
      <Inner />
    </div>
  );

  // Inner is declared down here so we can share the body between the
  // interactive (Link) and non-interactive (div) variants without
  // duplicating the JSX. React allows this hoisting because Inner is
  // just a JSX-returning function, not a component with state.
  function Inner() {
    return content;
  }
}
