'use client';

/**
 * AnomalyChip — surfaces CIL (Contextual Intelligence Layer) signals on
 * any run / audit / session row. Shows a small warning chip when an
 * action falls outside the agent's behavioral baseline. Hovering the
 * chip reveals the anomaly_reason in an AlignUI tooltip.
 *
 * The chip is intentionally restrained visually (small, warning-tinted)
 * so it doesn't compete with the decision badge or the blast radius
 * chip. It reads as "second-pass intelligence noticed something" — a
 * complement to the policy verdict, not a replacement.
 *
 * Pair with `<RiskScoreBar>` to give the row a full risk profile.
 */

import { AlertTriangle } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { IconMark } from '@/components/ui/IconMark';

interface AnomalyChipProps {
  /** Whether CIL flagged this action as anomalous. Falsy → renders null. */
  anomaly?: boolean | null;
  /** Human-readable reason. Required when `anomaly` is true. */
  reason?: string | null;
  /** Visual density. `compact` (default) for inline table cells; `full`
   *  for the row-level banner that wraps the chip in a callout box. */
  variant?: 'compact' | 'full';
  className?: string;
}

export function AnomalyChip({
  anomaly,
  reason,
  variant = 'compact',
  className,
}: AnomalyChipProps) {
  if (!anomaly) return null;

  if (variant === 'full') {
    return (
      <div
        className="flex items-start gap-3 rounded-[10px] border px-3.5 py-3"
        style={{
          borderColor: 'rgba(246, 181, 30, 0.32)',
          backgroundColor: 'rgba(246, 181, 30, 0.06)',
        }}
      >
        {/* Canonical IconMark — warning-hued AlertTriangle inside the
            concentric ring sticker. Reads as part of the dashboard's
            unified icon family. */}
        <IconMark icon={AlertTriangle} color="var(--warning-dark)" />
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-[var(--warning-dark)]">
            CIL flag · behavioral baseline
          </p>
          {reason && (
            <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--neutral-strong-950)]">
              {reason}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Compact: inline chip with tooltip carrying the reason. Labeled
  // "CIL Flag" not "Anomaly" — anomaly reads as a system alert, but
  // CIL is the product name and grounds the chip in the moat story.
  // Two letters shorter, more brand-specific, more memorable.
  const chip = (
    <span
      role="status"
      tabIndex={0}
      aria-label={reason ? `CIL flag: ${reason}` : 'CIL flag'}
      className={[
        'inline-flex h-[18px] items-center gap-1 rounded-[5px] px-1.5',
        'text-[10px] font-bold uppercase tracking-[0.06em]',
        'cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-24)]',
        'border border-[rgba(246,181,30,0.32)]',
        className ?? '',
      ].join(' ')}
      style={{
        backgroundColor: 'rgba(246, 181, 30, 0.14)',
        color: 'var(--warning-dark)',
      }}
    >
      <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2.75} />
      CIL flag
    </span>
  );

  if (!reason) return chip;
  return (
    <Tooltip
      content={
        <span className="block max-w-[280px] whitespace-normal text-[11.5px] font-medium leading-[1.45] text-white">
          <span className="block font-semibold uppercase tracking-[0.08em]" style={{ color: '#ffd268' }}>
            CIL flag
          </span>
          <span className="mt-1 block font-medium text-white/90">{reason}</span>
        </span>
      }
      side="top"
      delayMs={120}
    >
      {chip}
    </Tooltip>
  );
}

/**
 * RiskScoreBar — small horizontal bar showing a 0.0–1.0 risk score.
 * Color shifts from green (low) → amber (medium) → red (high) to
 * match the row's blast-radius cue.
 *
 * Goes in a dedicated Runs column right after Blast Radius. Lets a
 * reviewer scan a long table and immediately spot the rows worth
 * looking at.
 */
export function RiskScoreBar({
  score,
  className,
}: {
  score?: number | null;
  className?: string;
}) {
  if (score == null) return null;
  const clamped = Math.max(0, Math.min(1, score));
  const pct = Math.round(clamped * 100);

  // Color band: low (green) → medium (amber) → high (red).
  // Bands tuned to align with blast-radius bands (the two surfaces
  // share visual language — green ≈ Low, amber ≈ High, red ≈ Critical).
  const color =
    clamped >= 0.75
      ? 'var(--error)'
      : clamped >= 0.45
        ? 'var(--warning)'
        : 'var(--success)';

  return (
    <Tooltip
      content={
        <span className="block text-[11.5px] font-medium leading-[1.45]">
          <span className="block font-semibold uppercase tracking-[0.08em]" style={{ color: '#ffd268' }}>
            CIL risk score
          </span>
          <span className="mt-1 block tabular-nums text-white/90">
            {clamped.toFixed(2)} of 1.00
            <span className="ml-1 opacity-60">· {pct}%</span>
          </span>
        </span>
      }
      side="top"
      delayMs={120}
    >
      <span
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`CIL risk score ${clamped.toFixed(2)} of 1.00`}
        tabIndex={0}
        className={[
          'inline-flex w-[68px] items-center gap-1.5 cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-24)] rounded',
          className ?? '',
        ].join(' ')}
      >
        <span
          aria-hidden
          className="relative inline-block h-[5px] flex-1 overflow-hidden rounded-full bg-[var(--neutral-weak-50)] ring-1 ring-[var(--stroke-soft-200)]"
        >
          <span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${pct}%`,
              backgroundColor: color,
            }}
          />
        </span>
        <span className="shrink-0 text-[10.5px] font-bold tabular-nums" style={{ color }}>
          {clamped.toFixed(2)}
        </span>
      </span>
    </Tooltip>
  );
}
