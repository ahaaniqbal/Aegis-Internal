'use client';

/**
 * Connector detail page — `/dashboard/connectors/[id]`.
 *
 * Per-connector deep-dive that complements the catalog grid at
 * `/dashboard/connectors`. Renders:
 *
 *   1. Hero — brand mark, name, category, status pill, OAuth / Manage CTA
 *   2. Usage stats — rooms with connector enabled, actions this week,
 *      policies tagged, anomalies surfaced this week
 *   3. Default policy posture — read / write / destructive stance pulled
 *      from CONNECTORS[id].policy and rendered as three chip rows
 *   4. Connected rooms — rooms that have this connector enabled
 *   5. Recent activity — the most-recent agent actions through this
 *      connector with the same connector-mark + decision treatment used
 *      on the Runs / Audit tables
 *
 * Data: real-mode pulls from `api.*`; demo-mode reads from the same
 * preview-data layer the rest of the dashboard uses. No new endpoints.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  Clock,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import {
  ConnectorMark,
  CONNECTORS,
  type ConnectorId,
  ConnectorIcon,
  TOOLS_BY_CONNECTOR,
  getConnectorForTool,
} from '@/components/ui/ConnectorMark';
import { Button } from '@/components/ui/Button';
import { CodeChip } from '@/components/ui/CodeChip';
import DecisionBadge from '@/components/ui/DecisionBadge';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { AnomalyChip } from '@/components/ui/AnomalyChip';
import { ActionToolbar } from '@/components/ui/ActionToolbar';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import type { SessionAction } from '@/lib/types';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';

type ConnectorStatus = 'live' | 'in-progress' | 'coming-soon';

// Mirror the parent page's status maps. Real-mode honest state vs
// demo-workspace "everything live" — same demo-aware switch.
const STATUS_BY_ID_REAL: Record<ConnectorId, ConnectorStatus> = {
  github: 'live',
  slack: 'live',
  linear: 'in-progress',
  'github-actions': 'in-progress',
  postgres: 'coming-soon',
  terraform: 'coming-soon',
  jira: 'coming-soon',
  datadog: 'coming-soon',
  sentry: 'coming-soon',
  kubernetes: 'coming-soon',
  cloudflare: 'coming-soon',
  notion: 'coming-soon',
};

const STATUS_BY_ID_DEMO: Record<ConnectorId, ConnectorStatus> = {
  github: 'live',
  slack: 'live',
  linear: 'live',
  'github-actions': 'live',
  postgres: 'live',
  terraform: 'live',
  jira: 'live',
  datadog: 'live',
  sentry: 'live',
  kubernetes: 'live',
  cloudflare: 'live',
  notion: 'live',
};

function isValidConnectorId(s: string): s is ConnectorId {
  return s in CONNECTORS;
}

export default function ConnectorDetailPage() {
  const params = useParams<{ id: string }>();
  const reduce = useReducedMotion();
  const { user } = useUser();
  const idParam = params?.id ?? '';

  if (!isValidConnectorId(idParam)) {
    notFound();
  }
  const id = idParam as ConnectorId;
  const def = CONNECTORS[id];

  const demoOn =
    typeof document !== 'undefined' &&
    document.documentElement.dataset.demo === 'true';
  const status = (demoOn ? STATUS_BY_ID_DEMO : STATUS_BY_ID_REAL)[id];

  // Pull the workspace's runs and filter to this connector. Same
  // mechanism the Runs page uses — keeps the data path consistent.
  const [runs, setRuns] = useState<SessionAction[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getRuns(user?.id);
        if (!cancelled) setRuns(Array.isArray(data) ? data : []);
      } catch {
        // Silent fail — empty array yields the page's empty state.
        if (!cancelled) setRuns([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const connectorRuns = useMemo(
    () =>
      runs.filter((r) => getConnectorForTool(r.tool_name) === id),
    [runs, id],
  );

  // Usage stats — all derived from the same runs feed. No new
  // endpoints required; backend can replace with cheaper rollups
  // when it grows up.
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const stats = useMemo(() => {
    const weekAgo = Date.now() - ONE_WEEK_MS;
    const weekRuns = connectorRuns.filter(
      (r) => new Date(r.timestamp).getTime() >= weekAgo,
    );
    const sessions = new Set(weekRuns.map((r) => r.session_id));
    const rooms = new Set(weekRuns.map((r) => r.target_repo).filter(Boolean));
    const anomalies = weekRuns.filter((r) => r.anomaly).length;
    const blocked = weekRuns.filter(
      (r) => r.decision?.toUpperCase() === 'DENY',
    ).length;
    return {
      runsThisWeek: weekRuns.length,
      sessionsThisWeek: sessions.size,
      roomsActive: rooms.size,
      anomaliesThisWeek: anomalies,
      blockedThisWeek: blocked,
    };
  }, [connectorRuns]);

  const recentRuns = useMemo(() => connectorRuns.slice(0, 8), [connectorRuns]);

  const policyMix = def.policy;
  const toolCount = TOOLS_BY_CONNECTOR[id]?.length ?? 0;

  return (
    <>
      <Topbar title="Connectors" subtitle={def.name} />
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
            href="/dashboard/connectors"
            className="inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 transition-colors duration-150 hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
          >
            <ArrowLeft className="h-3 w-3 transition-transform duration-150 group-hover:-translate-x-px" strokeWidth={2} aria-hidden />
            Connectors
          </Link>
          <span aria-hidden className="text-[var(--neutral-soft-400)]">
            /
          </span>
          <span className="font-medium text-[var(--neutral-sub-600)]">
            {def.name}
          </span>
        </motion.nav>

        {/* ─── Connector switcher ───────────────────────────────────────
            Horizontal pill row exposing every connector as a one-click
            jump. Before this, the only way to navigate between connector
            detail pages was bouncing back to the catalog grid; this is
            the inline equivalent of Linear's project switcher or
            Vercel's project dropdown. Current connector reads as a
            filled brand-orange pill so the user always knows where
            they are; others are subtle white pills with hover lift +
            shadow + border shift.

            Responsive behaviour:
              · `<sm` — horizontal scroll, `flex-nowrap` so the row
                stays one line. Edge-fade mask hints at "more pills
                to the right." Better than wrapping 7 pills to 3
                rows on a 375px viewport.
              · `sm+`  — flex wraps gracefully (most desktops fit
                the full set in one row at the standard container
                width, so wrap rarely triggers in practice). */}
        <motion.nav
          aria-label="Switch connector"
          // Mask + scroll only apply below sm. At sm+ the row gracefully
          // wraps within its container and the right-edge fade would
          // wrongly cut off the last pill in the visible row.
          className="-mx-1 mb-5 overflow-x-auto px-1 [-ms-overflow-style:none] [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] [scrollbar-width:none] sm:[mask-image:none] sm:overflow-visible [&::-webkit-scrollbar]:hidden"
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.default, ease: EASE.out, delay: 0.04 }}
        >
          <div className="flex flex-nowrap items-center gap-1.5 sm:flex-wrap">
            {Object.values(CONNECTORS).map((c) => {
              const isActive = c.id === id;
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/connectors/${c.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'group inline-flex shrink-0 items-center gap-1.5 rounded-[7px] border px-2 py-[5px] text-[11.5px] font-medium transition-all duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-24)]',
                    isActive
                      ? 'border-[var(--primary-base)]/40 bg-[var(--primary-lighter)] text-[var(--primary-dark)] shadow-[0_1px_2px_rgba(250,115,25,0.10)]'
                      : 'border-[var(--stroke-soft-200)] bg-white text-[var(--neutral-sub-600)] hover:-translate-y-px hover:border-[var(--stroke-sub-300)] hover:text-[var(--neutral-strong-950)] hover:shadow-[0_2px_4px_rgba(23,23,23,0.05)]',
                  ].join(' ')}
                >
                  <ConnectorIcon
                    id={c.id}
                    size={12}
                    className={isActive ? '' : 'opacity-85 transition-opacity duration-150 group-hover:opacity-100'}
                  />
                  {c.name}
                </Link>
              );
            })}
          </div>
        </motion.nav>

        <motion.div
          variants={staggerContainer(0.05, 0.04)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="space-y-6"
        >
          {/* ─── Hero ────────────────────────────────────────────────── */}
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
            <div className="relative flex flex-wrap items-start justify-between gap-5">
              <div className="flex items-start gap-4">
                <ConnectorMark id={id} size="lg" />
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                    <span>{def.category}</span>
                    {def.primitive && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="font-mono text-[10px] text-[var(--neutral-sub-600)]">
                          {def.primitive}
                        </span>
                      </>
                    )}
                  </div>
                  <h1 className="text-[26px] font-semibold leading-[1.1] tracking-[-0.025em] text-[var(--neutral-strong-950)] sm:text-[30px]">
                    {def.name}
                  </h1>
                  <p className="mt-2 max-w-[560px] text-[13px] leading-[1.55] text-[var(--neutral-sub-600)]">
                    {def.description}
                  </p>
                </div>
              </div>
              <StatusPill status={status} />
            </div>

            <div className="relative mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--stroke-soft-200)] pt-4">
              {status === 'live' ? (
                <>
                  <Button
                    variant="primary"
                    trailingIcon={<ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />}
                  >
                    Connect a room
                  </Button>
                  <Button variant="secondary">View MCP tools</Button>
                </>
              ) : status === 'in-progress' ? (
                <Button variant="secondary">Notify me when this ships</Button>
              ) : (
                <Button variant="secondary">Request earlier access</Button>
              )}
            </div>
          </motion.section>

          {/* ─── Usage stats ─────────────────────────────────────────── */}
          <motion.section
            variants={fadeUp}
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            <StatTile
              label="Rooms active"
              value={stats.roomsActive}
              footnote="With this connector enabled"
            />
            <StatTile
              label="Actions this week"
              value={stats.runsThisWeek}
              footnote={`across ${stats.sessionsThisWeek} ${stats.sessionsThisWeek === 1 ? 'session' : 'sessions'}`}
            />
            <StatTile
              label="Blocked this week"
              value={stats.blockedThisWeek}
              footnote="Hard-deny decisions"
              color="var(--error)"
            />
            <StatTile
              label="CIL anomalies"
              value={stats.anomaliesThisWeek}
              footnote="Behavioral outliers"
              color="var(--warning)"
            />
          </motion.section>

          {/* ─── Default policy posture ──────────────────────────────── */}
          <motion.section
            variants={fadeUp}
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-5 py-3">
              <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Default policy posture
              </h2>
              <span className="text-[11.5px] text-[var(--neutral-soft-400)]">
                {toolCount} MCP tools
              </span>
            </div>
            <div className="grid grid-cols-1 gap-px bg-[var(--stroke-soft-200)] sm:grid-cols-3">
              <PostureCell label="Read" stance={policyMix.read} />
              <PostureCell label="Write" stance={policyMix.write} />
              <PostureCell label="Destructive" stance={policyMix.destructive} />
            </div>
          </motion.section>

          {/* ─── Recent activity ─────────────────────────────────────── */}
          <motion.section
            variants={fadeUp}
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-5 py-3">
              <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Recent activity through {def.name}
              </h2>
              <Link
                href={`/dashboard/runs?connector=${id}`}
                className="group inline-flex items-center gap-1 text-[12px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--primary-base)]"
              >
                View all runs
                <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" strokeWidth={2} />
              </Link>
            </div>
            {recentRuns.length > 0 ? (
              <ul className="divide-y divide-[var(--stroke-soft-200)]">
                {recentRuns.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 px-5 py-3">
                    <ConnectorIcon id={id} size={14} className="mt-1" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <CodeChip>{r.tool_name}</CodeChip>
                        <AnomalyChip
                          anomaly={r.anomaly}
                          reason={r.anomaly_reason}
                        />
                      </div>
                      {r.action_summary && (
                        <p className="mt-1 text-[12.5px] leading-[1.45] text-[var(--neutral-strong-950)]">
                          {r.action_summary}
                        </p>
                      )}
                      <p className="mt-0.5 text-[11px] text-[var(--neutral-soft-400)]">
                        {r.agent_name}
                        {r.target_repo ? ` · ${r.target_repo}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <DecisionBadge decision={r.decision} />
                      <RelativeTime
                        timestamp={r.timestamp}
                        className="text-[11px] text-[var(--neutral-soft-400)]"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-8 text-center">
                <p className="text-[12.5px] text-[var(--neutral-sub-600)]">
                  No agents have used the {def.name} connector yet.
                </p>
              </div>
            )}
          </motion.section>

          {/* ─── Real-time controls (Layer 5: Actions) ─────────────────
              Naked ActionToolbar inside a card read as "a row of buttons
              with no purpose" on first arrival. Wrapping it with a
              header + helper paragraph names the intervention zone so
              a reviewer landing here understands what each button does
              at the connector level (not at a single run). */}
          <motion.section
            variants={fadeUp}
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
            <div className="border-b border-[var(--stroke-soft-200)] px-5 py-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                Real-time controls
              </p>
              <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Intervene without waiting for a deploy
              </h2>
              <p className="mt-1 text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">
                Each control takes effect on every active session using
                the {def.name} connector. Scope changes route through
                the audit log so the change is reviewable.
              </p>
            </div>
            <div className="px-5 py-4">
              <ActionToolbar
                targetLabel={`${def.name} connector`}
                show={['pause', 'scope-down', 'escalate']}
              />
            </div>
          </motion.section>
        </motion.div>
      </div>
    </>
  );
}

// ─── Helper components ─────────────────────────────────────────────────

function StatusPill({ status }: { status: ConnectorStatus }) {
  if (status === 'live') {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--success)]/22 bg-[var(--success-lighter)]/50 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--success-dark)]"
      >
        <ShieldCheck className="h-3 w-3" strokeWidth={2.25} />
        Live
      </span>
    );
  }
  if (status === 'in-progress') {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--primary-base)]/24 bg-[var(--primary-lighter)] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--primary-dark)]"
      >
        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.25} />
        In progress
      </span>
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--neutral-sub-600)]"
    >
      <Clock className="h-3 w-3" strokeWidth={2.25} />
      Coming soon
    </span>
  );
}

function StatTile({
  label,
  value,
  footnote,
  color,
}: {
  label: string;
  value: number;
  footnote?: string;
  color?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)] bg-white p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
      {/* Tone-tinted corner glow — same treatment as the dashboard's
          OutcomeTile so the per-connector page reads as part of the
          same visual system. */}
      {color && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full"
          style={{
            background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
            opacity: 0.10,
          }}
        />
      )}
      <p className="relative text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
        {label}
      </p>
      <p
        className="relative mt-2 text-[28px] font-semibold leading-none tracking-[-0.035em] tabular-nums sm:text-[30px]"
        style={{ color: color ?? 'var(--neutral-strong-950)' }}
      >
        {value.toLocaleString()}
      </p>
      {footnote && (
        <p className="relative mt-1.5 text-[11.5px] leading-[1.4] text-[var(--neutral-sub-600)]">
          {footnote}
        </p>
      )}
    </div>
  );
}

const POSTURE_LABEL: Record<'allow' | 'approval' | 'deny', { label: string; tone: string; description: string }> = {
  allow: {
    label: 'Allow',
    tone: 'var(--success)',
    description: 'Open by default. Agent calls pass through unmodified.',
  },
  approval: {
    label: 'Approval',
    tone: 'var(--warning)',
    description: 'Routes to the Approval queue for human sign-off.',
  },
  deny: {
    label: 'Deny',
    tone: 'var(--error)',
    description: 'Hard-blocked. Agent gets a policy-violation error.',
  },
};

function PostureCell({
  label,
  stance,
}: {
  label: string;
  stance: 'allow' | 'approval' | 'deny';
}) {
  const p = POSTURE_LABEL[stance];
  return (
    <div className="flex flex-col gap-2 bg-white p-5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: p.tone }}
        />
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
          {p.label}
        </span>
      </div>
      <p className="text-[11.5px] leading-[1.4] text-[var(--neutral-sub-600)]">
        {p.description}
      </p>
    </div>
  );
}
