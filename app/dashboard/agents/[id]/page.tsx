'use client';

/**
 * Agent detail page — `/dashboard/agents/[id]`.
 *
 * Renders everything Aegis knows about a single agent: identity,
 * runtime, lifecycle, risk profile, trust score, allowed surfaces,
 * recent sessions. Reads from the same `useDashboardData()` runs feed
 * the list page uses so demo and real modes both work.
 *
 * Mock fields (provider/runtime/owner/risk) are synthesized
 * deterministically from the agent name so the page reads consistent
 * across renders. The backend can populate these from real registry
 * data once the agent inventory ships.
 */

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  Bot,
  Pause,
  PlayCircle,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { AgentMark } from '@/components/ui/AgentMark';
import { Button } from '@/components/ui/Button';
import { ConnectorIcon, getConnectorForTool, type ConnectorId } from '@/components/ui/ConnectorMark';
import { IconMark } from '@/components/ui/IconMark';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { useDashboardData } from '@/lib/dashboardDataContext';
import { useToast } from '@/components/ui/Toast';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';

type Lifecycle = 'active' | 'watching' | 'quarantine' | 'paused' | 'revoked';

const LIFECYCLE_TONE: Record<Lifecycle, { label: string; color: string; bg: string; ring: string }> = {
  active:     { label: 'Active',     color: 'var(--success)',      bg: 'rgba(31, 193, 107, 0.10)',  ring: 'rgba(31, 193, 107, 0.30)' },
  watching:   { label: 'Watching',   color: 'var(--warning-dark)', bg: 'rgba(246, 181, 30, 0.10)',  ring: 'rgba(246, 181, 30, 0.30)' },
  quarantine: { label: 'Quarantine', color: 'var(--error)',        bg: 'rgba(251, 55, 72, 0.10)',   ring: 'rgba(251, 55, 72, 0.30)' },
  paused:     { label: 'Paused',     color: 'var(--neutral-sub-600)', bg: 'rgba(160, 160, 160, 0.10)', ring: 'var(--stroke-sub-300)' },
  revoked:    { label: 'Revoked',    color: 'var(--neutral-soft-400)', bg: 'transparent',             ring: 'var(--stroke-soft-200)' },
};

type RiskProfile = 'read_only' | 'write_capable' | 'deploy_capable' | 'production_impacting';

const RISK_LABEL: Record<RiskProfile, string> = {
  read_only:            'Read-only',
  write_capable:        'Write-capable',
  deploy_capable:       'Deploy-capable',
  production_impacting: 'Production-impacting',
};

const RISK_TONE: Record<RiskProfile, string> = {
  read_only:            'var(--success)',
  write_capable:        'var(--neutral-strong-950)',
  deploy_capable:       'var(--warning-dark)',
  production_impacting: 'var(--error)',
};

const PROVIDERS: Record<string, { provider: string; runtime: string }> = {
  'claude-code':       { provider: 'Anthropic',   runtime: 'Claude Code'   },
  'claude-sonnet-4':   { provider: 'Anthropic',   runtime: 'Claude Code'   },
  'cursor-agent':      { provider: 'Cursor',      runtime: 'Cursor'        },
  'gpt-4o':            { provider: 'OpenAI',      runtime: 'Custom runtime'},
  'codex':             { provider: 'OpenAI',      runtime: 'Codex'         },
  'devin':             { provider: 'Cognition',   runtime: 'Devin'         },
  'aider':             { provider: 'OSS',         runtime: 'Aider CLI'     },
  'github-copilot':    { provider: 'GitHub',      runtime: 'Copilot CLI'   },
  'replit-agent':      { provider: 'Replit',      runtime: 'Replit Agents' },
  'windsurf':          { provider: 'Codeium',     runtime: 'Windsurf'      },
};

const OWNERS = ['Ahaan Iqbal · Founder', 'Jenil Parmar · Engineering', 'Kartik Gupta · Engineering'];
const TEAMS = ['Core', 'Platform', 'Reliability'];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function synthesizeAgentDetail(name: string, trust: number) {
  const h = hashString(name);
  const known = PROVIDERS[name] ?? PROVIDERS[name.split('-')[0]];
  return {
    provider: known?.provider ?? 'Custom',
    runtime: known?.runtime ?? 'Custom MCP runtime',
    owner: OWNERS[h % OWNERS.length],
    team: TEAMS[h % TEAMS.length],
    risk: ((['write_capable', 'deploy_capable', 'production_impacting', 'write_capable'] as RiskProfile[])[h % 4]) as RiskProfile,
  };
}

export default function AgentDetailPage() {
  const reduce = useReducedMotion();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const agentName = decodeURIComponent(params?.id ?? '');
  const { sessionActions: runs } = useDashboardData();
  const toast = useToast();
  const [lifecycle, setLifecycle] = useState<Lifecycle>('active');

  // Aggregate this agent's runs.
  const detail = useMemo(() => {
    let total = 0;
    let anomalies = 0;
    let denies = 0;
    let rewrites = 0;
    let approvals = 0;
    let allows = 0;
    const connectors = new Set<string>();
    const repos = new Set<string>();
    const sessionsMap = new Map<
      string,
      { sessionId: string; lastTimestamp: string; actionCount: number; decisions: Record<string, number> }
    >();
    let lastSeen = '';
    for (const r of runs) {
      if (r.agent_name !== agentName) continue;
      total += 1;
      if (r.anomaly) anomalies += 1;
      const d = (r.decision ?? '').toUpperCase();
      if (d === 'DENY') denies += 1;
      else if (d === 'REWRITE') rewrites += 1;
      else if (d.includes('APPROVAL')) approvals += 1;
      else if (d === 'ALLOW') allows += 1;
      const c = getConnectorForTool(r.tool_name);
      if (c) connectors.add(c);
      if (r.target_repo) repos.add(r.target_repo);
      if (!lastSeen || new Date(r.timestamp) > new Date(lastSeen)) lastSeen = r.timestamp;
      // Per-session aggregation for the "Session history" table
      const sid = r.session_id ?? 'unknown';
      const s = sessionsMap.get(sid) ?? { sessionId: sid, lastTimestamp: r.timestamp, actionCount: 0, decisions: {} };
      s.actionCount += 1;
      if (new Date(r.timestamp) > new Date(s.lastTimestamp)) s.lastTimestamp = r.timestamp;
      s.decisions[d] = (s.decisions[d] ?? 0) + 1;
      sessionsMap.set(sid, s);
    }
    const trust = total > 0 ? Math.max(0.5, 1 - anomalies / total) : 1;
    const synth = synthesizeAgentDetail(agentName, trust);
    const sessions = Array.from(sessionsMap.values())
      .sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime())
      .slice(0, 10);
    return {
      total,
      anomalies,
      denies,
      rewrites,
      approvals,
      allows,
      connectors: Array.from(connectors) as ConnectorId[],
      repos: Array.from(repos),
      lastSeen,
      trust,
      sessions,
      ...synth,
    };
  }, [runs, agentName]);

  const trustPct = Math.round(detail.trust * 100);
  const trustTone =
    detail.trust >= 0.9
      ? { label: 'Trusted',    color: 'var(--success)',      bg: 'rgba(31, 193, 107, 0.12)' }
      : detail.trust >= 0.75
        ? { label: 'Watching',   color: 'var(--warning-dark)', bg: 'rgba(246, 181, 30, 0.14)' }
        : { label: 'Quarantine', color: 'var(--error)',        bg: 'rgba(251, 55, 72, 0.10)' };

  const lcTone = LIFECYCLE_TONE[lifecycle];

  const handlePause = () => {
    setLifecycle((prev) => (prev === 'paused' ? 'active' : 'paused'));
    toast.success(lifecycle === 'paused' ? 'Agent resumed' : 'Agent paused', {
      description: lifecycle === 'paused'
        ? `${agentName} is active again. Tool calls will resume passing through Aegis.`
        : `${agentName} is paused. All in-flight tool calls will block until resumed.`,
    });
  };

  // Agent not found in the data — render an inline empty state.
  if (detail.total === 0) {
    return (
      <>
        <Topbar title="Agent" subtitle={agentName} />
        <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <Link
            href="/dashboard/agents"
            className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--neutral-strong-950)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Back to agents
          </Link>
          <div className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-10 text-center">
            <p className="text-[14px] font-semibold text-[var(--neutral-strong-950)]">
              Agent not found
            </p>
            <p className="mt-1.5 text-[12.5px] text-[var(--neutral-sub-600)]">
              No runs recorded for <code className="font-mono text-[12px]">{agentName}</code>. It may have been revoked.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title={agentName} subtitle={`${detail.provider} · ${detail.runtime}`} />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {/* Back link */}
        <Link
          href="/dashboard/agents"
          className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--neutral-strong-950)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Back to agents
        </Link>

        <motion.div
          variants={staggerContainer(0.05)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="space-y-5"
        >
          {/* ── Header card: identity + lifecycle + pause action ──── */}
          <motion.section
            variants={fadeUp}
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
              <div className="flex items-center gap-3.5">
                <AgentMark name={agentName} size="md" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-[var(--neutral-strong-950)]">
                      {agentName}
                    </h1>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]"
                      style={{ backgroundColor: lcTone.bg, color: lcTone.color }}
                    >
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: lcTone.color }}
                      />
                      {lcTone.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-[var(--neutral-sub-600)]">
                    {detail.provider} · <span className="font-mono">{detail.runtime}</span> · Last seen{' '}
                    <RelativeTime
                      timestamp={detail.lastSeen}
                      className="font-mono text-[12px] text-[var(--neutral-sub-600)]"
                    />
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={lifecycle === 'paused' ? 'primary' : 'secondary'}
                  onClick={handlePause}
                  leadingIcon={
                    lifecycle === 'paused' ? (
                      <PlayCircle className="h-3.5 w-3.5" strokeWidth={2.25} />
                    ) : (
                      <Pause className="h-3.5 w-3.5" strokeWidth={2.25} />
                    )
                  }
                >
                  {lifecycle === 'paused' ? 'Resume agent' : 'Pause agent'}
                </Button>
              </div>
            </div>

            {/* Sub-row: owner / team / risk profile / trust score */}
            <div className="grid grid-cols-2 divide-x divide-[var(--stroke-soft-200)] border-t border-[var(--stroke-soft-200)] lg:grid-cols-4">
              <DetailCell label="Owner" value={detail.owner} />
              <DetailCell label="Team" value={detail.team} />
              <DetailCell label="Risk profile">
                <span
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold"
                  style={{ color: RISK_TONE[detail.risk] }}
                >
                  {detail.risk === 'read_only' ? <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} /> : <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2.25} />}
                  {RISK_LABEL[detail.risk]}
                </span>
              </DetailCell>
              <DetailCell label="Trust score">
                <div className="flex items-center gap-2.5">
                  <span
                    className="text-[18px] font-bold tabular-nums"
                    style={{ color: trustTone.color }}
                  >
                    {trustPct}
                  </span>
                  <div
                    aria-hidden
                    className="h-[4px] w-20 overflow-hidden rounded-full bg-[var(--neutral-weak-50)] ring-1 ring-[var(--stroke-soft-200)]"
                  >
                    <span
                      className="block h-full rounded-full transition-[width] duration-300 ease-out"
                      style={{ width: `${trustPct}%`, backgroundColor: trustTone.color }}
                    />
                  </div>
                </div>
              </DetailCell>
            </div>
          </motion.section>

          {/* ── Allowed surfaces ─────────────────────────────────────── */}
          <motion.section
            variants={fadeUp}
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
            <div className="border-b border-[var(--stroke-soft-200)] px-5 py-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                Allowed surfaces
              </p>
              <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                {detail.connectors.length} {detail.connectors.length === 1 ? 'connector' : 'connectors'} · {detail.repos.length} {detail.repos.length === 1 ? 'repo' : 'repos'}
              </h2>
            </div>
            <div className="grid grid-cols-1 divide-y divide-[var(--stroke-soft-200)] md:grid-cols-2 md:divide-x md:divide-y-0">
              <div className="px-5 py-4">
                <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  Connectors
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {detail.connectors.length === 0 ? (
                    <p className="text-[12px] text-[var(--neutral-soft-400)]">No connectors yet.</p>
                  ) : (
                    detail.connectors.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-2 py-1 text-[11.5px] font-medium text-[var(--neutral-strong-950)]"
                      >
                        <ConnectorIcon id={c} size={12} />
                        <span className="font-mono">{c}</span>
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="px-5 py-4">
                <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  Rooms / repos
                </p>
                <ul className="space-y-1">
                  {detail.repos.length === 0 ? (
                    <li className="text-[12px] text-[var(--neutral-soft-400)]">No repos yet.</li>
                  ) : (
                    detail.repos.slice(0, 8).map((r) => (
                      <li key={r} className="font-mono text-[11.5px] text-[var(--neutral-strong-950)]">
                        {r}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </motion.section>

          {/* ── Session history (last 10) ────────────────────────────── */}
          <motion.section
            variants={fadeUp}
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--stroke-soft-200)] px-5 py-3">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                  Session history
                </p>
                <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Last {Math.min(10, detail.sessions.length)} sessions · {detail.total.toLocaleString()} total actions
                </h2>
              </div>
              <Link
                href={`/dashboard/sessions?agent=${encodeURIComponent(agentName)}`}
                className="text-[12px] font-medium text-[var(--primary-base)] hover:text-[var(--primary-dark)]"
              >
                All sessions →
              </Link>
            </div>
            {detail.sessions.length === 0 ? (
              <div className="px-5 py-8 text-center text-[12.5px] text-[var(--neutral-sub-600)]">
                No sessions yet.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--stroke-soft-200)]">
                {detail.sessions.map((s) => (
                  <li key={s.sessionId} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[12px] font-semibold text-[var(--neutral-strong-950)]">
                        {s.sessionId.substring(0, 12)}…
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--neutral-soft-400)]">
                        <RelativeTime
                          timestamp={s.lastTimestamp}
                          className="font-mono text-[11px] text-[var(--neutral-soft-400)]"
                        />
                        {' · '}
                        {s.actionCount} {s.actionCount === 1 ? 'action' : 'actions'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[10.5px] font-mono tabular-nums">
                      {s.decisions.ALLOW ? (
                        <span style={{ color: 'var(--success)' }}>{s.decisions.ALLOW} allow</span>
                      ) : null}
                      {s.decisions.REWRITE ? (
                        <span style={{ color: 'var(--primary-base)' }}>{s.decisions.REWRITE} rewrite</span>
                      ) : null}
                      {s.decisions.DENY ? (
                        <span style={{ color: 'var(--error)' }}>{s.decisions.DENY} deny</span>
                      ) : null}
                      {Object.entries(s.decisions).filter(([k]) => k.includes('APPROVAL'))[0] ? (
                        <span style={{ color: 'var(--warning-dark)' }}>
                          {Object.entries(s.decisions).filter(([k]) => k.includes('APPROVAL'))[0][1]} approval
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </motion.section>

          {/* ── Decision breakdown (footer-tier stat strip) ──────────── */}
          <motion.section
            variants={fadeUp}
            className="grid grid-cols-2 divide-x divide-[var(--stroke-soft-200)] overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] lg:grid-cols-4"
          >
            <DetailCell label="ALLOWS" value={detail.allows.toLocaleString()} valueColor="var(--success)" />
            <DetailCell label="REWRITES" value={detail.rewrites.toLocaleString()} valueColor="var(--primary-base)" />
            <DetailCell label="APPROVALS" value={detail.approvals.toLocaleString()} valueColor="var(--warning-dark)" />
            <DetailCell label="DENIES" value={detail.denies.toLocaleString()} valueColor="var(--error)" />
          </motion.section>
        </motion.div>
      </div>
    </>
  );
}

/** Compact cell used inside the header sub-row + the bottom stat strip. */
function DetailCell({
  label,
  value,
  valueColor,
  children,
}: {
  label: string;
  value?: string;
  valueColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
        {label}
      </p>
      {children ? (
        <div className="mt-1">{children}</div>
      ) : (
        <p
          className="mt-1 text-[18px] font-bold tabular-nums"
          style={{ color: valueColor ?? 'var(--neutral-strong-950)' }}
        >
          {value}
        </p>
      )}
    </div>
  );
}
