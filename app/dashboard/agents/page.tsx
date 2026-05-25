'use client';

/**
 * Agents inventory — `/dashboard/agents`.
 *
 * "Who are the agents in your workspace?" The page that answers the
 * first investor question and the first new-customer question. Lists
 * every agent we've seen tool calls from, computes their behavioural
 * trust posture, and surfaces the cross-tool surface each one touches.
 *
 * Sections:
 *   1. Compact header (matches Insights / Runs / Policies cadence)
 *   2. Trust-band filter chip strip (All / Trusted / Watching /
 *      Quarantine) so a reviewer can narrow to "what should I worry
 *      about today?"
 *   3. Card grid — one card per agent with trust score, run + anomaly
 *      + approval stats, connector strip, last seen.
 *
 * Trust band thresholds match the ranking on CIL Insights so the two
 * surfaces speak the same language.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Bot } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { AgentMark } from '@/components/ui/AgentMark';
import { ConnectorIcon, getConnectorForTool } from '@/components/ui/ConnectorMark';
import EmptyState from '@/components/ui/EmptyState';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { Tooltip } from '@/components/ui/Tooltip';
import { useDashboardData } from '@/lib/dashboardDataContext';
import { cn } from '@/lib/utils';
import { DUR, EASE, fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';

const TRUST_FLOOR = 0.5;
const MATURE_BASELINE_RUNS = 20;

type TrustBand = 'all' | 'trusted' | 'watching' | 'quarantine';

const BAND_DEFS: Record<
  Exclude<TrustBand, 'all'>,
  { label: string; min: number; max: number; tone: string }
> = {
  trusted:    { label: 'Trusted',    min: 0.9,  max: 1.01, tone: 'var(--success)' },
  watching:   { label: 'Watching',   min: 0.75, max: 0.9,  tone: 'var(--warning)' },
  quarantine: { label: 'Quarantine', min: 0.0,  max: 0.75, tone: 'var(--error)' },
};

/**
 * Demo-only forced quarantine. The trust system computes anomaly-rate
 * naturally; in a live workspace this would derive from real CI failure
 * streaks + push sequences. For the demo we hard-pin one agent so the
 * Quarantine tab is never empty — that makes the trust system tangible.
 *
 * Reason copy comes from the canonical `sequence_anomaly` semantic_type:
 * push_count > 5 AND ci_failure_streak > 3.
 */
const FORCED_QUARANTINE: Record<string, { trust: number; reason: string }> = {
  devin: {
    trust: 0.62,
    reason: 'Sequence anomaly — 9 pushes with 5 consecutive CI failures',
  },
};

export default function AgentsPage() {
  const reduce = useReducedMotion();
  const { sessionActions: runs, lastUpdated, refreshRuns } = useDashboardData();
  const [band, setBand] = useState<TrustBand>('all');

  // ── Aggregate runs per agent ──────────────────────────────────
  // Same shape as the CIL Insights agent ranking computation. Kept
  // local to this page (not extracted to a shared selector) because
  // the field set differs and the projection is small + cheap.
  const agents = useMemo(() => {
    const byAgent = new Map<
      string,
      {
        runs: number;
        anomalies: number;
        approvals: number;
        denies: number;
        rewrites: number;
        lastSeen: string;
        connectors: Set<string>;
        repos: Set<string>;
      }
    >();
    for (const r of runs) {
      if (!r.agent_name) continue;
      const a = byAgent.get(r.agent_name) ?? {
        runs: 0,
        anomalies: 0,
        approvals: 0,
        denies: 0,
        rewrites: 0,
        lastSeen: r.timestamp,
        connectors: new Set<string>(),
        repos: new Set<string>(),
      };
      a.runs += 1;
      if (r.anomaly) a.anomalies += 1;
      const d = (r.decision ?? '').toUpperCase();
      if (d === 'DENY') a.denies += 1;
      if (d === 'REWRITE') a.rewrites += 1;
      if (d.includes('APPROVAL')) a.approvals += 1;
      if (new Date(r.timestamp) > new Date(a.lastSeen)) a.lastSeen = r.timestamp;
      const c = getConnectorForTool(r.tool_name);
      if (c) a.connectors.add(c);
      if (r.target_repo) a.repos.add(r.target_repo);
      byAgent.set(r.agent_name, a);
    }
    return Array.from(byAgent.entries())
      .map(([name, a]) => {
        const anomalyRate = a.runs > 0 ? a.anomalies / a.runs : 0;
        const naturalTrust = Math.max(TRUST_FLOOR, 1 - anomalyRate);
        // Demo override: forced quarantine for tangibility (see
        // FORCED_QUARANTINE above). Applies only when the agent is in
        // the override set.
        const override = FORCED_QUARANTINE[name];
        const trust = override ? override.trust : naturalTrust;
        const quarantineReason = override ? override.reason : null;
        return {
          name,
          runs: a.runs,
          anomalies: a.anomalies,
          approvals: a.approvals,
          denies: a.denies,
          rewrites: a.rewrites,
          lastSeen: a.lastSeen,
          connectors: Array.from(a.connectors),
          repos: Array.from(a.repos),
          trust,
          quarantineReason,
          mature: a.runs >= MATURE_BASELINE_RUNS,
        };
      })
      // Sort by trust ascending so the riskiest agents land at the top
      // — that's what a reviewer wants to see when they open the page.
      .sort((a, b) => a.trust - b.trust || b.anomalies - a.anomalies);
  }, [runs]);

  // ── Trust-band filter ─────────────────────────────────────────
  const bandCounts = useMemo(() => {
    const counts: Record<TrustBand, number> = {
      all: agents.length,
      trusted: 0,
      watching: 0,
      quarantine: 0,
    };
    for (const a of agents) {
      if (a.trust >= BAND_DEFS.trusted.min) counts.trusted += 1;
      else if (a.trust >= BAND_DEFS.watching.min) counts.watching += 1;
      else counts.quarantine += 1;
    }
    return counts;
  }, [agents]);

  const visible = useMemo(() => {
    if (band === 'all') return agents;
    const def = BAND_DEFS[band];
    return agents.filter((a) => a.trust >= def.min && a.trust < def.max);
  }, [agents, band]);

  return (
    <>
      <Topbar
        title="Agents"
        subtitle="The agents your team has connected"
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
            Agent inventory
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
          >
            Every agent in your workspace
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-2 text-[13.5px] text-[var(--neutral-sub-600)]"
          >
            {bandCounts.all} total · {bandCounts.trusted} trusted ·{' '}
            {bandCounts.watching} watching · {bandCounts.quarantine}{' '}
            quarantine.
          </motion.p>
        </motion.header>

        {/* ─── Trust-band filter ──────────────────────────────────── */}
        <motion.nav
          aria-label="Filter agents by trust band"
          className="-mx-1 mb-5 overflow-x-auto px-1 [-ms-overflow-style:none] [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] [scrollbar-width:none] sm:[mask-image:none] sm:overflow-visible [&::-webkit-scrollbar]:hidden"
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.default, ease: EASE.out, delay: 0.1 }}
        >
          <div className="flex flex-nowrap items-center gap-1.5 sm:flex-wrap">
            <BandChip
              label="All"
              count={bandCounts.all}
              active={band === 'all'}
              onClick={() => setBand('all')}
            />
            {(Object.keys(BAND_DEFS) as Array<Exclude<TrustBand, 'all'>>).map(
              (key) => (
                <BandChip
                  key={key}
                  label={BAND_DEFS[key].label}
                  count={bandCounts[key]}
                  tone={BAND_DEFS[key].tone}
                  active={band === key}
                  onClick={() => setBand(key)}
                />
              ),
            )}
          </div>
        </motion.nav>

        {/* ─── Card grid ──────────────────────────────────────────── */}
        {visible.length === 0 ? (
          <div className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <EmptyState
              icon={<Bot className="h-5 w-5" />}
              title={
                agents.length === 0
                  ? 'No agents connected yet'
                  : `No agents in ${band}`
              }
              description={
                agents.length === 0
                  ? 'Connect your first agent from a Room to start tracking behavioural baselines.'
                  : 'Try another band or show all agents.'
              }
              compact
            />
          </div>
        ) : (
          <motion.div
            // Re-key on band so the stagger fires on filter change.
            key={band}
            className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
            variants={staggerContainer(0.03, 0.18)}
            initial={reduce ? false : 'hidden'}
            animate="show"
          >
            {visible.map((a) => (
              <AgentCard key={a.name} agent={a} />
            ))}
          </motion.div>
        )}
      </div>
    </>
  );
}

// ─── Trust-band filter chip ──────────────────────────────────────────
function BandChip({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone?: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      // Framer hover lift instead of CSS hover:-translate-y so the
      // chip pop is GPU-composited (matches Cards + OutcomeTiles).
      // Active chip skips the lift — it's the current state, no
      // affordance to suggest. Inactive chips lift -2px and the press
      // dips back for tactile feedback.
      whileHover={active ? undefined : { y: -2, transition: { duration: 0.15, ease: [0.32, 0.72, 0.32, 1] } }}
      whileTap={active ? undefined : { y: 0, transition: { duration: 0.1, ease: [0.4, 0, 0.2, 1] } }}
      className={cn(
        'group inline-flex shrink-0 items-center gap-1.5 rounded-[7px] border px-2.5 py-[5px] text-[11.5px] font-medium transition-[box-shadow,border-color,color] duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-24)]',
        active
          ? 'border-[var(--primary-base)]/40 bg-[var(--primary-lighter)] text-[var(--primary-dark)] shadow-[0_1px_2px_rgba(250,115,25,0.10)]'
          : 'border-[var(--stroke-soft-200)] bg-white text-[var(--neutral-sub-600)] hover:border-[var(--stroke-sub-300)] hover:text-[var(--neutral-strong-950)] hover:shadow-[0_2px_4px_rgba(23,23,23,0.05)]',
      )}
    >
      {tone && (
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: tone }}
        />
      )}
      {label}
      <span
        className={cn(
          'inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[9.5px] font-bold tabular-nums transition-colors duration-150',
          active
            ? 'bg-[var(--primary-base)]/15 text-[var(--primary-dark)]'
            : 'bg-[var(--neutral-weak-50)] text-[var(--neutral-soft-400)] group-hover:bg-[var(--neutral-soft-200)] group-hover:text-[var(--neutral-sub-600)]',
        )}
      >
        {count}
      </span>
    </motion.button>
  );
}

// ─── Individual agent card ───────────────────────────────────────────
/**
 * Compact agent card. Pulled from Refero references:
 *   • Fingerprint settings/users — single warm accent on a calm
 *     enterprise canvas; subdued secondary text
 *   • Cursor team dashboard — low-contrast, restrained, soft shadows
 *   • Raycast org settings — compact type carrying dense information
 *
 * Decision ledger vs the earlier draft:
 *   • Drop the 3px left-edge tone strip (too loud) → use a small inline
 *     tone dot next to the trust pill instead.
 *   • Drop the inset trust-card with bar + giant number (visually
 *     heavy, ate 30% of the card height) → inline trust pill in the
 *     header, with a thin progress bar tucked under the pill.
 *   • Drop the 4-cell divide-x stat grid (harsh visual breaks) →
 *     single metadata strip with `·` separators (Linear / Cursor /
 *     Vercel pattern).
 *   • Stats become tone-colored numbers inline in the strip — the
 *     reader still scans "anomalies: 3" in warning hue without the
 *     grid chrome around it.
 */
function AgentCard({
  agent,
}: {
  agent: {
    name: string;
    runs: number;
    anomalies: number;
    approvals: number;
    denies: number;
    rewrites: number;
    lastSeen: string;
    connectors: string[];
    repos: string[];
    trust: number;
    quarantineReason: string | null;
    mature: boolean;
  };
}) {
  const trustPct = Math.round(agent.trust * 100);
  const trustTone =
    agent.trust >= BAND_DEFS.trusted.min
      ? { label: 'Trusted', color: 'var(--success)', bg: 'rgba(31, 193, 107, 0.12)' }
      : agent.trust >= BAND_DEFS.watching.min
        ? { label: 'Watching', color: 'var(--warning-dark)', bg: 'rgba(246, 181, 30, 0.14)' }
        : { label: 'Quarantine', color: 'var(--error)', bg: 'rgba(251, 55, 72, 0.10)' };

  return (
    <motion.article
      variants={fadeUpSm}
      // Lift handled by Framer Motion (GPU-composited translate3d under
      // the hood) instead of CSS `hover:-translate-y` to avoid the
      // subpixel-rendering jank that hits on dense card grids. Same
      // pattern as the Connectors catalog cards. Shadow + border tone
      // still transition via CSS because they're paint-channel
      // properties and don't need GPU compositing. The two timings are
      // intentionally close (220ms CSS, 260ms Framer) so the cosmetic
      // settle lands a frame before the motion completes.
      whileHover={{
        y: -3,
        transition: { duration: 0.26, ease: [0.32, 0.72, 0.32, 1] },
      }}
      whileTap={{
        y: -1,
        transition: { duration: 0.12, ease: [0.4, 0, 0.2, 1] },
      }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-[12px] border bg-white p-4',
        'shadow-[0_1px_2px_rgba(23,23,23,0.04)]',
        'border-[var(--stroke-soft-200)]',
        'transition-[box-shadow,border-color] duration-[220ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        'hover:border-[var(--primary-base)]/30',
        'hover:shadow-[0_12px_28px_rgba(23,23,23,0.07),0_2px_8px_rgba(250,115,25,0.06)]',
      )}
    >
      {/* Header — avatar + name + inline trust pill on the right.
          Mirrors the Fingerprint team-list row + Cursor member tile
          shape: a quiet header that lets the metadata strip below do
          the information work. */}
      <div className="flex items-start gap-3">
        <AgentMark name={agent.name} size="md" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/dashboard/agents/${encodeURIComponent(agent.name)}`}
            className="truncate text-[14px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)] hover:text-[var(--primary-base)]"
          >
            <h3 className="truncate">
              {agent.name}
            </h3>
          </Link>
          <p className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-[var(--neutral-soft-400)]">
            <span>Last seen</span>
            <RelativeTime
              timestamp={agent.lastSeen}
              className="tabular-nums text-[11.5px] text-[var(--neutral-soft-400)]"
            />
          </p>
        </div>
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
                {trustPct} of 100
              </span>
            </span>
          }
          side="top"
          delayMs={120}
        >
          <span
            tabIndex={0}
            className="inline-flex shrink-0 cursor-help items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-24)]"
            style={{ backgroundColor: trustTone.bg, color: trustTone.color }}
          >
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: trustTone.color }}
            />
            <span className="uppercase tracking-[0.04em]">{trustTone.label}</span>
            <span aria-hidden className="opacity-50">·</span>
            <span className="tabular-nums">{trustPct}</span>
          </span>
        </Tooltip>
      </div>

      {/* Trust progress bar — tucked under the header, thin hairline,
          tone-colored. Provides a glanceable "how trusted" cue without
          a whole inset card. */}
      <div className="mt-3 flex items-center gap-2">
        <div
          aria-hidden
          className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--neutral-weak-50)] ring-1 ring-[var(--stroke-soft-200)]"
        >
          <span
            className="block h-full rounded-full transition-[width] duration-300 ease-out"
            style={{
              width: `${trustPct}%`,
              backgroundColor: trustTone.color,
            }}
          />
        </div>
        {!agent.mature && (
          <Tooltip
            content={
              <span className="block max-w-[220px] whitespace-normal text-[11.5px] font-medium leading-[1.45] text-white">
                Baseline is still learning. Need {MATURE_BASELINE_RUNS}+
                scored runs before this score is stable.
              </span>
            }
            side="top"
            delayMs={120}
          >
            <span
              tabIndex={0}
              className="inline-flex cursor-help items-center gap-1 rounded-[4px] bg-[var(--neutral-weak-50)] px-1.5 py-[2px] text-[9.5px] font-bold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]"
            >
              Learning
            </span>
          </Tooltip>
        )}
      </div>

      {/* Inline metadata strip — single calm row of "label: value"
          pairs separated by tone-faded dots. Linear / Cursor /
          Vercel pattern. Tone is carried by the VALUE color when
          the metric is non-zero; the label stays neutral. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--stroke-soft-200)] pt-3 text-[11.5px] text-[var(--neutral-soft-400)]">
        <span className="inline-flex items-center gap-1">
          <span className="text-[10.5px] uppercase tracking-[0.04em]">Runs</span>
          <span className="font-semibold tabular-nums text-[var(--neutral-strong-950)]">
            {agent.runs.toLocaleString()}
          </span>
        </span>
        {agent.anomalies > 0 && (
          <>
            <span aria-hidden className="text-[var(--stroke-sub-300)]">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-[10.5px] uppercase tracking-[0.04em]">Flagged</span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: 'var(--warning-dark)' }}
              >
                {agent.anomalies.toLocaleString()}
              </span>
            </span>
          </>
        )}
        {agent.approvals > 0 && (
          <>
            <span aria-hidden className="text-[var(--stroke-sub-300)]">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-[10.5px] uppercase tracking-[0.04em]">Approvals</span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: 'var(--primary-base)' }}
              >
                {agent.approvals.toLocaleString()}
              </span>
            </span>
          </>
        )}
        {agent.denies > 0 && (
          <>
            <span aria-hidden className="text-[var(--stroke-sub-300)]">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-[10.5px] uppercase tracking-[0.04em]">Denies</span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: 'var(--error)' }}
              >
                {agent.denies.toLocaleString()}
              </span>
            </span>
          </>
        )}
      </div>

      {/* Connector strip + drill-in link.
          Each connector logo now sits inside its own avatar-styled
          sticker — 22×22 white pill with a hairline ring + soft drop
          shadow, carrying the brand SVG at 12px. Pattern mirrors the
          ConnectorMark sticker treatment used in the catalog; here
          it's miniaturised to live cleanly in a dense row. Slight
          horizontal overlap (-ml-1.5) on stickers past the first
          gives the standard "avatar stack" silhouette familiar from
          GitHub contributor strips and Linear assignee groups. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--stroke-soft-200)] pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-[var(--neutral-soft-400)]">
          {agent.connectors.length > 0 ? (
            <>
              <span className="inline-flex items-center">
                {agent.connectors.slice(0, 6).map((c, i) => (
                  <span
                    key={c}
                    aria-hidden
                    className={cn(
                      'relative inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[var(--stroke-soft-200)]',
                      'shadow-[0_1px_3px_rgba(23,23,23,0.08),0_1px_1px_rgba(23,23,23,0.04)]',
                      i > 0 && '-ml-1.5',
                    )}
                    style={{ zIndex: 10 - i }}
                  >
                    <ConnectorIcon
                      id={c as Parameters<typeof ConnectorIcon>[0]['id']}
                      size={12}
                    />
                  </span>
                ))}
              </span>
              <span className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--neutral-soft-400)]">
                {agent.connectors.length > 6
                  ? `${agent.connectors.length} surfaces`
                  : `${agent.connectors.length} ${agent.connectors.length === 1 ? 'surface' : 'surfaces'}`}
              </span>
            </>
          ) : (
            <span className="text-[10.5px] italic uppercase tracking-[0.04em]">
              No tool usage yet
            </span>
          )}
        </div>
        <Link
          href={`/dashboard/sessions?agent=${encodeURIComponent(agent.name)}`}
          className="group/link inline-flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-[var(--neutral-sub-600)] transition-colors duration-150 hover:text-[var(--primary-base)]"
        >
          Sessions
          <ArrowUpRight
            className="h-3 w-3 transition-transform group-hover/link:-translate-y-px group-hover/link:translate-x-px"
            strokeWidth={2}
          />
        </Link>
      </div>

      {/* Quarantine banner — only renders when this agent has been
          quarantined by the trust system. Shows the human-readable
          reason + a Review & restore CTA. Makes the trust system
          tangible on the demo. */}
      {agent.quarantineReason && (
        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[8px] border px-3 py-2"
          style={{
            backgroundColor: 'rgba(251, 55, 72, 0.08)',
            borderColor: 'rgba(251, 55, 72, 0.28)',
          }}
        >
          <div className="flex min-w-0 items-start gap-2">
            <span
              className="mt-0.5 inline-flex h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: 'var(--error)' }}
              aria-hidden
            />
            <div className="min-w-0">
              <p
                className="text-[10.5px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: 'var(--error)' }}
              >
                Quarantined
              </p>
              <p className="mt-0.5 text-[11.5px] leading-[1.4] text-[var(--neutral-strong-950)]">
                {agent.quarantineReason}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="shrink-0 rounded-[6px] border border-[var(--stroke-sub-300)] bg-[var(--white-0)] px-2.5 py-1 text-[11px] font-semibold text-[var(--neutral-strong-950)] transition-colors hover:bg-[var(--neutral-weak-50)]"
          >
            Review &amp; restore
          </button>
        </div>
      )}
    </motion.article>
  );
}

