'use client';

/**
 * Analytics — `/dashboard/analytics`.
 *
 * Governance analytics surface. What a VP Engineering opens once a week
 * to scan agent behavior across the org: which policies are firing, how
 * decisions trend, where approval latency sits, who the high-risk agents
 * are, which tools deny most, repo heat, blast-radius distribution.
 *
 * Data is hard-coded demo data so the page reads consistently for any
 * prospect walkthrough. When the backend lands, the same shape can be
 * fed from the aggregations the audit pipeline already emits.
 */

import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Topbar from '@/components/layout/Topbar';
import { DUR, EASE, fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';

type TimeRange = '24h' | '7d' | '30d' | 'all';

const POLICY_TRIGGERS = [
  { code: 'P8',  name: 'Blast Radius Gate',        count: 34 },
  { code: 'P1',  name: 'Protected Branch Denial',  count: 28 },
  { code: 'P9',  name: 'Secret Detection',         count: 19 },
  { code: 'P7',  name: 'Sensitive Path',           count: 14 },
  { code: 'P4',  name: 'No Autonomous Merge',      count: 11 },
  { code: 'P5',  name: 'CI Required',              count:  9 },
  { code: 'P2',  name: 'Branch Naming',            count:  7 },
  { code: 'P3',  name: 'Mandatory PR',             count:  6 },
  { code: 'P6',  name: 'Repo Allowlist',           count:  4 },
  { code: 'P10', name: 'Workflow / Infra',         count:  3 },
];

const DECISION_TREND = [
  { day: 'Mon', ALLOW: 167, REWRITE: 4, APPROVAL: 11, DENY: 3 },
  { day: 'Tue', ALLOW: 184, REWRITE: 5, APPROVAL: 9,  DENY: 4 },
  { day: 'Wed', ALLOW: 142, REWRITE: 3, APPROVAL: 14, DENY: 6 },
  { day: 'Thu', ALLOW: 211, REWRITE: 7, APPROVAL: 12, DENY: 5 },
  { day: 'Fri', ALLOW: 196, REWRITE: 6, APPROVAL: 10, DENY: 8 },
  { day: 'Sat', ALLOW:  84, REWRITE: 2, APPROVAL:  5, DENY: 2 },
  { day: 'Sun', ALLOW:  71, REWRITE: 1, APPROVAL:  6, DENY: 1 },
];

const LATENCY_BUCKETS = [
  { bucket: '<5m',    count:  3 },
  { bucket: '5-15m',  count:  8 },
  { bucket: '15-60m', count: 12 },
  { bucket: '1-4h',   count:  6 },
  { bucket: '4-24h',  count:  4 },
  { bucket: '>24h',   count:  2 },
];

const AGENT_LEADERBOARD = [
  { name: 'claude-sonnet-4',  actions: 312, allow: 267, deny: 18, rewrite: 14, approval: 13, denyRate: 5.8,  flag: false },
  { name: 'cursor-agent',     actions: 287, allow: 251, deny: 21, rewrite:  9, approval:  6, denyRate: 7.3,  flag: false },
  { name: 'aider',            actions: 198, allow: 171, deny: 15, rewrite:  8, approval:  4, denyRate: 7.6,  flag: false },
  { name: 'devin',            actions: 156, allow: 119, deny: 24, rewrite:  7, approval:  6, denyRate: 15.4, flag: true  },
  { name: 'replit-agent',     actions: 134, allow: 122, deny:  7, rewrite:  3, approval:  2, denyRate: 5.2,  flag: false },
  { name: 'gpt-4o',           actions:  98, allow:  87, deny:  6, rewrite:  3, approval:  2, denyRate: 6.1,  flag: false },
  { name: 'github-copilot',   actions:  76, allow:  69, deny:  4, rewrite:  2, approval:  1, denyRate: 5.3,  flag: false },
  { name: 'windsurf-cascade', actions:  54, allow:  49, deny:  3, rewrite:  1, approval:  1, denyRate: 5.6,  flag: false },
];

const TOOL_RISK = [
  { tool: 'delete_repository',      calls:   4, denies:   4, rate: 100,  category: 'DENY' as const     },
  { tool: 'terraform_apply',        calls:  11, denies:  11, rate: 100,  category: 'DENY' as const     },
  { tool: 'push_files (to main)',   calls:  67, denies:  28, rate: 41.8, category: 'DENY' as const     },
  { tool: 'execute_migration',      calls:  18, denies:   7, rate: 38.9, category: 'APPROVAL' as const },
  { tool: 'create_workflow_dispatch', calls: 34, denies:  12, rate: 35.3, category: 'APPROVAL' as const },
  { tool: 'merge_pull_request',     calls:  89, denies:  31, rate: 34.8, category: 'DENY' as const     },
];

const REPO_HEAT = [
  { repo: 'aegis/dashboard',           events: 87 },
  { repo: 'runaegis/api',              events: 73 },
  { repo: 'aegis/mcp-server',          events: 61 },
  { repo: 'jenilparmar/playground',    events: 54 },
  { repo: 'runaegis/integrations',     events: 41 },
  { repo: 'aegis/marketing',           events: 28 },
];

const BLAST_RADIUS = [
  { name: 'LOW',      value: 58, color: 'var(--success)'      },
  { name: 'MEDIUM',   value: 24, color: 'var(--warning)'      },
  { name: 'HIGH',     value: 14, color: 'var(--warning-dark)' },
  { name: 'CRITICAL', value:  4, color: 'var(--error)'        },
];

export default function AnalyticsPage() {
  const reduce = useReducedMotion();
  const [range, setRange] = useState<TimeRange>('7d');

  const maxPolicyCount = useMemo(
    () => Math.max(...POLICY_TRIGGERS.map((p) => p.count)),
    [],
  );
  const maxLatencyCount = useMemo(
    () => Math.max(...LATENCY_BUCKETS.map((b) => b.count)),
    [],
  );
  const maxRepoEvents = useMemo(
    () => Math.max(...REPO_HEAT.map((r) => r.events)),
    [],
  );

  return (
    <>
      <Topbar
        title="Analytics"
        subtitle="Governance patterns across your agent fleet"
      />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <motion.div
          variants={staggerContainer(0.05)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="space-y-6"
        >
          {/* Time range pill control */}
          <motion.div variants={fadeUp} className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[12.5px] text-[var(--neutral-sub-600)]">
              Aggregated across all agents, rooms, and tools.
            </p>
            <div
              role="tablist"
              className="inline-flex items-center gap-0.5 rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-0.5"
            >
              {(['24h', '7d', '30d', 'all'] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  role="tab"
                  aria-selected={range === r}
                  onClick={() => setRange(r)}
                  className={[
                    'h-7 rounded-[6px] px-3 text-[11.5px] font-semibold tracking-[-0.005em] transition-colors',
                    range === r
                      ? 'bg-[var(--white-0)] text-[var(--neutral-strong-950)] shadow-[0_1px_2px_rgba(23,23,23,0.06)]'
                      : 'text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]',
                  ].join(' ')}
                >
                  {r === 'all' ? 'All time' : r}
                </button>
              ))}
            </div>
          </motion.div>

          {/* ─── Policy triggers ──────────────────────────────────── */}
          <SectionCard
            label="Policy triggers"
            title="Which policies fired in this window"
          >
            <ul className="space-y-2 px-5 py-4">
              {POLICY_TRIGGERS.map((p) => (
                <li key={p.code} className="grid grid-cols-[48px_1fr_64px] items-center gap-3">
                  <code className="font-mono text-[11px] font-bold tabular-nums text-[var(--neutral-strong-950)]">
                    {p.code}
                  </code>
                  <div className="flex items-center gap-2">
                    <span className="w-44 shrink-0 truncate text-[12.5px] text-[var(--neutral-strong-950)]">
                      {p.name}
                    </span>
                    <div className="flex-1 overflow-hidden rounded-full bg-[var(--neutral-weak-50)] ring-1 ring-[var(--stroke-soft-200)]">
                      <div
                        className="h-2 rounded-full transition-[width] duration-300 ease-out"
                        style={{
                          width: `${(p.count / maxPolicyCount) * 100}%`,
                          backgroundColor: 'var(--primary-base)',
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-right font-mono text-[12px] font-semibold tabular-nums text-[var(--neutral-strong-950)]">
                    {p.count}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>

          {/* ─── Decision trend ───────────────────────────────────── */}
          <SectionCard
            label="Decision trend"
            title="ALLOW · DENY · REWRITE · APPROVAL over the last 7 days"
          >
            <div className="px-5 py-4">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={DECISION_TREND} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g-allow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--success)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--success)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="g-rewrite" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary-base)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--primary-base)" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="g-approval" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--warning-dark)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--warning-dark)" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="g-deny" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--error)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--error)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke-soft-200)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--neutral-sub-600)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--neutral-sub-600)' }} axisLine={false} tickLine={false} width={36} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'var(--white-0)',
                      border: '1px solid var(--stroke-soft-200)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="ALLOW"    stackId="1" stroke="var(--success)"      fill="url(#g-allow)"    strokeWidth={1.5} />
                  <Area type="monotone" dataKey="REWRITE"  stackId="1" stroke="var(--primary-base)" fill="url(#g-rewrite)"  strokeWidth={1.5} />
                  <Area type="monotone" dataKey="APPROVAL" stackId="1" stroke="var(--warning-dark)" fill="url(#g-approval)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="DENY"     stackId="1" stroke="var(--error)"        fill="url(#g-deny)"     strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* ─── Approval latency ────────────────────────────────── */}
            <SectionCard
              label="Approval latency"
              title="How long approvals sit pending"
              subtitle="Avg 47m · fastest 2m · slowest 31h"
            >
              <ul className="space-y-2 px-5 py-4">
                {LATENCY_BUCKETS.map((b) => (
                  <li key={b.bucket} className="grid grid-cols-[64px_1fr_32px] items-center gap-3">
                    <span className="font-mono text-[11px] tabular-nums text-[var(--neutral-sub-600)]">
                      {b.bucket}
                    </span>
                    <div className="overflow-hidden rounded-full bg-[var(--neutral-weak-50)] ring-1 ring-[var(--stroke-soft-200)]">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${(b.count / maxLatencyCount) * 100}%`,
                          backgroundColor: 'var(--warning-dark)',
                        }}
                      />
                    </div>
                    <span className="text-right font-mono text-[12px] font-semibold tabular-nums text-[var(--neutral-strong-950)]">
                      {b.count}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            {/* ─── Blast radius distribution ───────────────────────── */}
            <SectionCard
              label="Blast radius distribution"
              title="How impactful are the actions Aegis sees?"
            >
              <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="h-[180px] w-[180px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={BLAST_RADIUS}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={78}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {BLAST_RADIUS.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="flex-1 space-y-2">
                  {BLAST_RADIUS.map((b) => (
                    <li key={b.name} className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: b.color }}
                          aria-hidden
                        />
                        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--neutral-strong-950)]">
                          {b.name}
                        </span>
                      </span>
                      <span className="font-mono text-[12px] font-semibold tabular-nums text-[var(--neutral-strong-950)]">
                        {b.value}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </SectionCard>
          </div>

          {/* ─── Agent leaderboard ───────────────────────────────── */}
          <SectionCard
            label="Agent activity"
            title="Last 30 days · ranked by call volume"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-sub-600)]">
                    <th className="px-5 py-2.5">Agent</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                    <th className="px-3 py-2.5 text-right">Allow</th>
                    <th className="px-3 py-2.5 text-right">Deny</th>
                    <th className="px-3 py-2.5 text-right">Rewrite</th>
                    <th className="px-3 py-2.5 text-right">Approval</th>
                    <th className="px-5 py-2.5 text-right">Deny rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--stroke-soft-200)]">
                  {AGENT_LEADERBOARD.map((a) => (
                    <tr
                      key={a.name}
                      className={a.flag ? 'bg-[rgba(246,181,30,0.08)]' : 'hover:bg-[var(--neutral-weak-50)]'}
                    >
                      <td className="px-5 py-2.5 font-mono text-[12px] font-semibold text-[var(--neutral-strong-950)]">
                        {a.name}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{a.actions}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--success)]">{a.allow}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--error)]">{a.deny}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--primary-base)]">{a.rewrite}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--warning-dark)]">{a.approval}</td>
                      <td className="px-5 py-2.5 text-right font-mono font-semibold tabular-nums">
                        <span style={{ color: a.flag ? 'var(--warning-dark)' : 'var(--neutral-strong-950)' }}>
                          {a.denyRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* ─── Tool risk ranking ───────────────────────────────── */}
          <SectionCard
            label="Riskiest tools"
            title="By deny rate · ranked"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-sub-600)]">
                    <th className="px-5 py-2.5">Tool</th>
                    <th className="px-3 py-2.5 text-right">Calls</th>
                    <th className="px-3 py-2.5 text-right">Denied</th>
                    <th className="px-3 py-2.5 text-right">Rate</th>
                    <th className="px-5 py-2.5">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--stroke-soft-200)]">
                  {TOOL_RISK.map((t) => (
                    <tr key={t.tool} className="hover:bg-[var(--neutral-weak-50)]">
                      <td className="px-5 py-2.5 font-mono text-[12px] font-semibold text-[var(--neutral-strong-950)]">
                        {t.tool}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{t.calls}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--error)]">{t.denies}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">{t.rate}%</td>
                      <td className="px-5 py-2.5">
                        <span
                          className="font-mono text-[10.5px] font-bold uppercase tracking-[0.06em]"
                          style={{ color: t.category === 'DENY' ? 'var(--error)' : 'var(--warning-dark)' }}
                        >
                          {t.category}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* ─── Repo heat map ───────────────────────────────────── */}
          <SectionCard
            label="Repo governance heat map"
            title="Governance events per repo"
          >
            <ul className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-2">
              {REPO_HEAT.map((r) => {
                const intensity = r.events / maxRepoEvents;
                return (
                  <li
                    key={r.repo}
                    className="flex items-center justify-between gap-3 rounded-[8px] px-3 py-2"
                    style={{
                      backgroundColor: `rgba(250, 115, 25, ${0.06 + intensity * 0.20})`,
                      border: `1px solid rgba(250, 115, 25, ${0.18 + intensity * 0.18})`,
                    }}
                  >
                    <code className="truncate font-mono text-[12px] font-semibold text-[var(--neutral-strong-950)]">
                      {r.repo}
                    </code>
                    <span className="shrink-0 font-mono text-[12px] tabular-nums text-[var(--neutral-strong-950)]">
                      {r.events} events
                    </span>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </motion.div>
      </div>
    </>
  );
}

function SectionCard({
  label,
  title,
  subtitle,
  children,
}: {
  label: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      variants={fadeUpSm}
      className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
    >
      <div className="border-b border-[var(--stroke-soft-200)] px-5 py-3">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
          {label}
        </p>
        <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[11.5px] text-[var(--neutral-sub-600)]">{subtitle}</p>
        )}
      </div>
      {children}
    </motion.section>
  );
}
