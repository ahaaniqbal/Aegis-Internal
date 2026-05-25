'use client';

/**
 * CIL Insights — `/dashboard/insights`.
 *
 * The moat surface. Visualises the Contextual Intelligence Layer's
 * behavioural baselines, anomaly trends, risk-score distribution, and
 * per-agent trust posture in one scannable view. This is the slide an
 * investor walks away from saying "OK, that's real intelligence, not
 * just YAML rules with a pretty UI."
 *
 * Sections (top → bottom):
 *   1. Compact header (matches Runs / Policies / Sessions cadence)
 *   2. 4-tile at-a-glance row (anomalies, avg risk, mature baselines,
 *      runs scored this week)
 *   3. Anomaly trend chart — area chart, last 14 days
 *   4. Risk-score distribution histogram (left) + Top anomaly patterns
 *      list (right), 2-column on lg+
 *   5. Agents ranked by trust score — table with mark + score bar +
 *      run/anomaly stats + last seen
 *
 * Data comes from the shared `useDashboardData()` runs feed — no new
 * endpoints. Everything aggregates on the client at render time so the
 * backend wiring story is "stream of action events; the page derives
 * everything else." Easy story for the engineering hand-off.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowUpRight,
  Gauge,
  Layers,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { AgentMark } from '@/components/ui/AgentMark';
import { CodeChip } from '@/components/ui/CodeChip';
import { ConnectorIcon, getConnectorForTool } from '@/components/ui/ConnectorMark';
import EmptyState from '@/components/ui/EmptyState';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { SemanticTypeChip, SEMANTIC_TYPE_CONFIG } from '@/components/ui/SemanticTypeChip';
import { Tooltip } from '@/components/ui/Tooltip';
import { useDashboardData } from '@/lib/dashboardDataContext';
import { DUR, EASE, fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';
import type { SemanticType, SessionAction } from '@/lib/types';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const TREND_DAYS = 14;
// Trust = 1 - anomaly_rate, clamped low so we never call an agent
// completely untrusted from a sample of a few flagged runs (would feel
// unfair on the demo). Baseline-maturity threshold = 20 runs; below
// that, the score reads as "Learning baseline" not a trust verdict.
const TRUST_FLOOR = 0.5;
const MATURE_BASELINE_RUNS = 20;

type TimeRange = '24h' | '7d' | '30d';

const TIME_RANGE_MS: Record<TimeRange, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d':  7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

/** Canonical 10 in display order (most-restrictive decision last, ALLOW types first). */
const SEMANTIC_TYPE_FILTER_ORDER: SemanticType[] = [
  'working_commit',
  'test_only_change',
  'ephemeral_force_push',
  'protected_branch_write',
  'large_blast_radius_change',
  'sensitive_path_change',
  'sequence_anomaly',
  'freeze_window_violation',
  'credential_exposure',
  'autonomous_merge_attempt',
];

export default function InsightsPage() {
  const reduce = useReducedMotion();
  const { sessionActions: runs, lastUpdated, refreshRuns } = useDashboardData();

  // Drill-down state — filter table by semantic_type (single-select)
  // and time range (24h / 7d / 30d).
  const [activeType, setActiveType] = useState<SemanticType | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const drilldownRuns = useMemo(() => {
    const cutoff = Date.now() - TIME_RANGE_MS[timeRange];
    return runs
      .filter((r) => new Date(r.timestamp).getTime() >= cutoff)
      .filter((r) => (activeType ? r.semantic_type === activeType : true))
      .filter((r) => !!r.semantic_type)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50);
  }, [runs, activeType, timeRange]);

  // ── Semantic_type distribution (Layer 2 canonical view) ───────
  // Counts every action's `semantic_type` for this-week's runs and
  // returns a sorted list with absolute count + percentage. Powers
  // the primary chart on this page — the moat made visible.
  const semanticTypeDistribution = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - ONE_WEEK_MS;
    const runsThisWeek = runs.filter(
      (r) => new Date(r.timestamp).getTime() >= weekAgo,
    );
    const counts = new Map<string, number>();
    let total = 0;
    for (const r of runsThisWeek) {
      if (!r.semantic_type) continue;
      counts.set(r.semantic_type, (counts.get(r.semantic_type) ?? 0) + 1);
      total += 1;
    }
    if (total === 0) return [];
    return Array.from(counts.entries())
      .map(([semantic_type, count]) => ({
        semantic_type,
        count,
        pct: (count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }, [runs]);

  // ── At-a-glance stats ──────────────────────────────────────────
  const stats = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - ONE_WEEK_MS;
    const runsThisWeek = runs.filter(
      (r) => new Date(r.timestamp).getTime() >= weekAgo,
    );
    const flagged = runsThisWeek.filter((r) => r.anomaly);
    const scored = runsThisWeek.filter(
      (r) => typeof r.risk_score === 'number',
    );
    const avgRisk =
      scored.length > 0
        ? scored.reduce((s, r) => s + (r.risk_score ?? 0), 0) / scored.length
        : 0;

    // Mature baselines: agents we've seen ≥ MATURE_BASELINE_RUNS runs
    // from. Below that the baseline is still "learning" so we don't
    // want to count them as trustworthy detections yet.
    const runsByAgent = new Map<string, number>();
    for (const r of runs) {
      if (!r.agent_name) continue;
      runsByAgent.set(
        r.agent_name,
        (runsByAgent.get(r.agent_name) ?? 0) + 1,
      );
    }
    const matureBaselines = Array.from(runsByAgent.values()).filter(
      (n) => n >= MATURE_BASELINE_RUNS,
    ).length;

    return {
      anomaliesThisWeek: flagged.length,
      avgRisk,
      matureBaselines,
      runsScoredThisWeek: runsThisWeek.length,
      totalAgents: runsByAgent.size,
    };
  }, [runs]);

  // ── Anomaly trend (last TREND_DAYS days, bucketed by day) ──────
  const trendData = useMemo(() => {
    const buckets: Array<{
      day: string;
      anomalies: number;
      total: number;
      ts: number;
    }> = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      buckets.push({
        day: d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        anomalies: 0,
        total: 0,
        ts: d.getTime(),
      });
    }
    const byTs = new Map(buckets.map((b) => [b.ts, b]));
    for (const r of runs) {
      const t = new Date(r.timestamp).getTime();
      const dayStart = new Date(t);
      dayStart.setHours(0, 0, 0, 0);
      const bucket = byTs.get(dayStart.getTime());
      if (!bucket) continue;
      bucket.total += 1;
      if (r.anomaly) bucket.anomalies += 1;
    }
    return buckets;
  }, [runs]);

  // ── Risk-score distribution (5 buckets, 0.0-0.2 .. 0.8-1.0) ────
  const riskDistribution = useMemo(() => {
    const buckets = [
      { label: '0.0-0.2', range: 'Calm',        min: 0.0, max: 0.2, count: 0, tone: 'var(--success)' },
      { label: '0.2-0.4', range: 'Routine',     min: 0.2, max: 0.4, count: 0, tone: 'var(--success)' },
      { label: '0.4-0.6', range: 'Elevated',    min: 0.4, max: 0.6, count: 0, tone: 'var(--warning)' },
      { label: '0.6-0.8', range: 'High',        min: 0.6, max: 0.8, count: 0, tone: 'var(--warning)' },
      { label: '0.8-1.0', range: 'Critical',    min: 0.8, max: 1.01, count: 0, tone: 'var(--error)' },
    ];
    for (const r of runs) {
      const s = r.risk_score;
      if (typeof s !== 'number') continue;
      for (const b of buckets) {
        if (s >= b.min && s < b.max) {
          b.count += 1;
          break;
        }
      }
    }
    const maxCount = Math.max(1, ...buckets.map((b) => b.count));
    return buckets.map((b) => ({ ...b, pct: (b.count / maxCount) * 100 }));
  }, [runs]);

  // ── Top anomaly patterns (group by anomaly_reason, count) ──────
  // The reason strings already cluster well in the demo data because
  // they're picked from a finite phrase pool. In production CIL will
  // need a real pattern-extraction step; for the demo we just count
  // exact-match reasons and show the top N.
  const topPatterns = useMemo(() => {
    const counts = new Map<string, { count: number; lastSeen: string }>();
    for (const r of runs) {
      if (!r.anomaly || !r.anomaly_reason) continue;
      const prev = counts.get(r.anomaly_reason);
      counts.set(r.anomaly_reason, {
        count: (prev?.count ?? 0) + 1,
        lastSeen:
          !prev || new Date(r.timestamp) > new Date(prev.lastSeen)
            ? r.timestamp
            : prev.lastSeen,
      });
    }
    return Array.from(counts.entries())
      .map(([reason, data]) => ({ reason, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [runs]);

  // ── Agents ranked by trust score ───────────────────────────────
  const agentRanking = useMemo(() => {
    const byAgent = new Map<
      string,
      {
        runs: number;
        anomalies: number;
        approvals: number;
        denies: number;
        lastSeen: string;
        connectors: Set<string>;
      }
    >();
    for (const r of runs) {
      if (!r.agent_name) continue;
      const a = byAgent.get(r.agent_name) ?? {
        runs: 0,
        anomalies: 0,
        approvals: 0,
        denies: 0,
        lastSeen: r.timestamp,
        connectors: new Set<string>(),
      };
      a.runs += 1;
      if (r.anomaly) a.anomalies += 1;
      const d = (r.decision ?? '').toUpperCase();
      if (d === 'DENY') a.denies += 1;
      if (d.includes('APPROVAL')) a.approvals += 1;
      if (new Date(r.timestamp) > new Date(a.lastSeen)) a.lastSeen = r.timestamp;
      const c = getConnectorForTool(r.tool_name);
      if (c) a.connectors.add(c);
      byAgent.set(r.agent_name, a);
    }
    return Array.from(byAgent.entries())
      .map(([name, a]) => {
        const anomalyRate = a.runs > 0 ? a.anomalies / a.runs : 0;
        const trust = Math.max(TRUST_FLOOR, 1 - anomalyRate);
        const mature = a.runs >= MATURE_BASELINE_RUNS;
        return {
          name,
          runs: a.runs,
          anomalies: a.anomalies,
          approvals: a.approvals,
          denies: a.denies,
          lastSeen: a.lastSeen,
          connectors: Array.from(a.connectors),
          trust,
          mature,
        };
      })
      // Sort by anomaly count desc so the most-flagged agents land at
      // the top — that's what a reviewer wants to see first.
      .sort((a, b) => b.anomalies - a.anomalies || b.runs - a.runs);
  }, [runs]);

  const chartConfig: ChartConfig = {
    anomalies: {
      label: 'Anomalies',
      color: 'var(--warning)',
    },
    total: {
      label: 'Total runs',
      color: 'var(--neutral-soft-400)',
    },
  };

  return (
    <>
      <Topbar
        title="CIL Insights"
        subtitle="Deterministic semantic classifier"
        lastUpdated={lastUpdated}
        onRefresh={refreshRuns}
        showDateRange
      />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {/* ─── Header ─────────────────────────────────────────────── */}
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
            Contextual Intelligence Layer
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
          >
            Same action, different decision
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-2 text-[13.5px] leading-[1.55] text-[var(--neutral-sub-600)]"
          >
            The deterministic semantic classifier assembles four context signals (Session, Repo, Branch, Env) in real time and maps every tool call to one of ten <code className="font-mono text-[12px] text-[var(--neutral-strong-950)]">semantic_type</code> values. No LLM in the decision path. The same raw action becomes ALLOW or DENY depending entirely on context. **That is the moat.**
          </motion.p>
        </motion.header>

        {/* ─── Canonical example: same action, two decisions ───────
            Light card matching the rest of the product. The "diff
            inspector" feel comes from the side-by-side mono key=value
            layout, not from inverting the surface. Color-coded values
            via semantic tokens. Stacks on mobile. */}
        <motion.section
          className="mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.16 }}
        >
          <div className="border-b border-[var(--stroke-soft-200)] px-4 py-3 sm:px-5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--primary-dark)]">
              Canonical example
            </p>
            <h2 className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
              <code className="font-mono text-[13px]">git push --force</code>
              <span className="text-[11.5px] font-normal text-[var(--neutral-sub-600)]">
                identical tool call, opposite verdict
              </span>
            </h2>
          </div>

          {/* Two-column diff. Stacks on mobile (sm:grid-cols-2). */}
          <div className="grid grid-cols-1 divide-y divide-[var(--stroke-soft-200)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            {/* ALLOW path */}
            <div className="px-4 py-4 sm:px-5">
              <div className="flex items-baseline justify-between gap-2 pb-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--success)]">
                  scenario_a
                </p>
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--success)]">
                  ALLOW
                </span>
              </div>
              <dl className="space-y-1.5 font-mono text-[10.5px] leading-[1.5]">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[var(--neutral-soft-400)]">branch_name</dt>
                  <dd className="break-all text-right font-semibold text-[var(--neutral-strong-950)]">aegis_workstation</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[var(--neutral-soft-400)]">is_aegis_managed</dt>
                  <dd className="font-semibold text-[var(--success)]">true</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[var(--neutral-soft-400)]">session_owner_match</dt>
                  <dd className="font-semibold text-[var(--success)]">true</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[var(--neutral-soft-400)]">has_open_pr</dt>
                  <dd className="font-semibold text-[var(--success)]">false</dd>
                </div>
              </dl>
              <div className="mt-4 rounded-[6px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2">
                <p className="break-all font-mono text-[10.5px] leading-[1.5]">
                  <span className="text-[var(--neutral-soft-400)]">semantic_type = </span>
                  <span className="font-semibold text-[var(--success)]">ephemeral_force_push</span>
                </p>
              </div>
              <p className="mt-3 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                Force-push to an aegis-managed branch by the session owner with no open PR. Safe by classification.
              </p>
            </div>

            {/* DENY path */}
            <div className="px-4 py-4 sm:px-5">
              <div className="flex items-baseline justify-between gap-2 pb-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--error)]">
                  scenario_b
                </p>
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--error)]">
                  DENY
                </span>
              </div>
              <dl className="space-y-1.5 font-mono text-[10.5px] leading-[1.5]">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[var(--neutral-soft-400)]">target_branch</dt>
                  <dd className="break-all text-right font-semibold text-[var(--neutral-strong-950)]">main</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[var(--neutral-soft-400)]">is_protected_branch</dt>
                  <dd className="font-semibold text-[var(--error)]">true</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[var(--neutral-soft-400)]">freeze_window_active</dt>
                  <dd className="font-semibold text-[var(--error)]">true</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[var(--neutral-soft-400)]">ci_passing</dt>
                  <dd className="font-semibold text-[var(--error)]">false</dd>
                </div>
              </dl>
              <div className="mt-4 rounded-[6px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2">
                <p className="break-all font-mono text-[10.5px] leading-[1.5]">
                  <span className="text-[var(--neutral-soft-400)]">semantic_type = </span>
                  <span className="font-semibold text-[var(--error)]">freeze_window_violation</span>
                </p>
              </div>
              <p className="mt-3 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                Same tool call. Protected branch during an active release freeze with failing CI. Hard pre-execution DENY.
              </p>
            </div>
          </div>

          {/* Footer — the classifier signature */}
          <div className="border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-2.5 sm:px-5">
            <p className="break-all font-mono text-[10.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
              <span className="text-[var(--neutral-soft-400)]">// </span>
              classify(tool_name, args, session_context, repo_context, branch_context, env_context) → semantic_type, blast_radius
            </p>
          </div>
        </motion.section>

        {/* ─── Semantic type distribution ────────────────────────── */}
        {semanticTypeDistribution.length > 0 && (
          <motion.section
            className="mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.2 }}
          >
            <div className="border-b border-[var(--stroke-soft-200)] px-5 py-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                semantic_type distribution
              </p>
              <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                {semanticTypeDistribution.reduce((s, x) => s + x.count, 0)} classifications this week
              </h2>
              <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                Every tool call the classifier saw, mapped to one of the canonical 10 semantic_types. Click any row to drill into the Runs view filtered to that type.
              </p>
            </div>
            <ul className="divide-y divide-[var(--stroke-soft-200)]">
              {semanticTypeDistribution.map((row) => (
                <SemanticTypeDistributionRow
                  key={row.semantic_type}
                  semantic_type={row.semantic_type}
                  count={row.count}
                  pct={row.pct}
                />
              ))}
            </ul>
          </motion.section>
        )}

        {/* ─── Drill-down: filter + recent classifications table ───── */}
        <motion.section
          className="mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.22 }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--stroke-soft-200)] px-4 py-3 sm:px-5">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                Recent classifications
              </p>
              <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                {drilldownRuns.length === 0
                  ? activeType ? `No ${activeType} in this window` : 'No classifications in this window'
                  : `${drilldownRuns.length} ${drilldownRuns.length === 1 ? 'classification' : 'classifications'}${activeType ? ` of type ${activeType}` : ''}`}
              </h2>
            </div>
            {/* Time-range pill control */}
            <div
              role="tablist"
              className="inline-flex items-center gap-0.5 rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-0.5"
            >
              {(['24h', '7d', '30d'] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  role="tab"
                  aria-selected={timeRange === r}
                  onClick={() => setTimeRange(r)}
                  className={[
                    'h-6 rounded-[6px] px-2.5 text-[11px] font-semibold tracking-[-0.005em] transition-colors',
                    timeRange === r
                      ? 'bg-[var(--white-0)] text-[var(--neutral-strong-950)] shadow-[0_1px_2px_rgba(23,23,23,0.06)]'
                      : 'text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]',
                  ].join(' ')}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Semantic type filter chip row */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--stroke-soft-200)] px-4 py-3 sm:px-5">
            <button
              onClick={() => setActiveType(null)}
              className={[
                'inline-flex h-[22px] items-center rounded-[6px] border px-2 text-[10.5px] font-semibold tracking-[-0.005em] transition-colors',
                activeType === null
                  ? 'border-[var(--neutral-strong-950)] bg-[var(--neutral-strong-950)] text-white'
                  : 'border-[var(--stroke-soft-200)] bg-[var(--white-0)] text-[var(--neutral-sub-600)] hover:border-[var(--stroke-sub-300)]',
              ].join(' ')}
            >
              All
            </button>
            {SEMANTIC_TYPE_FILTER_ORDER.map((t) => {
              const isActive = activeType === t;
              const cfg = SEMANTIC_TYPE_CONFIG[t];
              const color =
                cfg?.tone === 'primary' ? 'var(--primary-base)'
                : cfg?.tone === 'error'  ? 'var(--error)'
                : cfg?.tone === 'warning'? 'var(--warning-dark)'
                : cfg?.tone === 'success'? 'var(--success)'
                : 'var(--neutral-sub-600)';
              return (
                <button
                  key={t}
                  onClick={() => setActiveType(isActive ? null : t)}
                  className={[
                    'inline-flex h-[22px] items-center gap-1 rounded-[6px] border px-2 font-mono text-[10px] font-medium tracking-[-0.005em] transition-colors',
                    isActive
                      ? 'border-transparent text-white'
                      : 'border-[var(--stroke-soft-200)] bg-[var(--white-0)] text-[var(--neutral-sub-600)] hover:border-[var(--stroke-sub-300)]',
                  ].join(' ')}
                  style={isActive ? { backgroundColor: color } : undefined}
                >
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.85)' : color }}
                  />
                  {t}
                </button>
              );
            })}
          </div>

          {/* Drill-down table */}
          {drilldownRuns.length === 0 ? (
            <div className="px-5 py-10 text-center text-[12.5px] text-[var(--neutral-sub-600)]">
              {activeType
                ? <>No <code className="font-mono text-[12px]">{activeType}</code> classifications in the last {timeRange}. Try widening the window or removing the filter.</>
                : <>No classifications in the last {timeRange}.</>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-sub-600)]">
                    <th scope="col" className="px-4 py-2.5">When</th>
                    <th scope="col" className="px-4 py-2.5">Agent</th>
                    <th scope="col" className="px-4 py-2.5">Tool</th>
                    <th scope="col" className="px-4 py-2.5">semantic_type</th>
                    <th scope="col" className="px-4 py-2.5">Context signals</th>
                    <th scope="col" className="px-4 py-2.5">Blast</th>
                    <th scope="col" className="px-4 py-2.5">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--stroke-soft-200)]">
                  {drilldownRuns.map((r) => (
                    <DrilldownRow key={r.id} run={r} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>

        {/* ─── Behavioral amplifier section divider ───────────────── */}
        <motion.div
          className="mb-4 border-t border-[var(--stroke-soft-200)] pt-6"
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.default, ease: EASE.out, delay: 0.24 }}
        >
          <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]">
            Behavioral baselines · Roadmap
          </p>
          <h2 className="text-[18px] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--neutral-strong-950)]">
            What your agent baselines tell us
          </h2>
          <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--neutral-sub-600)]">
            Statistical baselines per agent are the Series-A roadmap amplifier on top of the deterministic classifier above. Below: anomaly trends, risk distribution, agent ranking — useful as secondary signals, not the moat itself.
          </p>
        </motion.div>

        {/* ─── At-a-glance row ────────────────────────────────────── */}
        <motion.section
          className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.14 }}
          aria-label="CIL at-a-glance"
        >
          <InsightTile
            label="Anomalies surfaced"
            value={stats.anomaliesThisWeek.toLocaleString()}
            footnote={
              stats.anomaliesThisWeek > 0
                ? 'What static policies would have missed'
                : 'Baselines healthy this week'
            }
            color="var(--warning)"
            icon={AlertTriangle}
          />
          <InsightTile
            label="Avg risk score"
            value={stats.avgRisk.toFixed(2)}
            footnote={
              stats.avgRisk >= 0.5
                ? 'Above the calm-band median'
                : 'Below the elevated band'
            }
            color={
              stats.avgRisk >= 0.75
                ? 'var(--error)'
                : stats.avgRisk >= 0.45
                  ? 'var(--warning)'
                  : 'var(--success)'
            }
            icon={Gauge}
          />
          <InsightTile
            label="Mature baselines"
            value={stats.matureBaselines.toLocaleString()}
            footnote={`Agents with ${MATURE_BASELINE_RUNS}+ scored runs`}
            color="var(--success)"
            icon={Sparkles}
          />
          <InsightTile
            label="Runs scored"
            value={stats.runsScoredThisWeek.toLocaleString()}
            footnote="Every action runs through CIL"
            color="var(--primary-base)"
            icon={Layers}
          />
        </motion.section>

        {/* ─── Anomaly trend chart ────────────────────────────────── */}
        <motion.section
          className="relative mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.2 }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-1 rounded-[8px]"
            style={{
              background:
                'linear-gradient(180deg, rgba(250, 115, 25, 0.07) 0%, rgba(250, 115, 25, 0.03) 28%, rgba(255, 255, 255, 0) 60%)',
            }}
          />
          <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-5 py-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                Anomaly trend
              </p>
              <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Last {TREND_DAYS} days
              </h2>
            </div>
            <Link
              href="/dashboard/runs?cil=anomalies"
              className="group inline-flex items-center gap-1 text-[12px] font-medium text-[var(--neutral-sub-600)] transition-colors duration-150 hover:text-[var(--primary-base)]"
            >
              View all flagged
              <ArrowUpRight
                className="h-3 w-3 transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
                strokeWidth={2}
              />
            </Link>
          </div>
          <div className="relative px-2 py-4 sm:px-4">
            <ChartContainer
              config={chartConfig}
              // Fixed height matching the shadcn ChartContainer pattern
              // used on Token Expenditure (h-[320px] there for the big
              // hero charts). Insights trend is a secondary surface —
              // 220px keeps the whole page in one viewport on a
              // standard 13" laptop, which the previous 16:5 aspect
              // ratio (~400px at 1280 wide) did not.
              className="aspect-auto h-[220px] w-full"
            >
              <AreaChart data={trendData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="anomalyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="var(--warning)" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="totalFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--neutral-soft-400)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--neutral-soft-400)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--stroke-soft-200)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: 'var(--neutral-soft-400)' }}
                  minTickGap={20}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: 'var(--neutral-soft-400)' }}
                  width={28}
                  allowDecimals={false}
                />
                <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--neutral-soft-400)"
                  strokeWidth={1.5}
                  fill="url(#totalFill)"
                  isAnimationActive={!reduce}
                />
                <Area
                  type="monotone"
                  dataKey="anomalies"
                  stroke="var(--warning)"
                  strokeWidth={2}
                  fill="url(#anomalyFill)"
                  isAnimationActive={!reduce}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </motion.section>

        {/* ─── Risk distribution + Top patterns ───────────────────── */}
        <motion.div
          className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.26 }}
        >
          {/* Risk-score distribution */}
          <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <div className="border-b border-[var(--stroke-soft-200)] px-5 py-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                Risk distribution
              </p>
              <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                How risky are the actions we score?
              </h2>
            </div>
            <ul className="divide-y divide-[var(--stroke-soft-200)]">
              {riskDistribution.map((b) => (
                <li
                  key={b.label}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <span className="w-[58px] shrink-0 font-mono text-[11px] tabular-nums text-[var(--neutral-sub-600)]">
                    {b.label}
                  </span>
                  <span className="w-[64px] shrink-0 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--neutral-soft-400)]">
                    {b.range}
                  </span>
                  <div className="flex-1">
                    <div
                      aria-hidden
                      className="h-[6px] rounded-full bg-[var(--neutral-weak-50)] ring-1 ring-[var(--stroke-soft-200)]"
                    >
                      <motion.span
                        className="block h-full rounded-full"
                        style={{ backgroundColor: b.tone }}
                        initial={reduce ? { width: `${b.pct}%` } : { width: 0 }}
                        animate={{ width: `${b.pct}%` }}
                        transition={{
                          duration: DUR.bar,
                          ease: EASE.out,
                          delay: 0.32,
                        }}
                      />
                    </div>
                  </div>
                  <span className="w-[44px] shrink-0 text-right text-[12px] font-semibold tabular-nums text-[var(--neutral-strong-950)]">
                    {b.count.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Top anomaly patterns */}
          <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <div className="border-b border-[var(--stroke-soft-200)] px-5 py-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                Top anomaly patterns
              </p>
              <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                What CIL flagged most often
              </h2>
            </div>
            {topPatterns.length > 0 ? (
              <ul className="divide-y divide-[var(--stroke-soft-200)]">
                {topPatterns.map((p, i) => (
                  <li
                    key={p.reason}
                    className="flex items-start gap-3 px-5 py-3"
                  >
                    <span className="mt-0.5 inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-[4px] bg-[rgba(246,181,30,0.14)] px-1 text-[10.5px] font-bold tabular-nums text-[var(--warning-dark)]">
                      {p.count}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] leading-[1.45] text-[var(--neutral-strong-950)]">
                        {p.reason}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--neutral-soft-400)]">
                        last seen{' '}
                        <RelativeTime
                          timestamp={p.lastSeen}
                          className="text-[11px] text-[var(--neutral-soft-400)]"
                        />
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-8 text-center">
                <p className="text-[12.5px] text-[var(--neutral-sub-600)]">
                  No recurring anomaly patterns yet — baselines are
                  healthy across the fleet.
                </p>
              </div>
            )}
          </section>
        </motion.div>

        {/* ─── Agents ranked ──────────────────────────────────────── */}
        <motion.section
          className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.32 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-5 py-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                Agent posture
              </p>
              <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Ranked by anomalies surfaced
              </h2>
            </div>
            <Link
              href="/dashboard/agents"
              className="group inline-flex items-center gap-1 text-[12px] font-medium text-[var(--neutral-sub-600)] transition-colors duration-150 hover:text-[var(--primary-base)]"
            >
              All agents
              <ArrowUpRight
                className="h-3 w-3 transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
                strokeWidth={2}
              />
            </Link>
          </div>
          {agentRanking.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-5 w-5" />}
              title="No agents have produced scored runs yet"
              description="Connect your first agent to start building behavioural baselines."
              compact
            />
          ) : (
            <motion.ul
              className="divide-y divide-[var(--stroke-soft-200)]"
              variants={staggerContainer(0.03, 0.5)}
              initial={reduce ? false : 'hidden'}
              animate="show"
            >
              {agentRanking.slice(0, 8).map((a) => (
                <AgentRow key={a.name} agent={a} />
              ))}
            </motion.ul>
          )}
        </motion.section>
      </div>
    </>
  );
}

// ─── At-a-glance tile ────────────────────────────────────────────────
/**
 * Compact KPI tile — same shape as the redesigned OutcomeTile on the
 * dashboard home. Inlined here so the Insights page is fully
 * self-contained. The chrome stays neutral; tone lives in the icon and
 * the optional value hue for the avg-risk variant.
 */
function InsightTile({
  label,
  value,
  footnote,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  footnote: string;
  color: string;
  icon: LucideIcon;
}) {
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)] bg-white p-3.5 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
      <div className="relative flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_1px_2px_rgba(23,23,23,0.05)] ring-1 ring-[var(--stroke-soft-200)]"
        >
          <Icon
            className="h-3 w-3"
            style={{ color }}
            strokeWidth={2.25}
          />
        </span>
        <p className="min-w-0 truncate text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
          {label}
        </p>
      </div>
      <p
        className="relative mt-2.5 text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--neutral-strong-950)] sm:text-[24px]"
      >
        {value}
      </p>
      <p className="relative mt-1 text-[11px] leading-[1.4] text-[var(--neutral-sub-600)]">
        {footnote}
      </p>
    </div>
  );
}

// ─── Single agent row in the ranking table ───────────────────────────
function AgentRow({
  agent,
}: {
  agent: {
    name: string;
    runs: number;
    anomalies: number;
    approvals: number;
    denies: number;
    lastSeen: string;
    connectors: string[];
    trust: number;
    mature: boolean;
  };
}) {
  const trustPct = Math.round(agent.trust * 100);
  const trustColor =
    agent.trust >= 0.9
      ? 'var(--success)'
      : agent.trust >= 0.75
        ? 'var(--warning)'
        : 'var(--error)';
  return (
    <motion.li
      variants={fadeUpSm}
      className="flex flex-wrap items-center gap-3 px-5 py-3 sm:flex-nowrap"
    >
      <AgentMark name={agent.name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
            {agent.name}
          </span>
          {!agent.mature && (
            <Tooltip
              content={
                <span className="block max-w-[220px] whitespace-normal text-[11.5px] font-medium leading-[1.45] text-white">
                  Baseline is still learning. We need {MATURE_BASELINE_RUNS}+
                  scored runs before the trust score is considered stable.
                </span>
              }
              side="top"
              delayMs={120}
            >
              <span
                className="inline-flex cursor-help items-center rounded-[4px] bg-[var(--neutral-weak-50)] px-1.5 py-[1px] text-[9.5px] font-bold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]"
                tabIndex={0}
              >
                Learning baseline
              </span>
            </Tooltip>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--neutral-soft-400)]">
          <span className="inline-flex items-center gap-1">
            <Layers className="h-3 w-3" strokeWidth={2} />
            <span className="font-semibold text-[var(--neutral-sub-600)] tabular-nums">
              {agent.runs.toLocaleString()}
            </span>{' '}
            runs
          </span>
          {agent.anomalies > 0 && (
            <>
              <span className="text-[var(--stroke-sub-300)]">·</span>
              <span className="inline-flex items-center gap-1">
                <AlertTriangle
                  className="h-3 w-3 text-[var(--warning-dark)]"
                  strokeWidth={2.25}
                />
                <span className="font-semibold text-[var(--warning-dark)] tabular-nums">
                  {agent.anomalies}
                </span>{' '}
                anomal{agent.anomalies === 1 ? 'y' : 'ies'}
              </span>
            </>
          )}
          {agent.approvals > 0 && (
            <>
              <span className="text-[var(--stroke-sub-300)]">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="font-semibold text-[var(--neutral-sub-600)] tabular-nums">
                  {agent.approvals}
                </span>{' '}
                approvals
              </span>
            </>
          )}
          {agent.connectors.length > 0 && (
            <>
              <span className="text-[var(--stroke-sub-300)]">·</span>
              <span className="inline-flex items-center gap-1">
                {agent.connectors.slice(0, 5).map((c) => (
                  <ConnectorIcon
                    key={c}
                    id={c as Parameters<typeof ConnectorIcon>[0]['id']}
                    size={12}
                    className="opacity-90"
                  />
                ))}
                {agent.connectors.length > 5 && (
                  <span className="text-[10.5px] text-[var(--neutral-sub-600)]">
                    +{agent.connectors.length - 5}
                  </span>
                )}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <Tooltip
          content={
            <span className="block text-[11.5px] font-medium leading-[1.45]">
              <span
                className="block font-semibold uppercase tracking-[0.08em]"
                style={{ color: '#ffd268' }}
              >
                Trust score
              </span>
              <span className="mt-1 block tabular-nums text-white/90">
                {agent.trust.toFixed(2)} of 1.00
              </span>
            </span>
          }
          side="top"
          delayMs={120}
        >
          <span
            role="meter"
            aria-valuenow={trustPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Trust score ${agent.trust.toFixed(2)} of 1.00`}
            tabIndex={0}
            className="inline-flex w-[88px] items-center gap-1.5 rounded cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-24)]"
          >
            <span
              aria-hidden
              className="relative inline-block h-[5px] flex-1 overflow-hidden rounded-full bg-[var(--neutral-weak-50)] ring-1 ring-[var(--stroke-soft-200)]"
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${trustPct}%`, backgroundColor: trustColor }}
              />
            </span>
            <span
              className="shrink-0 text-[10.5px] font-bold tabular-nums"
              style={{ color: trustColor }}
            >
              {agent.trust.toFixed(2)}
            </span>
          </span>
        </Tooltip>
        <RelativeTime
          timestamp={agent.lastSeen}
          className="hidden text-[11px] tabular-nums text-[var(--neutral-soft-400)] sm:inline"
        />
      </div>
    </motion.li>
  );
}

/**
 * One row in the Layer 2 semantic_type distribution. Renders the
 * canonical chip + a horizontal bar showing share of weekly volume +
 * absolute count. Click-through deep-links into the Runs view
 * filtered to that semantic_type.
 */
function SemanticTypeDistributionRow({
  semantic_type,
  count,
  pct,
}: {
  semantic_type: string;
  count: number;
  pct: number;
}) {
  const cfg = SEMANTIC_TYPE_CONFIG[semantic_type as SemanticType];
  const decisionTone: Record<string, string> = {
    ALLOW: 'var(--success)',
    DENY: 'var(--error)',
    REWRITE: 'var(--primary-base)',
    REQUIRE_APPROVAL: 'var(--warning)',
  };
  const barColor = cfg ? decisionTone[cfg.decision] ?? 'var(--neutral-soft-400)' : 'var(--neutral-soft-400)';
  return (
    <li>
      <Link
        href={`/dashboard/runs?semantic_type=${semantic_type}`}
        className="group flex items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-[var(--primary-lighter)]/40"
      >
        <div className="w-[200px] shrink-0">
          <SemanticTypeChip semantic_type={semantic_type as SemanticType} />
        </div>
        <div className="min-w-0 flex-1">
          <span
            aria-hidden
            className="relative block h-[6px] overflow-hidden rounded-full bg-[var(--neutral-weak-50)] ring-1 ring-[var(--stroke-soft-200)]"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${Math.max(pct, 1.5)}%`,
                backgroundColor: barColor,
              }}
            />
          </span>
        </div>
        <span className="w-[60px] shrink-0 text-right text-[11.5px] font-semibold tabular-nums text-[var(--neutral-strong-950)]">
          {count}
        </span>
        <span className="hidden w-[44px] shrink-0 text-right text-[11px] tabular-nums text-[var(--neutral-soft-400)] sm:inline">
          {pct.toFixed(1)}%
        </span>
        <ChevronRightIcon className="ml-1 h-3.5 w-3.5 shrink-0 text-[var(--neutral-soft-400)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
      </Link>
    </li>
  );
}

// Tiny chevron-right SVG inline so this row doesn't need to re-import
// from lucide (avoids upstream-import churn).
function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/**
 * Drill-down table row. Renders a single classified action with its
 * agent, tool, semantic_type chip, context signals strip, blast radius,
 * and decision. Powers the filterable table on the CIL Insights page.
 */
function DrilldownRow({ run }: { run: SessionAction }) {
  const [expanded, setExpanded] = useState(false);
  const connector = getConnectorForTool(run.tool_name);
  const decision = (run.decision ?? '').toUpperCase();
  const decisionColor =
    decision === 'DENY' ? 'var(--error)'
    : decision === 'REWRITE' ? 'var(--primary-base)'
    : decision === 'ALLOW' ? 'var(--success)'
    : 'var(--warning-dark)';

  // Build a short "context signals" summary — surface 2-3 fields from
  // the four context snapshots that motivated this classification.
  const signals: string[] = [];
  if (run.repo_context_snapshot?.freeze_window_active) signals.push('freeze_active');
  if (run.repo_context_snapshot?.is_protected_branch) signals.push('protected_branch');
  if (run.branch_context_snapshot?.is_aegis_managed) signals.push('aegis_managed');
  if (run.env_context_snapshot?.environment_tier === 'production') signals.push('prod_tier');
  if (run.env_context_snapshot?.active_incident) signals.push('active_incident');
  if (run.session_context_snapshot?.ci_failure_streak && run.session_context_snapshot.ci_failure_streak >= 3) {
    signals.push(`ci_failures=${run.session_context_snapshot.ci_failure_streak}`);
  }
  if (signals.length === 0) signals.push('routine');

  const hasContext =
    run.session_context_snapshot ||
    run.repo_context_snapshot ||
    run.branch_context_snapshot ||
    run.env_context_snapshot;

  return (
    <>
      <tr
        className={`cursor-pointer transition-colors ${expanded ? 'bg-[var(--neutral-weak-50)]' : 'hover:bg-[var(--neutral-weak-50)]'}`}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <td className="whitespace-nowrap px-4 py-2.5">
          <span className="inline-flex items-center gap-2">
            <span
              className={`inline-flex h-4 w-4 items-center justify-center rounded-[3px] text-[10px] font-bold transition-transform ${expanded ? 'rotate-90' : ''}`}
              style={{ color: 'var(--neutral-sub-600)' }}
              aria-hidden
            >
              ›
            </span>
            <RelativeTime
              timestamp={run.timestamp}
              className="font-mono text-[11px] text-[var(--neutral-sub-600)]"
            />
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-2.5">
          <span className="flex items-center gap-1.5">
            <AgentMark name={run.agent_name} size="xs" />
            <span className="font-mono text-[11.5px] font-semibold text-[var(--neutral-strong-950)]">
              {run.agent_name}
            </span>
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-2.5">
          <span className="inline-flex items-center gap-1.5">
            {connector ? <ConnectorIcon id={connector} size={12} /> : null}
            <CodeChip>{run.tool_name}</CodeChip>
          </span>
        </td>
        <td className="px-4 py-2.5">
          {run.semantic_type ? (
            <SemanticTypeChip
              semantic_type={run.semantic_type}
              reason={run.blast_radius_reason}
            />
          ) : (
            <span className="text-[11.5px] text-[var(--neutral-soft-400)]">—</span>
          )}
        </td>
        <td className="px-4 py-2.5">
          <span className="inline-flex flex-wrap items-center gap-1">
            {signals.slice(0, 3).map((s) => (
              <code
                key={s}
                className="rounded-[4px] bg-[var(--white-0)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--neutral-sub-600)] ring-1 ring-[var(--stroke-soft-200)]"
              >
                {s}
              </code>
            ))}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-2.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] tabular-nums text-[var(--neutral-sub-600)]">
            {run.blast_radius ?? '—'}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-2.5">
          <span
            className="font-mono text-[11px] font-bold uppercase tracking-[0.06em]"
            style={{ color: decisionColor }}
          >
            {decision || '—'}
          </span>
        </td>
      </tr>
      {expanded && hasContext && (
        <tr className="bg-[var(--neutral-weak-50)]">
          <td colSpan={7} className="px-4 py-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <ContextPanel
                title="SessionContext"
                rows={[
                  ['session_id', run.session_id?.substring(0, 12) ?? '—'],
                  ['push_count', String(run.session_context_snapshot?.push_count ?? 0)],
                  ['denial_count', String(run.session_context_snapshot?.denial_count ?? 0)],
                  ['ci_failure_streak', String(run.session_context_snapshot?.ci_failure_streak ?? 0)],
                  ['sequence_order', String(run.session_context_snapshot?.sequence_order ?? 0)],
                  ['workflow_stage', run.session_context_snapshot?.workflow_stage ?? 'coding'],
                ]}
              />
              <ContextPanel
                title="RepoContext"
                rows={[
                  ['target_branch', run.repo_context_snapshot?.target_branch ?? run.target_branch ?? '—'],
                  ['is_protected_branch', String(run.repo_context_snapshot?.is_protected_branch ?? false)],
                  ['ci_passing', String(run.repo_context_snapshot?.ci_passing ?? true)],
                  ['freeze_window_active', String(run.repo_context_snapshot?.freeze_window_active ?? false)],
                ]}
              />
              <ContextPanel
                title="BranchContext"
                rows={[
                  ['is_aegis_managed', String(run.branch_context_snapshot?.is_aegis_managed ?? false)],
                  ['session_owner_match', String(run.branch_context_snapshot?.session_owner_match ?? true)],
                  ['has_open_pr', String(run.branch_context_snapshot?.has_open_pr ?? false)],
                  ['branch_age_seconds', String(run.branch_context_snapshot?.branch_age_seconds ?? 0)],
                ]}
              />
              <ContextPanel
                title="EnvContext"
                rows={[
                  ['environment_tier', run.env_context_snapshot?.environment_tier ?? 'staging'],
                  ['active_incident', String(run.env_context_snapshot?.active_incident ?? false)],
                  ['within_business_hours', String(run.env_context_snapshot?.within_business_hours ?? true)],
                ]}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--stroke-soft-200)] pt-3 font-mono text-[11px]">
              <span>
                <span className="text-[var(--neutral-soft-400)]">→ semantic_type</span>{' '}
                {run.semantic_type ? (
                  <SemanticTypeChip semantic_type={run.semantic_type} reason={run.blast_radius_reason} />
                ) : <span className="text-[var(--neutral-soft-400)]">—</span>}
              </span>
              <span>
                <span className="text-[var(--neutral-soft-400)]">→ blast_radius</span>{' '}
                <span className="font-bold uppercase tracking-[0.04em] text-[var(--neutral-strong-950)]">
                  {run.blast_radius ?? '—'}
                </span>
              </span>
              <span>
                <span className="text-[var(--neutral-soft-400)]">→ decision</span>{' '}
                <span className="font-bold uppercase tracking-[0.06em]" style={{ color: decisionColor }}>
                  {decision || '—'}
                </span>
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ContextPanel({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div className="rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-3 py-2.5">
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
        {title}
      </p>
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-2 font-mono text-[10.5px]">
            <dt className="text-[var(--neutral-sub-600)]">{k}</dt>
            <dd className="text-right font-semibold text-[var(--neutral-strong-950)] break-all">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
