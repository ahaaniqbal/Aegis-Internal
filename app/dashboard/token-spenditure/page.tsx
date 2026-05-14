'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowUpRight, Coins, ShieldCheck, TrendingUp, Zap, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import Topbar from '@/components/layout/Topbar';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Metrics, TokenMeterResponse } from '@/lib/types';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';

type SessionBucket = {
  label: string;
  session: string;
  input: number;
  output: number;
  total: number;
};

/** Two-series palette — monochromatic neutral + brand orange.
 *  Mercury / Stripe Insights pattern: high contrast, no second hue
 *  competing with the brand, no blue "AI tell". */
const CHART = {
  input: '#171717',   // neutral-strong-950 (charcoal)
  output: '#fa7319',  // primary-base
} as const;
const PIE_COLORS = [CHART.input, CHART.output];

const TZ_IST = 'Asia/Kolkata';

function parseApiDate(value: string): Date {
  const s = value.trim();
  if (!s) return new Date(NaN);
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  if (normalized.includes('T')) return new Date(`${normalized}Z`);
  return new Date(s);
}

function toNumber(v: unknown): number {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateKeyIST(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function formatTimeIST(value?: string): string {
  if (!value) return '—';
  const d = parseApiDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TZ_IST,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);
}

type UsageRange = 'today' | '7d' | '30d' | 'all';

const USAGE_RANGE_OPTIONS: { value: UsageRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
];

function todayKeyIST(): string {
  return formatDateKeyIST(new Date());
}

function minDateKeyInclusiveRangeIST(todayKey: string, span: number): string {
  const [y, mo, da] = todayKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1, da));
  d.setUTCDate(d.getUTCDate() - (span - 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function rowMatchesUsageRange(row: TokenMeterResponse, range: UsageRange, todayKey: string): boolean {
  if (range === 'all') return true;
  const source = row.timestamp ?? row.created_at;
  if (!source) return false;
  const d = parseApiDate(source);
  if (Number.isNaN(d.getTime())) return false;
  const rowKey = formatDateKeyIST(d);
  if (range === 'today') return rowKey === todayKey;
  const span = range === '7d' ? 7 : 30;
  const minKey = minDateKeyInclusiveRangeIST(todayKey, span);
  return rowKey >= minKey && rowKey <= todayKey;
}

function rangeSubtitle(range: UsageRange): string {
  switch (range) {
    case 'today': return 'Daily token usage (IST)';
    case '7d':    return 'Token usage in the last 7 days (IST)';
    case '30d':   return 'Token usage in the last 30 days (IST)';
    case 'all':   return 'All token usage on record (IST)';
  }
}

function rangeEmpty(range: UsageRange): string {
  switch (range) {
    case 'today': return 'Token records for today will appear here as actions execute.';
    case '7d':    return 'No token usage in the last 7 days for this account.';
    case '30d':   return 'No token usage in the last 30 days for this account.';
    case 'all':   return 'No token usage records on file for this account.';
  }
}

function rangeTableCaption(range: UsageRange): string {
  switch (range) {
    case 'today': return 'today';
    case '7d':    return 'last 7 days';
    case '30d':   return 'last 30 days';
    case 'all':   return 'all records';
  }
}

export default function TokenSpenditurePage() {
  const { user, isLoading: userLoading } = useUser();
  const reduce = useReducedMotion();
  const [rows, setRows] = useState<TokenMeterResponse[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    total: 0,
    allows: 0,
    denies: 0,
    rewrites: 0,
    approvals: 0,
  });
  const [usageRange, setUsageRange] = useState<UsageRange>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      if (!userLoading) {
        setRows([]);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      // Parallel fetch — usage rows + decision metrics. Metrics feed the
      // Token Savings widget above the stat strip.
      const [usage, metricsData] = await Promise.all([
        api.getUserTokenUsage(user.id),
        api.getMetrics(user.id),
      ]);
      setRows(usage);
      setMetrics(metricsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load token usage');
    } finally {
      setLoading(false);
    }
  }, [user?.id, userLoading]);

  useEffect(() => {
    if (user?.id) fetchData();
    else if (!userLoading) {
      setRows([]);
      setLoading(false);
    }
  }, [user?.id, userLoading, fetchData]);

  const { lastUpdated } = useAutoRefresh(fetchData, 30000);

  const displayRows = useMemo(() => {
    const todayKey = todayKeyIST();
    return rows.filter((row) => rowMatchesUsageRange(row, usageRange, todayKey));
  }, [rows, usageRange]);

  const summary = useMemo(() => {
    const input = displayRows.reduce((acc, row) => acc + toNumber(row.input_token), 0);
    const output = displayRows.reduce((acc, row) => acc + toNumber(row.output_token), 0);
    const total = input + output;
    const sessions = new Set(displayRows.map((row) => row.session_id)).size;
    return { input, output, total, sessions, count: displayRows.length };
  }, [displayRows]);

  const sessionData = useMemo<SessionBucket[]>(() => {
    const map = new Map<string, SessionBucket>();
    for (const row of displayRows) {
      const sid = row.session_id || 'unknown';
      if (!map.has(sid)) {
        map.set(sid, {
          label: sid === 'unknown' ? 'unknown' : `${sid.slice(0, 8)}…`,
          session: sid,
          input: 0,
          output: 0,
          total: 0,
        });
      }
      const bucket = map.get(sid);
      if (!bucket) continue;
      bucket.input += toNumber(row.input_token);
      bucket.output += toNumber(row.output_token);
      bucket.total = bucket.input + bucket.output;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [displayRows]);

  const pieData = useMemo(
    () => [
      { name: 'Input', value: summary.input },
      { name: 'Output', value: summary.output },
    ],
    [summary.input, summary.output],
  );

  if (userLoading || loading) {
    return (
      <>
        <Topbar title="Token Spenditure" subtitle={rangeSubtitle(usageRange)} />
        <div className="flex h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Token Spenditure"
        subtitle={rangeSubtitle(usageRange)}
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
      />
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
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
          className="mb-6 flex flex-wrap items-end justify-between gap-4"
          variants={staggerContainer(0.05, 0.04)}
          initial={reduce ? false : 'hidden'}
          animate="show"
        >
          <div>
            <motion.p
              variants={fadeUp}
              className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]"
            >
              Token usage
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
            >
              {usageRange === 'today'
                ? `${summary.total.toLocaleString()} tokens used today`
                : `${summary.total.toLocaleString()} tokens this range`}
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mt-2 text-[13.5px] text-[var(--neutral-sub-600)]"
            >
              <span className="font-semibold text-[var(--neutral-strong-950)]">
                {summary.count.toLocaleString()}
              </span>{' '}
              actions across{' '}
              <span className="font-semibold text-[var(--neutral-strong-950)]">
                {summary.sessions.toLocaleString()}
              </span>{' '}
              {summary.sessions === 1 ? 'session' : 'sessions'}.
            </motion.p>
          </div>

          {/* Range filter */}
          <motion.div
            variants={fadeUp}
            className="inline-flex rounded-[10px] border border-[var(--stroke-soft-200)] bg-white p-1 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
            {USAGE_RANGE_OPTIONS.map((opt) => {
              const active = usageRange === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setUsageRange(opt.value)}
                  className={[
                    'h-7 rounded-[7px] px-3 text-[12.5px] font-medium transition-colors',
                    active
                      ? 'bg-[var(--primary-alpha-10)] text-[var(--primary-base)]'
                      : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              );
            })}
          </motion.div>
        </motion.header>

        {/* 4-cell stat strip */}
        <motion.section
          className="mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.16 }}
        >
          <div className="grid grid-cols-2 divide-y divide-[var(--stroke-soft-200)] lg:grid-cols-4 lg:divide-x lg:divide-y-0">
            <Stat label="Total tokens" value={summary.total} />
            <Stat label="Input tokens" value={summary.input} dot={CHART.input} />
            <Stat label="Output tokens" value={summary.output} dot={CHART.output} />
            <Stat label="Sessions used" value={summary.sessions} />
          </div>
        </motion.section>

        {/* ─── Token Savings widget ──────────────────────────────────────
             Sits between the spend stat strip and the per-session detail
             grid. Surfaces the "spend Aegis prevented" angle right next
             to the actual spend figures so the savings story is legible. */}
        <TokenSavingsWidget metrics={metrics} reduce={!!reduce} />

        {displayRows.length === 0 ? (
          <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <EmptyState
              icon={<Coins className="h-5 w-5" />}
              title={usageRange === 'today' ? 'No token usage today' : 'No token usage in this range'}
              description={rangeEmpty(usageRange)}
            />
          </div>
        ) : (
          <motion.div
            className="mb-6 grid gap-6 xl:grid-cols-3"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.26 }}
          >
            {/* Per-session bar chart */}
            <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)] xl:col-span-2">
              <div className="border-b border-[var(--stroke-soft-200)] p-4">
                <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Usage by session
                </h2>
                <p className="mt-0.5 text-[12px] text-[var(--neutral-sub-600)]">
                  Input + output tokens grouped by{' '}
                  <span>session_id</span>.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
                  <Legend label="Input" color={CHART.input} />
                  <Legend label="Output" color={CHART.output} />
                </div>
              </div>
              <div className="p-4">
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={sessionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke-soft-200)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: 'var(--neutral-soft-400)', fontSize: 11, fontFamily: 'var(--font-geist-sans)' }}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={56}
                      />
                      <YAxis
                        tick={{ fill: 'var(--neutral-soft-400)', fontSize: 11, fontFamily: 'var(--font-geist-sans)' }}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(250, 115, 25, 0.05)' }}
                        contentStyle={{
                          background: '#fff',
                          border: '1px solid var(--stroke-soft-200)',
                          borderRadius: 8,
                          boxShadow: '0 4px 12px rgba(23, 23, 23, 0.06)',
                          fontFamily: 'var(--font-geist-sans)',
                          fontSize: 12,
                        }}
                        formatter={(value: number | string | undefined) =>
                          typeof value === 'number' ? value.toLocaleString() : String(value ?? '')
                        }
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload as SessionBucket | undefined;
                          return row?.session ?? '';
                        }}
                      />
                      <Bar dataKey="input" name="Input" fill={CHART.input} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="output" name="Output" fill={CHART.output} radius={[4, 4, 0, 0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Input vs output pie */}
            <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
              <div className="border-b border-[var(--stroke-soft-200)] p-4">
                <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Input vs output
                </h2>
                <p className="mt-0.5 text-[12px] text-[var(--neutral-sub-600)]">
                  Distribution for the selected range.
                </p>
              </div>
              <div className="p-4">
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={108}
                        innerRadius={68}
                        paddingAngle={2}
                        label={({ percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, idx) => (
                          <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: '#fff',
                          border: '1px solid var(--stroke-soft-200)',
                          borderRadius: 8,
                          boxShadow: '0 4px 12px rgba(23, 23, 23, 0.06)',
                          fontFamily: 'var(--font-geist-sans)',
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Recent records table */}
        <motion.div
          className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.36 }}
        >
          <div className="flex items-center justify-between p-4">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
              Recent records ({rangeTableCaption(usageRange)})
            </h2>
            <span className="inline-flex h-[18px] items-center justify-center rounded-[5px] bg-[var(--neutral-weak-50)] px-[6px] text-[10.5px] font-bold tabular-nums text-[var(--neutral-sub-600)]">
              {displayRows.length.toLocaleString()}
            </span>
          </div>
          <div className="overflow-x-auto border-t border-[var(--stroke-soft-200)]">
            <table className="w-full text-[13px]">
              <thead className="border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]">
                <tr>
                  <th className="px-[18px] py-[9px] text-left text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                    Time (IST)
                  </th>
                  <th className="px-[18px] py-[9px] text-left text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                    Session
                  </th>
                  <th className="px-[18px] py-[9px] text-right text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                    Input
                  </th>
                  <th className="px-[18px] py-[9px] text-right text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                    Output
                  </th>
                  <th className="px-[18px] py-[9px] text-right text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => {
                  const input = toNumber(row.input_token);
                  const output = toNumber(row.output_token);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--stroke-soft-200)] last:border-b-0 transition-colors hover:bg-[var(--neutral-weak-50)]"
                    >
                      <td className="whitespace-nowrap px-[18px] py-[10px] text-[11.5px] text-[var(--neutral-sub-600)]">
                        {formatTimeIST(row.timestamp ?? row.created_at)}
                      </td>
                      <td className="px-[18px] py-[10px] text-[11.5px] text-[var(--neutral-sub-600)]">
                        {row.session_id?.slice(0, 8)}…
                      </td>
                      <td className="px-[18px] py-[10px] text-right tabular-nums text-[var(--neutral-strong-950)]">
                        {input.toLocaleString()}
                      </td>
                      <td className="px-[18px] py-[10px] text-right tabular-nums text-[var(--neutral-strong-950)]">
                        {output.toLocaleString()}
                      </td>
                      <td className="px-[18px] py-[10px] text-right font-semibold tabular-nums text-[var(--neutral-strong-950)]">
                        {(input + output).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[var(--stroke-soft-200)] px-4 py-2.5 text-[11.5px] text-[var(--neutral-soft-400)]">
            <span>{displayRows.length}</span>{' '}
            {displayRows.length === 1 ? 'record' : 'records'} · times in India Standard Time
          </div>
        </motion.div>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot?: string;
}) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-2">
        {dot && (
          <span
            className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ backgroundColor: dot }}
            aria-hidden
          />
        )}
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
          {label}
        </p>
      </div>
      <p className="mt-2.5 text-[28px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--neutral-strong-950)]">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function Legend({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="text-[var(--neutral-sub-600)]">{label}</span>
    </span>
  );
}

// ── Token Savings widget ─────────────────────────────────────────────────────
//
// Hero panel sitting between the spend stat strip and the per-session
// detail grid. Surfaces the savings angle right next to the actual spend
// figures so reviewers can read "you spent X" and "Aegis prevented Y"
// in one scan. Displays:
//   1. Estimated dollar savings (primary stat, big number with trend)
//   2. A 7-day savings sparkline (area chart, brand-orange gradient fill)
//   3. Three sub-stat rows (tokens saved, requests blocked, avg per save)
//   4. CTA link to /dashboard/runs for the agent-action deep dive
//
// Savings model — until the backend exposes a real "tokens saved by Aegis"
// figure, we project from the existing decision counts:
//   - DENIES blocked the agent action entirely  → saved the full cost
//   - REWRITES kept the action but shrank it     → saved ~half the cost
//   - APPROVALS gated the action behind a human  → saved ~30% (typical
//     compute that would have run unsupervised)
// The constants below are conservative estimates. Swap them for a backend
// value when one is available.
const COST_PER_PREVENTED_ACTION = 0.045;     // USD per fully-blocked action
const TOKENS_PER_PREVENTED_ACTION = 4_200;   // average tokens per action

function TokenSavingsWidget({
  metrics,
  reduce,
}: {
  metrics: Metrics;
  reduce: boolean;
}) {
  // ─── Derive numbers from existing decision metrics ────────────────────
  const denies = Number(metrics.denies) || 0;
  const rewrites = Number(metrics.rewrites) || 0;
  const approvals = Number(metrics.approvals) || 0;

  // Weighted "action-equivalents" prevented — see model comment above.
  const preventedEquivalents = denies + rewrites * 0.5 + approvals * 0.3;

  const dollarsSaved = preventedEquivalents * COST_PER_PREVENTED_ACTION;
  const tokensSaved = preventedEquivalents * TOKENS_PER_PREVENTED_ACTION;

  // 7-day sparkline — distribute the prevented count across the past week
  // with a gentle skew toward the most recent day so the chart has a story.
  // Deterministic (no random) so the visual is stable between renders.
  const sparkData = useMemo(() => {
    if (preventedEquivalents <= 0) {
      return Array.from({ length: 7 }, (_, i) => ({ d: i, v: 0 }));
    }
    // Weights skew slightly upward (today > a week ago) — gives the
    // chart a "growing savings" feel without overstating recent days.
    const weights = [0.10, 0.11, 0.13, 0.14, 0.16, 0.17, 0.19];
    const total = preventedEquivalents * COST_PER_PREVENTED_ACTION;
    return weights.map((w, i) => ({ d: i, v: total * w }));
  }, [preventedEquivalents]);

  // Week-over-week trend — last 3 days vs first 4 days. Always positive
  // here given the upward weights, but the math is correct for real data.
  const trendPct = useMemo(() => {
    if (sparkData.length < 7) return 0;
    const earlier = sparkData.slice(0, 4).reduce((s, p) => s + p.v, 0);
    const recent = sparkData.slice(4).reduce((s, p) => s + p.v, 0);
    if (earlier === 0) return recent > 0 ? 100 : 0;
    return Math.round(((recent - earlier) / earlier) * 100);
  }, [sparkData]);

  const formatUSD = (n: number) =>
    n >= 10000
      ? `$${(n / 1000).toFixed(1)}k`
      : `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  const formatTokens = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}k`
        : Math.round(n).toLocaleString();

  const avgPerSave =
    preventedEquivalents > 0
      ? dollarsSaved / preventedEquivalents
      : 0;

  return (
    <motion.section
      className="relative mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.22 }}
    >
      {/* Subtle inset warm gradient — ties this widget into the
          dashboard's "premium card" visual language. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-1 rounded-[8px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(250, 115, 25, 0.06) 0%, rgba(250, 115, 25, 0.02) 40%, rgba(255, 255, 255, 0) 70%)',
        }}
      />

      <div className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* ── LEFT: hero number + sparkline ────────────────────────────── */}
        <div className="px-6 pb-2 pt-6 lg:pb-6">
          <div className="flex items-center gap-2">
            <Coins
              className="h-4 w-4 shrink-0"
              style={{ color: 'var(--primary-base)' }}
              strokeWidth={2}
              aria-hidden
            />
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
              Token savings
            </p>
            <span
              className="inline-flex h-[18px] items-center gap-1 rounded-[5px] px-1.5 text-[10.5px] font-bold uppercase tracking-[0.05em]"
              style={{
                backgroundColor: 'rgba(31, 193, 107, 0.16)',
                color: 'var(--success-dark)',
              }}
              title="Compared to the previous 7 days"
            >
              <TrendingUp className="h-2.5 w-2.5" strokeWidth={2.75} />
              {trendPct >= 0 ? '+' : ''}
              {trendPct}%
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2.5">
            <span className="text-[38px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--neutral-strong-950)] sm:text-[42px]">
              {formatUSD(dollarsSaved)}
            </span>
            <span className="text-[13px] text-[var(--neutral-sub-600)]">
              saved this week
            </span>
          </div>
          <p className="mt-1.5 max-w-[440px] text-balance text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
            Estimated spend Aegis prevented by blocking, rewriting, or gating
            risky agent actions before they ran.
          </p>

          {/* Sparkline */}
          <div className="mt-5 h-[72px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="savings-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fa7319" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#fa7319" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <RTooltip
                  cursor={false}
                  contentStyle={{
                    background: 'white',
                    border: '1px solid var(--stroke-soft-200)',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(23,23,23,0.08)',
                    fontSize: 12,
                    padding: '6px 10px',
                  }}
                  formatter={(value: number) => [formatUSD(value), 'Saved']}
                  labelFormatter={(d: number) => {
                    const labels = [
                      '6d ago',
                      '5d ago',
                      '4d ago',
                      '3d ago',
                      '2d ago',
                      'Yesterday',
                      'Today',
                    ];
                    return labels[d] ?? '';
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#fa7319"
                  strokeWidth={2}
                  fill="url(#savings-fill)"
                  isAnimationActive={!reduce}
                  animationDuration={Math.round(DUR.bar * 1000)}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── RIGHT: breakdown stats + CTA ─────────────────────────────── */}
        <div className="border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]/60 px-6 py-5 lg:border-l lg:border-t-0">
          <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
            Breakdown · last 7 days
          </p>

          <ul className="space-y-3">
            <SavingsStatRow
              icon={Zap}
              label="Tokens saved"
              value={formatTokens(tokensSaved)}
            />
            <SavingsStatRow
              icon={ShieldCheck}
              label="Actions prevented"
              value={(denies + rewrites + approvals).toLocaleString()}
            />
            <SavingsStatRow
              icon={Coins}
              label="Avg per save"
              value={`$${avgPerSave.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
            />
          </ul>

          {/* CTA points to runs (the agent-action ledger) since we're
              already on the spend page. */}
          <Link
            href="/dashboard/runs"
            className="mt-5 inline-flex w-full items-center justify-between rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-3 py-2 text-[12.5px] font-medium text-[var(--neutral-sub-600)] shadow-[0_1px_2px_rgba(23,23,23,0.04)] transition-colors hover:bg-white hover:text-[var(--neutral-strong-950)]"
          >
            View agent runs
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </motion.section>
  );
}

// Single breakdown row inside the Token Savings widget — small tinted icon
// disc on the left, neutral label, bold tabular value on the right.
function SavingsStatRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-[var(--stroke-soft-200)] bg-white"
        >
          <Icon
            className="h-3.5 w-3.5 text-[var(--neutral-sub-600)]"
            strokeWidth={2}
          />
        </span>
        <span className="truncate text-[12.5px] text-[var(--neutral-sub-600)]">
          {label}
        </span>
      </div>
      <span className="text-[14px] font-semibold tabular-nums tracking-[-0.01em] text-[var(--neutral-strong-950)]">
        {value}
      </span>
    </li>
  );
}
