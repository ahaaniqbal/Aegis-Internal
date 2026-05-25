'use client';

/**
 * SemanticTypeChip — surfaces the canonical Layer 2 (CIL) output on
 * any run / audit / session / approval row. Shows the specific
 * `semantic_type` the classifier assigned to the action, tone-coded
 * by the resulting decision (ALLOW / DENY / REWRITE / REQUIRE_APPROVAL).
 *
 * This is the PRIMARY signal the customer should see. The classifier's
 * verdict is the moat — surfacing it inline turns Aegis from "binary
 * firewall" into "context-aware governance engine" in the customer's
 * eyes.
 *
 * Pair with `<BlastRadiusChip>` and the legacy `<AnomalyChip>` (which
 * now represents the secondary behavioral-amplifier signal from the
 * Series-A roadmap) for a full row signal stack.
 *
 * Visual treatment:
 *   ALLOW types         → neutral / muted (working_commit, test_only_change, ephemeral_force_push)
 *   REWRITE             → brand-orange tint (protected_branch_write) — the differentiator
 *   DENY                → error-red (freeze_window_violation, credential_exposure, autonomous_merge_attempt)
 *   REQUIRE_APPROVAL    → warning-amber (sensitive_path_change, large_blast_radius_change, sequence_anomaly)
 */

import { ShieldCheck, AlertTriangle, GitBranch, Lock, KeySquare, FileWarning, Layers, GitMerge, Activity, FileCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SemanticType } from '@/lib/types';
import { Tooltip } from '@/components/ui/Tooltip';
import { IconMark } from '@/components/ui/IconMark';

/** Display configuration per semantic_type. Centralized so every
 *  surface (Runs row, Sessions row, Approval detail, CIL Insights,
 *  Audit) reads the same vocabulary. */
const SEMANTIC_TYPE_CONFIG: Record<
  SemanticType,
  {
    label: string;
    decision: 'ALLOW' | 'DENY' | 'REWRITE' | 'REQUIRE_APPROVAL';
    icon: LucideIcon;
    tone: 'neutral' | 'success' | 'warning' | 'error' | 'primary';
    description: string;
  }
> = {
  working_commit: {
    label: 'working commit',
    decision: 'ALLOW',
    icon: GitBranch,
    tone: 'neutral',
    description: 'Routine commit by the session owner to a working branch. No protected-branch or freeze flags fired.',
  },
  ephemeral_force_push: {
    label: 'ephemeral force-push',
    decision: 'ALLOW',
    icon: ShieldCheck,
    tone: 'success',
    description: 'Force-push to aegis_workstation by the session owner. No open PR. Safe by classification.',
  },
  test_only_change: {
    label: 'test-only change',
    decision: 'ALLOW',
    icon: FileCheck,
    tone: 'success',
    description: 'Diff touches only paths matching tests/, docs/, or spec/. Routine ALLOW.',
  },
  protected_branch_write: {
    label: 'protected branch write',
    decision: 'REWRITE',
    icon: GitBranch,
    tone: 'primary',
    description: 'Direct write to a protected branch. Aegis rewrote into a feature branch and opened a PR automatically.',
  },
  freeze_window_violation: {
    label: 'freeze window violation',
    decision: 'DENY',
    icon: Lock,
    tone: 'error',
    description: 'Write attempted during an active freeze window. Hard DENY before payload reaches downstream MCP.',
  },
  credential_exposure: {
    label: 'credential exposure',
    decision: 'DENY',
    icon: KeySquare,
    tone: 'error',
    description: 'Payload contains a recognized credential pattern (API key, token, secret). Hard pre-policy DENY.',
  },
  large_blast_radius_change: {
    label: 'large blast radius',
    decision: 'REQUIRE_APPROVAL',
    icon: Layers,
    tone: 'warning',
    description: 'Diff exceeds the blast-radius threshold (50+ files / multi-package). Routed to human approval.',
  },
  sensitive_path_change: {
    label: 'sensitive path change',
    decision: 'REQUIRE_APPROVAL',
    icon: FileWarning,
    tone: 'warning',
    description: 'Write to a sensitive path (.github/workflows, infra/, terraform/, auth/, security/). Routed to human approval.',
  },
  autonomous_merge_attempt: {
    label: 'autonomous merge attempt',
    decision: 'DENY',
    icon: GitMerge,
    tone: 'error',
    description: 'merge_pull_request called without recorded human PR approval. Hard DENY per P4.',
  },
  sequence_anomaly: {
    label: 'sequence anomaly',
    decision: 'REQUIRE_APPROVAL',
    icon: Activity,
    tone: 'warning',
    description: 'Agent has pushed multiple times this session with consecutive CI failures. Paused for review.',
  },
};

interface SemanticTypeChipProps {
  semantic_type?: SemanticType | null;
  /** The classifier's human-readable reasoning. Surfaced on hover. */
  reason?: string | null;
  /** Visual density. `compact` (default) for inline rows; `full` for
   *  the row-level banner that wraps in a callout box. */
  variant?: 'compact' | 'full';
  className?: string;
}

/** Per-tone Tailwind classes. Kept in a single map so changes propagate
 *  uniformly across every surface that uses this chip. */
const TONE_CLASSES: Record<
  'neutral' | 'success' | 'warning' | 'error' | 'primary',
  { bg: string; border: string; text: string; iconColor: string; tooltipAccent: string }
> = {
  neutral: {
    bg: 'rgba(160, 160, 160, 0.10)',
    border: 'rgba(160, 160, 160, 0.30)',
    text: 'var(--neutral-sub-600)',
    iconColor: 'var(--neutral-sub-600)',
    tooltipAccent: '#cbcbcb',
  },
  success: {
    bg: 'rgba(56, 199, 109, 0.12)',
    border: 'rgba(56, 199, 109, 0.32)',
    text: '#1f7a3e',
    iconColor: '#1f7a3e',
    tooltipAccent: '#7be0a5',
  },
  warning: {
    bg: 'rgba(246, 181, 30, 0.14)',
    border: 'rgba(246, 181, 30, 0.32)',
    text: 'var(--warning-dark)',
    iconColor: 'var(--warning-dark)',
    tooltipAccent: '#ffd268',
  },
  error: {
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.32)',
    text: 'var(--error)',
    iconColor: 'var(--error)',
    tooltipAccent: '#ff9a9a',
  },
  primary: {
    bg: 'rgba(250, 115, 25, 0.12)',
    border: 'rgba(250, 115, 25, 0.36)',
    text: 'var(--primary-dark)',
    iconColor: 'var(--primary-base)',
    tooltipAccent: '#ffb98a',
  },
};

export function SemanticTypeChip({
  semantic_type,
  reason,
  variant = 'compact',
  className,
}: SemanticTypeChipProps) {
  if (!semantic_type) return null;
  const cfg = SEMANTIC_TYPE_CONFIG[semantic_type];
  if (!cfg) return null;
  const tone = TONE_CLASSES[cfg.tone];
  const Icon = cfg.icon;
  const finalReason = reason ?? cfg.description;

  if (variant === 'full') {
    return (
      <div
        className="flex items-start gap-3 rounded-[10px] border px-3.5 py-3"
        style={{
          borderColor: tone.border,
          backgroundColor: tone.bg,
        }}
      >
        <IconMark icon={Icon} color={tone.iconColor} />
        <div className="min-w-0">
          <p className="flex items-baseline gap-2">
            <code
              className="font-mono text-[12px] font-bold tracking-[-0.005em]"
              style={{ color: tone.text }}
            >
              {semantic_type}
            </code>
            <span
              className="font-mono text-[9.5px] font-bold uppercase tracking-[0.12em]"
              style={{ color: tone.text }}
            >
              · {cfg.decision}
            </span>
          </p>
          <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--neutral-strong-950)]">
            {finalReason}
          </p>
        </div>
      </div>
    );
  }

  // Render the actual snake_case semantic_type value, not the human
  // label. Fingerprint pattern: show the technical token verbatim so
  // engineers and auditors immediately recognize what fired.
  const chip = (
    <span
      role="status"
      tabIndex={0}
      aria-label={`semantic_type: ${semantic_type}. ${finalReason}`}
      className={[
        'inline-flex h-[18px] items-center gap-1.5 rounded-[4px] border px-1.5',
        'font-mono text-[10.5px] font-semibold tracking-[-0.005em]',
        'cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-24)]',
        className ?? '',
      ].join(' ')}
      style={{
        backgroundColor: tone.bg,
        borderColor: tone.border,
        color: tone.text,
      }}
    >
      <Icon className="h-2.5 w-2.5" strokeWidth={2.5} style={{ color: tone.iconColor }} />
      {semantic_type}
    </span>
  );

  return (
    <Tooltip
      content={
        <span className="block max-w-[320px] whitespace-normal text-[11.5px] font-medium leading-[1.45] text-white">
          <span className="block">
            <code className="font-mono text-[11px] font-bold" style={{ color: tone.tooltipAccent }}>
              {semantic_type}
            </code>
            <span
              className="ml-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em]"
              style={{ color: tone.tooltipAccent }}
            >
              · {cfg.decision}
            </span>
          </span>
          <span className="mt-1.5 block font-medium text-white/90">{finalReason}</span>
        </span>
      }
      side="top"
      delayMs={120}
    >
      {chip}
    </Tooltip>
  );
}

/** Exported config for surfaces that need the label or decision mapping
 *  outside of the chip render (e.g. CIL Insights distribution chart). */
export { SEMANTIC_TYPE_CONFIG };
