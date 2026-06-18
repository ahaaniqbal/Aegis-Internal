'use client';

import { Badge, type BadgeTone } from './Badge';

type DecisionStyle = { tone: BadgeTone; label: string };

const STYLES: Record<string, DecisionStyle> = {
  ALLOW:            { tone: 'success', label: 'ALLOW' },
  DENY:             { tone: 'error',   label: 'DENY' },
  REWRITE:          { tone: 'feature', label: 'REWRITE' },
  REQUIRE_APPROVAL: { tone: 'warning', label: 'APPROVAL' },
  PENDING:          { tone: 'warning', label: 'PENDING' },
  APPROVED:         { tone: 'success', label: 'APPROVED' },
  REJECTED:         { tone: 'error',   label: 'DENIED' },
  DENIED:           { tone: 'error',   label: 'DENIED' },
  ERROR:            { tone: 'neutral', label: 'ERROR' },
};

function resolve(decision: string): DecisionStyle {
  const upper = (decision ?? '').toUpperCase();
  if (STYLES[upper]) return STYLES[upper];
  if (upper.includes('APPROVAL')) return STYLES.REQUIRE_APPROVAL;
  if (upper.includes('ERROR')) return STYLES.ERROR;
  if (upper.includes('REWRITE')) return STYLES.REWRITE;
  return { tone: 'neutral', label: upper || 'UNKNOWN' };
}

interface DecisionBadgeProps {
  decision: string;
  /** kept for back-compat with existing call sites; size is fixed per spec. */
  size?: 'sm' | 'default';
  className?: string;
}

export default function DecisionBadge({ decision, className }: DecisionBadgeProps) {
  const style = resolve(decision);
  return (
    <Badge tone={style.tone} uppercase className={className}>
      {style.label}
    </Badge>
  );
}

/** Map a decision string to one of the Card accent severity tones. */
export function decisionAccent(decision: string):
  | 'success'
  | 'error'
  | 'warning'
  | 'feature'
  | 'neutral' {
  const upper = (decision ?? '').toUpperCase();
  if (upper === 'ALLOW') return 'success';
  if (upper === 'DENY' || upper === 'REJECTED' || upper === 'DENIED') return 'error';
  if (upper === 'REWRITE') return 'feature';
  if (upper.includes('APPROVAL') || upper === 'PENDING') return 'warning';
  return 'neutral';
}

/** Map a decision string to its semantic color CSS variable. */
export function decisionColor(decision: string): string {
  const upper = (decision ?? '').toUpperCase();
  if (upper === 'ALLOW' || upper === 'APPROVED') return 'var(--success)';
  if (upper === 'DENY' || upper === 'REJECTED' || upper === 'DENIED') return 'var(--error)';
  if (upper === 'REWRITE') return 'var(--feature)';
  if (upper.includes('APPROVAL') || upper === 'PENDING') return 'var(--warning)';
  return 'var(--neutral-soft-400)';
}
