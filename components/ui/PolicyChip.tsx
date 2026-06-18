'use client';

import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from './Badge';
import { formatPolicy } from '@/lib/utils';

interface PolicyChipProps {
  policy?: string | null;
  className?: string;
  /**
   * Kept for backwards-compat with callers that used to opt into an
   * em-dash placeholder. We now always render an empty cell instead —
   * Aegis copy never uses em dashes — but the prop signature is preserved
   * so existing callers don't need to be touched all at once.
   */
  showEmpty?: boolean;
}

/**
 * Compact pill for the per-action policy verdict.
 *
 *   pass     → green check shield (Policy passed, action allowed)
 *   enforced → amber alert shield (A named policy fired and gated the action)
 *   unknown  → renders nothing (empty cell)
 *
 * For `enforced` we show the actual policy name (e.g. "Protected merge",
 * "Branch policy", "Missing fields") so reviewers see WHICH policy fired,
 * not just that one did.
 */
export function PolicyChip({ policy, className }: PolicyChipProps) {
  const { status, label, tone } = formatPolicy(policy);

  if (status === 'unknown') return null;

  const Icon = status === 'pass' ? ShieldCheck : ShieldAlert;

  return (
    <Badge
      tone={tone}
      uppercase
      leadingIcon={<Icon className="h-3 w-3" strokeWidth={2.25} aria-hidden />}
      className={className}
      title={`Policy: ${label}`}
    >
      {label}
    </Badge>
  );
}
