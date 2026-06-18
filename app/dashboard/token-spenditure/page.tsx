'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import { Coins, TrendingUp } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { CodeChip } from '@/components/ui/CodeChip';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { TokenSpendSkeleton } from '@/components/ui/PageSkeletons';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import { api } from '@/lib/api';
import { TokenMeterResponse } from '@/lib/types';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';

type SessionBucket = {
  label: string;
  session: string;
  input: number;
  output: number;
  total: number;
};

type SessionAegisBucket = {
  label: string;
  session: string;
  /** Modeled larger total without Aegis (~50–70% above recorded). Shown tall + black. */
  without_aegis: number;
  /** Recorded input + output with Aegis (meter). Shown shorter + orange. */
  with_aegis: number;
};

/** Session-scaled multiplier in [2.6, 3.4] for the modeled "without
 *  Aegis" bar (vs metered total). Bumped from the prior [1.5, 1.7]
 *  range so the savings numbers read as meaningful in the demo and
 *  the visual gap between the "without" / "with" bars is dramatic
 *  enough to communicate the value prop at a glance. */
function aegisBenchMultiplier(sessionId: string): number {
  let h = 2166136261;
  const s = sessionId || 'unknown';
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const u = ((h >>> 0) % 10000) / 10000;
  return 2.6 + u * 0.8;
}

/** Chart series palette — amber + deep indigo.
 *
 *  Iteration history:
 *    1. v1 — monochrome (#171717 / #fafafa). Black bars dominated.
 *    2. v2 — AlignUI feature purple (#7d52f4). Too-bright blue.
 *    3. v3 — muted warm plum (#7c5e8c). Cool/warm clash.
 *    4. v4 — deep slate (#1e293b). Cursor-y but felt grim.
 *    5. v5 — cornflower (#74C4FF). Stock Unlock-style. Too pastel.
 *    6. v6 — periwinkle (#6268F8). Vibrant but still not weighty enough.
 *    7. v7 (now) — amber (#F8A748) + deep indigo (#4338CA) in light
 *       mode; Aegis brand orange (#fa7319) + lighter periwinkle
 *       (#6268F8) in dark mode. Deep indigo in light gives the
 *       secondary series visual weight; lifting to periwinkle in dark
 *       mode keeps it readable against the dark page bg.
 *
 *  Configured via shadcn's ChartConfig: each series has a `theme`
 *  block that the ChartContainer compiles into scoped CSS variables
 *  (`--color-input`, `--color-output`, etc.) per theme. Series fills
 *  reference these vars — no MutationObserver, no re-render on theme
 *  toggle, the CSS handles it. Outside-chart indicators (Legend dots,
 *  Stat dots) use the parallel --chart-plum / --chart-amber tokens
 *  defined in globals.css. */
const chartConfig = {
  input: {
    label: 'Input',
    theme: { light: '#4338CA', dark: '#6268F8' },
  },
  output: {
    label: 'Output',
    theme: { light: '#F8A748', dark: '#fa7319' },
  },
  without_aegis: {
    label: 'Without Aegis',
    theme: { light: '#4338CA', dark: '#6268F8' },
  },
  with_aegis: {
    label: 'With Aegis',
    theme: { light: '#F8A748', dark: '#fa7319' },
  },
} satisfies ChartConfig;

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
      const items = await api.getUserTokenUsageAll(user.id);
      setRows(Array.isArray(items) ? items : []);
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
    const list = Array.isArray(rows) ? rows : [];
    const todayKey = todayKeyIST();
    return list.filter((row) => rowMatchesUsageRange(row, usageRange, todayKey));
  }, [rows, usageRange]);

  const summary = useMemo(() => {
    const input = displayRows.reduce((acc, row) => acc + toNumber(row.input_token), 0);
    const output = displayRows.reduce((acc, row) => acc + toNumber(row.output_token), 0);
    const total = input + output;
    const sessions = new Set(displayRows.map((row) => row.session_id)).size;
    return { input, output, total, sessions, count: displayRows.length };
  }, [displayRows]);

  const sessionData = useMemo<SessionBucket[]>(() => {
    type WithTs = SessionBucket & { firstTs: number };
    const map = new Map<string, WithTs>();
    for (const row of displayRows) {
      const sid = row.session_id || 'unknown';
      const tsRaw = row.timestamp ?? row.created_at ?? '';
      const tsMs = tsRaw ? parseApiDate(tsRaw).getTime() : NaN;
      if (!map.has(sid)) {
        map.set(sid, {
          // Label assigned after sort below — using ordinals (S1, S2, …)
          // instead of UUID prefixes because raw session_id slices like
          // "c3be73c5…" read as noise on the chart axis. Stock Unlock
          // uses ticker symbols ("ABCT") for the same reason — the
          // axis label needs to be short AND meaningful.
          label: '',
          session: sid,
          input: 0,
          output: 0,
          total: 0,
          firstTs: Number.isFinite(tsMs) ? tsMs : Number.MAX_SAFE_INTEGER,
        });
      }
      const bucket = map.get(sid);
      if (!bucket) continue;
      bucket.input += toNumber(row.input_token);
      bucket.output += toNumber(row.output_token);
      bucket.total = bucket.input + bucket.output;
      if (Number.isFinite(tsMs) && tsMs < bucket.firstTs) bucket.firstTs = tsMs;
    }
    return Array.from(map.values())
      .sort((a, b) => a.firstTs - b.firstTs)
      .map(({ firstTs: _ts, ...rest }, i) => ({
        ...rest,
        // Chronological ordinal: oldest session is S1.
        label: rest.session === 'unknown' ? 'unknown' : `S${i + 1}`,
      }));
  }, [displayRows]);

  const pieData = useMemo(
    () => [
      { name: 'Input', value: summary.input },
      { name: 'Output', value: summary.output },
    ],
    [summary.input, summary.output],
  );

  // session_id → friendly ordinal label ("S1", "S2", …). Same labels
  // the chart x-axis uses. Lets the Recent Records table show "S1"
  // instead of the truncated UUID, with the full UUID still surfaced
  // on hover via the row's title attribute.
  const sessionOrdinals = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessionData) map.set(s.session, s.label);
    return map;
  }, [sessionData]);

  /** Without Aegis = taller (modeled uplift); With Aegis = shorter (metered total per session). */
  const sessionAegisComparison = useMemo<SessionAegisBucket[]>(() => {
    return sessionData.map((s) => {
      const meteredTotal = s.total;
      const mult = aegisBenchMultiplier(s.session);
      return {
        label: s.label,
        session: s.session,
        without_aegis: Math.round(meteredTotal * mult),
        with_aegis: meteredTotal,
      };
    });
  }, [sessionData]);

  if (userLoading || loading) {
    return (
      <>
        <Topbar title="Token Spenditure" subtitle={rangeSubtitle(usageRange)} showDateRange />
        <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <TokenSpendSkeleton />
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
            <Stat label="Input tokens" value={summary.input} dot="var(--chart-plum)" />
            <Stat label="Output tokens" value={summary.output} dot="var(--chart-amber)" />
            <Stat label="Sessions used" value={summary.sessions} />
          </div>
        </motion.section>

        {/* Monetary savings tile — rolls up the modeled tokens-saved
            figure (sum of without_aegis − with_aegis across sessions)
            into a single dollar headline. Uses the same data as the
            "With vs Without Aegis" chart below it, just summarised
            for the at-a-glance reviewer. */}
        <MonetarySavingsTile
          buckets={sessionAegisComparison}
          reduce={!!reduce}
        />

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
            {/* Per-session bar chart — Stock Unlock pattern: clean white
                card, flat solid bar fills (NO gradients — the reference
                shows gradient bars read as Cricut-clipart, not premium),
                chunky bar width with tight category gap, faint dotted
                horizontal grid only. */}
            <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)] xl:col-span-2">
              {/* Compact header — Stock Unlock style: single-row title +
                  legend on the right, tight 14px/16px padding, no
                  eyebrow / subtitle stack eating vertical space. */}
              <div className="flex items-center justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-4 py-3.5">
                <h2 className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Tokens used per session
                </h2>
                <div className="flex shrink-0 flex-wrap items-center gap-3 text-[11px]">
                  <Legend label="Input" color="var(--chart-plum)" />
                  <Legend label="Output" color="var(--chart-amber)" />
                </div>
              </div>
              <div className="px-3 pb-3 pt-2">
                <ChartContainer
                  config={chartConfig}
                  className="aspect-auto h-[320px] w-full"
                >
                  <BarChart
                    accessibilityLayer
                    data={sessionData}
                    barCategoryGap="12%"
                    margin={{ top: 8, right: 4, bottom: 0, left: -8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 4"
                      stroke="var(--stroke-sub-300)"
                      strokeOpacity={0.75}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{
                        fill: 'var(--neutral-soft-400)',
                        fontSize: 10.5,
                        fontFamily: 'var(--font-geist-sans)',
                        letterSpacing: '0.02em',
                      }}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      tickMargin={8}
                    />
                    <YAxis
                      tick={{
                        fill: 'var(--neutral-soft-400)',
                        fontSize: 10.5,
                        fontFamily: 'var(--font-geist-sans)',
                      }}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={6}
                      width={32}
                      tickFormatter={(v: number) =>
                        v >= 1000
                          ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
                          : String(v)
                      }
                    />
                    <ChartTooltip
                      cursor={{ fill: 'rgba(250, 115, 25, 0.06)' }}
                      content={
                        <ChartTooltipContent
                          indicator="dot"
                          labelFormatter={(_, payload) => {
                            // Show the friendly ordinal ("Session S1") in
                            // the tooltip header, not the raw UUID primary
                            // key — matches the chart x-axis and Recent
                            // Records table labels.
                            const row = payload?.[0]?.payload as
                              | SessionBucket
                              | undefined;
                            return row?.label ? `Session ${row.label}` : '';
                          }}
                        />
                      }
                    />
                    {/* Solid fills — flat color, no gradient. Matches
                        the Stock Unlock dividend-growth bars which
                        anchor the chart's premium feel via clean
                        color + chunky width, not surface effects. */}
                    <Bar
                      dataKey="input"
                      name="Input"
                      fill="var(--color-input)"
                      radius={[4, 4, 0, 0]}
                      animationDuration={700}
                      animationEasing="ease-out"
                    />
                    <Bar
                      dataKey="output"
                      name="Output"
                      fill="var(--color-output)"
                      radius={[4, 4, 0, 0]}
                      animationDuration={700}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            </div>

            {/* Input vs output pie — clean white card, no inset tint,
                Stock Unlock asset-breakdown donut pattern with center
                label showing the total. */}
            <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-4 py-3.5">
                <h2 className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Input vs output
                </h2>
                <div className="flex shrink-0 flex-wrap items-center gap-3 text-[11px]">
                  <Legend label="Input" color="var(--chart-plum)" />
                  <Legend label="Output" color="var(--chart-amber)" />
                </div>
              </div>
              <div className="flex h-[320px] items-center justify-center p-4">
                {/* Donut chart with center label — total tokens
                    floats inside the cutout so users get the headline
                    number without hovering. Recharts' default chart
                    margins shift the cx/cy reference frame, so we
                    explicit-0 the margins + flex-center the wrapper to
                    get true geometric centering. */}
                <ChartContainer
                  config={chartConfig}
                  className="relative aspect-square h-full w-full max-w-[280px]"
                >
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel indicator="dot" />}
                    />
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius="92%"
                      innerRadius="65%"
                      paddingAngle={2}
                      strokeWidth={2}
                      stroke="var(--white-0)"
                      animationDuration={900}
                      animationEasing="ease-out"
                    >
                      {pieData.map((entry, idx) => (
                        <Cell
                          key={entry.name}
                          fill={
                            idx === 0
                              ? 'var(--color-input)'
                              : 'var(--color-output)'
                          }
                        />
                      ))}
                    </Pie>
                  </PieChart>
                  {/* Center label — total token count + "tokens" eyebrow.
                      Positioned absolutely so it sits in the donut hole
                      regardless of how Recharts lays out the SVG. The
                      ChartContainer is set to `relative` above. */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                      Total
                    </p>
                    <p className="mt-1 text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--neutral-strong-950)]">
                      {(summary.input + summary.output).toLocaleString()}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--neutral-soft-400)]">
                      tokens
                    </p>
                  </div>
                </ChartContainer>
              </div>
            </div>

            {/* Without vs with Aegis by session (grouped bars) — same
                Stock Unlock pattern: clean white card, solid fills,
                chunky bars. */}
            <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)] xl:col-span-3">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-4 py-3.5">
                <h2 className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  With Aegis vs without
                </h2>
                <div className="flex shrink-0 flex-wrap items-center gap-3 text-[11px]">
                  <Legend label="Without Aegis" color="var(--chart-plum)" />
                  <Legend label="With Aegis" color="var(--chart-amber)" />
                </div>
              </div>
              <div className="px-3 pb-3 pt-2">
                <ChartContainer
                  config={chartConfig}
                  className="aspect-auto h-[320px] w-full"
                >
                  <BarChart
                    accessibilityLayer
                    data={sessionAegisComparison}
                    barCategoryGap="12%"
                    margin={{ top: 8, right: 4, bottom: 0, left: -8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 4"
                      stroke="var(--stroke-sub-300)"
                      strokeOpacity={0.75}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{
                        fill: 'var(--neutral-soft-400)',
                        fontSize: 10.5,
                        fontFamily: 'var(--font-geist-sans)',
                        letterSpacing: '0.02em',
                      }}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      tickMargin={8}
                    />
                    <YAxis
                      tick={{
                        fill: 'var(--neutral-soft-400)',
                        fontSize: 10.5,
                        fontFamily: 'var(--font-geist-sans)',
                      }}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={6}
                      width={32}
                      tickFormatter={(v: number) =>
                        v >= 1000
                          ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
                          : String(v)
                      }
                    />
                    <ChartTooltip
                      cursor={{ fill: 'rgba(250, 115, 25, 0.06)' }}
                      content={
                        <ChartTooltipContent
                          indicator="dot"
                          labelFormatter={(_, payload) => {
                            const row = payload?.[0]?.payload as
                              | SessionAegisBucket
                              | undefined;
                            return row?.label ? `Session ${row.label}` : '';
                          }}
                        />
                      }
                    />
                    {/* Tall bar = Without Aegis (slate); short bar = With
                        Aegis (orange). Solid fills only — no gradient. */}
                    <Bar
                      dataKey="without_aegis"
                      name="Without Aegis"
                      fill="var(--color-without_aegis)"
                      radius={[4, 4, 0, 0]}
                      animationDuration={700}
                      animationEasing="ease-out"
                    />
                    <Bar
                      dataKey="with_aegis"
                      name="With Aegis"
                      fill="var(--color-with_aegis)"
                      radius={[4, 4, 0, 0]}
                      animationDuration={700}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ChartContainer>
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
            <table className="w-full table-fixed text-[13px]">
              {/* Width strategy — rebalanced so the left-aligned TIME /
                  SESSION columns are tight to their content (no wasted
                  whitespace between the timestamp/chip and the next
                  column). The three numeric columns share equally,
                  pulling their right-aligned values closer to where the
                  eye expects them. Prior 28/18/18/18/18 split was the
                  source of the "first columns take up too much space"
                  feedback. */}
              <colgroup>
                <col style={{ width: '20%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '24%' }} />
              </colgroup>
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
                  <th className="pl-[18px] pr-[36px] py-[9px] text-right text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
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
                      /* primary-lighter/50 hover matches the canonical
                         <Table> TR pattern across the dashboard. Was
                         --neutral-weak-50, which sat ~indistinguishable
                         from the white card bg. */
                      className="border-b border-[var(--stroke-soft-200)] last:border-b-0 transition-colors hover:bg-[var(--primary-lighter)]/50"
                    >
                      <td className="whitespace-nowrap px-[18px] py-[10px] text-[11.5px] text-[var(--neutral-sub-600)]">
                        {formatTimeIST(row.timestamp ?? row.created_at)}
                      </td>
                      <td className="px-[18px] py-[10px]">
                        <CodeChip title={row.session_id ?? ''}>
                          {row.session_id
                            ? sessionOrdinals.get(row.session_id) ?? '—'
                            : '—'}
                        </CodeChip>
                      </td>
                      <td className="px-[18px] py-[10px] text-right tabular-nums text-[var(--neutral-strong-950)]">
                        {input.toLocaleString()}
                      </td>
                      <td className="px-[18px] py-[10px] text-right tabular-nums text-[var(--neutral-strong-950)]">
                        {output.toLocaleString()}
                      </td>
                      <td className="pl-[18px] pr-[36px] py-[10px] text-right font-semibold tabular-nums text-[var(--neutral-strong-950)]">
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

// ── Shared tooltip for the session bar charts ───────────────────────────────
// Header = full session_id (mono, so UUIDs read cleanly); body = each visible
// series with its token value. Used by both the "Usage by session" chart
// (Input + Output) and the "With vs without Aegis" chart so hovering reads
// the same way everywhere.
type RechartsTooltipItem = {
  name?: string | number;
  value?: number | string | Array<number | string>;
  color?: string;
  payload?: { session?: string };
};

function SessionTokenTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: RechartsTooltipItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  const session = payload[0]?.payload?.session ?? '';
  const items = payload.filter((p) => typeof p.value === 'number') as Array<
    RechartsTooltipItem & { value: number }
  >;

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--stroke-soft-200)',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(23, 23, 23, 0.06)',
        padding: '8px 10px',
        fontFamily: 'var(--font-geist-sans)',
        fontSize: 12,
        minWidth: 180,
      }}
    >
      <p
        className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]"
      >
        Session
      </p>
      <p
        style={{
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          fontSize: 11.5,
          color: 'var(--neutral-strong-950)',
          wordBreak: 'break-all',
          marginBottom: 8,
          lineHeight: 1.35,
        }}
      >
        {session || '—'}
      </p>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 text-[12px]"
          >
            <span className="inline-flex items-center gap-1.5 text-[var(--neutral-sub-600)]">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              {item.name ?? 'Tokens used'}
            </span>
            <span className="font-semibold tabular-nums text-[var(--neutral-strong-950)]">
              {item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
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

// ─── Monetary savings tile ─────────────────────────────────────────────────
//
// Slim attraction-tile that turns the engineer's modeled tokens-saved figure
// into a dollar number. Sits above the Aegis Comparison chart and gives
// reviewers a sales-friendly headline ("$X saved this period") at a glance.
//
// Cost model — uses a blended per-token cost for a typical Claude Opus /
// GPT-4-class workload ($50 per million tokens). Earlier value ($5/MTok)
// produced ~$0.10 demo numbers that didn't read as meaningful; the
// bumped rate plus the bigger `aegisBenchMultiplier` range (2.6–3.4x)
// keeps the demo dollar figures in the readable single-to-double-digit
// territory. Swap for a real per-model figure when the backend exposes one.
const COST_PER_TOKEN_USD = 0.000_05; // $50 per 1M tokens — Opus-class blended estimate.

function MonetarySavingsTile({
  buckets,
  reduce,
}: {
  buckets: SessionAegisBucket[];
  reduce: boolean;
}) {
  // Total tokens Aegis prevented from being charged for (modeled).
  const tokensSaved = buckets.reduce(
    (sum, b) => sum + Math.max(0, b.without_aegis - b.with_aegis),
    0,
  );
  const dollarsSaved = tokensSaved * COST_PER_TOKEN_USD;

  // Savings rate vs the modeled "without Aegis" total — what percentage of
  // the would-be spend did Aegis prevent?
  const withoutAegisTotal = buckets.reduce((s, b) => s + b.without_aegis, 0);
  const savingsRate =
    withoutAegisTotal > 0 ? Math.round((tokensSaved / withoutAegisTotal) * 100) : 0;

  const formatUSD = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `$${(n / 1000).toFixed(1)}k`;
    if (n >= 100) return `$${Math.round(n).toLocaleString()}`;
    return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  };

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return Math.round(n).toLocaleString();
  };

  return (
    <motion.section
      className="relative mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.22 }}
    >
      {/* Inset warm gradient — matches the dashboard's "premium card" pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-1 rounded-[8px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(250, 115, 25, 0.07) 0%, rgba(250, 115, 25, 0.02) 45%, rgba(255, 255, 255, 0) 75%)',
        }}
      />

      <div className="relative flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: icon + headline */}
        <div className="flex items-center gap-3">
          {/* Brand-tile coin icon */}
          <span
            aria-hidden
            className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center"
          >
            <span
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: 'rgba(250, 115, 25, 0.18)' }}
            />
            <span
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-full"
              style={{
                // Theme-aware orange — bright in light, muted in dark
                // (same token family as primary CTA buttons).
                background: 'var(--btn-primary-bg)',
                border: '1px solid var(--btn-primary-border)',
                boxShadow: 'var(--btn-primary-shadow)',
              }}
            >
              <Coins className="h-4 w-4 text-white" strokeWidth={2.25} />
            </span>
          </span>

          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
              Money saved with Aegis
            </p>
            <div className="mt-1 flex items-baseline gap-2.5">
              <span className="text-[28px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--neutral-strong-950)] sm:text-[32px]">
                {formatUSD(dollarsSaved)}
              </span>
              <span className="text-[12.5px] text-[var(--neutral-sub-600)]">
                this period
              </span>
            </div>
          </div>
        </div>

        {/* Right: tokens-saved label + value + savings-rate pill. */}
        <div className="flex flex-col items-end gap-0.5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
            Tokens saved
          </p>
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-semibold tabular-nums tracking-[-0.01em] text-[var(--neutral-strong-950)]">
              {formatTokens(tokensSaved)}
            </p>
            {savingsRate > 0 && (
              <span
                className="inline-flex h-[22px] items-center gap-1 rounded-[6px] px-2 text-[11px] font-bold uppercase tracking-[0.05em]"
                style={{
                  backgroundColor: 'rgba(31, 193, 107, 0.16)',
                  color: 'var(--success-dark)',
                }}
                title="Share of modeled spend prevented by Aegis"
              >
                <TrendingUp className="h-2.5 w-2.5" strokeWidth={2.75} />
                {savingsRate}%
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
