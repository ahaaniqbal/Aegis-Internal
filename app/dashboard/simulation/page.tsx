'use client';

/**
 * Simulation Mode (a.k.a. Shadow Mode) — the GTM wedge.
 *
 * Teams install Aegis in observe-only mode. No actions are blocked;
 * Aegis watches, classifies, and logs every tool call. After 7 days
 * a Risk Report is generated showing what *would* have been denied,
 * what *would* have required approval, and which agents are highest
 * risk.
 *
 * This is the demo surface that opens the pre-commitment sales motion.
 * The backend wiring is roadmap (see `🗺️ Roadmap` NOW); this page is
 * the visible product surface that proves the wedge exists.
 *
 * Demo data is hard-coded since simulation mode isn't live yet — the
 * goal is to show prospects the SHAPE of the report they'd get.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  KeySquare,
  Lock,
  Play,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/Button';
import { IconMark } from '@/components/ui/IconMark';
import { SemanticTypeChip } from '@/components/ui/SemanticTypeChip';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';
import type { SemanticType } from '@/lib/types';

// Mock 7-day risk report data. Specific enough to look real, vague
// enough that no investor reads it as a customer leak.
const MOCK_REPORT = {
  windowStart: '2026-05-18T09:00:00.000Z',
  windowEnd: '2026-05-25T09:00:00.000Z',
  actionsObserved: 847,
  agentsActive: 11,
  toolsExercised: 23,
  wouldHaveDenied: 23,
  wouldHaveRequiredApproval: 67,
  rewriteOpportunities: 14,
  semanticTypeBreakdown: [
    // Sums match the metric cards above: 14 REWRITE + 67 APPROVAL + 23 DENY = 104.
    // Routine ALLOW makes up the remaining 743 actions (847 - 104).
    { type: 'protected_branch_write' as SemanticType, count: 14, severity: 'REWRITE' as const },
    { type: 'sensitive_path_change' as SemanticType, count: 28, severity: 'REQUIRE_APPROVAL' as const },
    { type: 'large_blast_radius_change' as SemanticType, count: 30, severity: 'REQUIRE_APPROVAL' as const },
    { type: 'sequence_anomaly' as SemanticType, count: 9, severity: 'REQUIRE_APPROVAL' as const },
    { type: 'freeze_window_violation' as SemanticType, count: 10, severity: 'DENY' as const },
    { type: 'credential_exposure' as SemanticType, count: 7, severity: 'DENY' as const },
    { type: 'autonomous_merge_attempt' as SemanticType, count: 6, severity: 'DENY' as const },
  ],
  riskiestAgents: [
    { name: 'claude-sonnet-4', actions: 412, wouldHaveDenied: 5, wouldHaveRequired: 18 },
    { name: 'cursor-agent', actions: 384, wouldHaveDenied: 4, wouldHaveRequired: 14 },
    { name: 'gpt-4o', actions: 287, wouldHaveDenied: 3, wouldHaveRequired: 9 },
    { name: 'replit-agent', actions: 156, wouldHaveDenied: 2, wouldHaveRequired: 6 },
  ],
  recommendedPolicies: [
    { id: 'T1', name: 'IaC Hard Lock', wouldHaveCaught: 3 },
    { id: 'P13', name: 'Environment Variable Blast Shield', wouldHaveCaught: 3 },
    { id: 'P12', name: 'Database Migration Gate', wouldHaveCaught: 4 },
    { id: 'P14', name: 'Git History Rewrite Prevention', wouldHaveCaught: 2 },
  ],
};

type SimulationStage = 'observe' | 'warn' | 'enforce';

export default function SimulationModePage() {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<SimulationStage>('observe');
  const [showStartDialog, setShowStartDialog] = useState(false);
  const router = useRouter();

  return (
    <>
      <Topbar
        title="Simulation Mode"
        subtitle="Shadow Mode · the GTM wedge"
      />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
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
            Simulation Mode · Shadow install
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
          >
            See what your agents are doing before you block anything
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-2 max-w-[680px] text-[13.5px] leading-[1.55] text-[var(--neutral-sub-600)]"
          >
            Install Aegis in observe-only mode in 15 minutes. No actions are blocked. Aegis watches every agent tool call, classifies it through the Contextual Intelligence Layer, and logs everything. After 7 days you get a Risk Report showing what would have been denied, what would have required approval, and which policies to enable first. Zero migration. Zero risk.
          </motion.p>
        </motion.header>

        {/* Mode progression — segmented pill control with state
            preview below. Reads as an operator dial, not a feature
            card grid. Pill = the control; preview = what's currently
            active. Inspired by Tailscale pill controls + Linear
            command-center clarity. */}
        <motion.section
          className="mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.16 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-5 py-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                Enforcement stage
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-[var(--neutral-sub-600)]">
                observe <span className="text-[var(--stroke-sub-300)]">→</span> warn <span className="text-[var(--stroke-sub-300)]">→</span> enforce
              </p>
            </div>
            {/* Segmented pill control */}
            <div
              role="radiogroup"
              aria-label="Enforcement stage"
              className="inline-flex items-center gap-0.5 rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-0.5"
            >
              <ModePill
                label="Observe"
                active={stage === 'observe'}
                onClick={() => setStage('observe')}
              />
              <ModePill
                label="Warn"
                active={stage === 'warn'}
                onClick={() => setStage('warn')}
              />
              <ModePill
                label="Enforce"
                active={stage === 'enforce'}
                onClick={() => setStage('enforce')}
              />
            </div>
          </div>

          {/* State preview row — three stacked lines describing what
              the selected mode actually does. Reads like a real
              product-state description, not a marketing tagline. */}
          <div className="grid grid-cols-1 divide-y divide-[var(--stroke-soft-200)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <ModeStateRow
              label="actions_blocked"
              value={stage === 'enforce' ? 'yes' : 'no'}
              ok={stage !== 'enforce'}
              warn={stage === 'enforce'}
            />
            <ModeStateRow
              label="warnings_surfaced"
              value={stage === 'observe' ? 'no' : 'yes'}
            />
            <ModeStateRow
              label="audit_trail_written"
              value="yes"
              ok
            />
          </div>

          {/* Mode description — single inline summary below the state row. */}
          <div className="border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-5 py-3">
            <p className="text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">
              {stage === 'observe' && (
                <>
                  <span className="font-semibold text-[var(--neutral-strong-950)]">Observe.</span>{' '}
                  Every action executes as normal. Aegis classifies, logs, and reports. Zero impact on agents. Use this for the 7-day Risk Report below.
                </>
              )}
              {stage === 'warn' && (
                <>
                  <span className="font-semibold text-[var(--neutral-strong-950)]">Warn.</span>{' '}
                  Aegis surfaces risky actions in real time as warnings. Still no blocking. Use this to calibrate policies before enforcement.
                </>
              )}
              {stage === 'enforce' && (
                <>
                  <span className="font-semibold text-[var(--neutral-strong-950)]">Enforce.</span>{' '}
                  Full governance active. DENY, REWRITE, and REQUIRE_APPROVAL decisions fire on every classified action. The product as designed.
                </>
              )}
            </p>
          </div>
        </motion.section>

        {/* Primary CTA strip */}
        <motion.section
          className="mb-8 overflow-hidden rounded-[12px] border border-[var(--primary-base)]/40 bg-[var(--primary-lighter)] px-5 py-4 shadow-[0_1px_2px_rgba(250,115,25,0.10)]"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.2 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--primary-dark)]">
                Get the 7-day Risk Report
              </p>
              <h2 className="mt-0.5 text-[15px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Install Aegis in observe mode. We'll send the report on day 7.
              </h2>
              <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                Point your agent's MCP config at Aegis. That's it. No SDK, no rewrite, no policy work.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                leadingIcon={<Play className="h-3.5 w-3.5" strokeWidth={2.25} />}
                onClick={() => setShowStartDialog(true)}
              >
                Start Shadow Mode
              </Button>
              <Button variant="secondary" leadingIcon={<Download className="h-3.5 w-3.5" strokeWidth={2} />}>
                Sample report
              </Button>
            </div>
          </div>
        </motion.section>

        {/* Sample report preview */}
        <motion.section
          className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.24 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-5 py-3">
            <div className="flex items-center gap-2.5">
              <IconMark icon={Shield} color="var(--primary-base)" strokeWidth={2.25} />
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                  Sample Agent Risk Report · 7-day window
                </p>
                <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  What Aegis would have done if enforce mode was on
                </h2>
              </div>
            </div>
            <span className="text-[11.5px] tabular-nums text-[var(--neutral-soft-400)]">
              May 18 → May 25, 2026
            </span>
          </div>

          {/* At-a-glance metrics */}
          <div className="grid grid-cols-2 divide-x divide-[var(--stroke-soft-200)] border-b border-[var(--stroke-soft-200)] lg:grid-cols-4">
            <ReportMetric label="Actions observed" value={MOCK_REPORT.actionsObserved.toLocaleString()} />
            <ReportMetric label="Would have denied" value={MOCK_REPORT.wouldHaveDenied} color="var(--error)" />
            <ReportMetric label="Would have required approval" value={MOCK_REPORT.wouldHaveRequiredApproval} color="var(--warning)" />
            <ReportMetric label="REWRITE opportunities" value={MOCK_REPORT.rewriteOpportunities} color="var(--primary-base)" />
          </div>

          {/* Semantic type breakdown */}
          <div className="border-b border-[var(--stroke-soft-200)] px-5 py-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
              semantic_type breakdown
            </p>
            <ul className="mt-3 space-y-2">
              {MOCK_REPORT.semanticTypeBreakdown.map((row) => (
                <li key={row.type} className="flex items-center gap-3">
                  <div className="w-[200px] shrink-0">
                    <SemanticTypeChip semantic_type={row.type} />
                  </div>
                  <span className="text-[12px] tabular-nums text-[var(--neutral-strong-950)]">
                    {row.count}
                  </span>
                  <span className="text-[11px] text-[var(--neutral-soft-400)]">
                    {row.count === 1 ? 'event' : 'events'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Riskiest agents */}
          <div className="border-b border-[var(--stroke-soft-200)] px-5 py-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
              Riskiest agents
            </p>
            <ul className="mt-3 space-y-2">
              {MOCK_REPORT.riskiestAgents.map((agent) => (
                <li key={agent.name} className="flex flex-wrap items-center justify-between gap-3 text-[12px]">
                  <span className="font-mono text-[12px] font-semibold text-[var(--neutral-strong-950)]">{agent.name}</span>
                  <div className="flex items-center gap-4 text-[11.5px] tabular-nums">
                    <span className="text-[var(--neutral-soft-400)]">{agent.actions} actions</span>
                    <span style={{ color: 'var(--error)' }}>{agent.wouldHaveDenied} would deny</span>
                    <span style={{ color: 'var(--warning-dark)' }}>{agent.wouldHaveRequired} would require approval</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Recommended policies */}
          <div className="px-5 py-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
              Recommended policies to enable first
            </p>
            <ul className="mt-3 space-y-2">
              {MOCK_REPORT.recommendedPolicies.map((policy) => (
                <li key={policy.id} className="flex items-center justify-between gap-3 text-[12px]">
                  <span className="flex items-center gap-2">
                    <code className="rounded bg-[var(--neutral-weak-50)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--neutral-strong-950)]">
                      {policy.id}
                    </code>
                    <span className="font-medium text-[var(--neutral-strong-950)]">{policy.name}</span>
                  </span>
                  <span className="text-[11.5px] tabular-nums text-[var(--neutral-soft-400)]">
                    Would have caught {policy.wouldHaveCaught}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </motion.section>

        {/* Why this exists */}
        <motion.section
          className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.3 }}
        >
          <FeatureNote
            icon={CheckCircle2}
            title="Zero risk to ship"
            body="Observe mode never blocks. Even if every agent fires at once, your prod stays exactly as it would without Aegis."
          />
          <FeatureNote
            icon={Clock}
            title="15-minute install"
            body="Point your agent's MCP endpoint at Aegis. No SDK, no rewrite, no policy work. The report writes itself."
          />
          <FeatureNote
            icon={KeySquare}
            title="Compliance evidence from day one"
            body="Every observed action lands in the immutable audit trail. Even in observe mode, you're already building SOC 2 evidence."
          />
        </motion.section>

        <p className="mt-8 text-center text-[12px] text-[var(--neutral-soft-400)]">
          Simulation Mode is the GTM entry point on the canonical Aegis roadmap. Backend wiring lands in the next sprint. The shape of the report above is what customers will see.
        </p>
      </div>

      {/* Start Shadow Mode dialog. Explains the three steps before sending
          the user into the Connect flow. Keeps the dead-button feel out
          and gives prospects a clear next step. */}
      <ConfirmDialog
        open={showStartDialog}
        onOpenChange={setShowStartDialog}
        title="Three steps to Shadow Mode"
        description={
          <div className="space-y-3 text-[13px] leading-[1.55] text-[var(--neutral-sub-600)]">
            <div className="flex gap-3">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary-base)] text-[10px] font-bold text-white">1</span>
              <span>Open a Room and copy its MCP endpoint URL from the Connect tab.</span>
            </div>
            <div className="flex gap-3">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary-base)] text-[10px] font-bold text-white">2</span>
              <span>Paste the URL into your agent's MCP config (Cursor, Claude Code, Codex, anywhere). Aegis observes silently — nothing gets blocked.</span>
            </div>
            <div className="flex gap-3">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary-base)] text-[10px] font-bold text-white">3</span>
              <span>Come back in seven days. Your Risk Report shows what would have been denied, what would have required approval, and which policies to enable first.</span>
            </div>
          </div>
        }
        confirmLabel="Go to Connect"
        cancelLabel="Not now"
        variant="primary"
        onConfirm={() => {
          setShowStartDialog(false);
          router.push('/dashboard/rooms');
        }}
      />
    </>
  );
}

/**
 * One segment in the enforcement-stage pill control. Compact, mono-cased,
 * active state uses brand orange tint + bold weight. Inspired by
 * Tailscale's pill buttons and Linear's segmented controls.
 */
function ModePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={[
        'inline-flex h-7 items-center rounded-[6px] px-3 text-[11.5px] font-semibold tracking-[-0.005em] transition-all duration-150',
        active
          ? 'bg-white text-[var(--primary-dark)] shadow-[0_1px_2px_rgba(23,23,23,0.06),0_0_0_1px_rgba(250,115,25,0.20)]'
          : 'text-[var(--neutral-sub-600)] hover:bg-white/60 hover:text-[var(--neutral-strong-950)]',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

/**
 * One key=value row in the Simulation Mode state preview strip. Shows
 * what the current mode means in concrete product terms. Mono key on
 * left, color-coded value on right (success green for ok, warning
 * amber for warn).
 */
function ModeStateRow({
  label,
  value,
  ok,
  warn,
}: {
  label: string;
  value: string;
  ok?: boolean;
  warn?: boolean;
}) {
  const valueColor = warn
    ? 'var(--warning-dark)'
    : ok
      ? 'var(--success)'
      : 'var(--neutral-strong-950)';
  return (
    <div className="px-5 py-3">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-[13px] font-bold tabular-nums" style={{ color: valueColor }}>
        {value}
      </p>
    </div>
  );
}

function ReportMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
        {label}
      </p>
      <p
        className="mt-1.5 text-[28px] font-bold leading-none tabular-nums"
        style={{ color: color ?? 'var(--neutral-strong-950)' }}
      >
        {value}
      </p>
    </div>
  );
}

function FeatureNote({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[10px] border border-[var(--stroke-soft-200)] bg-white p-4">
      <IconMark icon={Icon} color="var(--primary-base)" strokeWidth={2.25} />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
          {title}
        </p>
        <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
          {body}
        </p>
      </div>
    </div>
  );
}
