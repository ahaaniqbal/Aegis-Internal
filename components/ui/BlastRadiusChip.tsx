'use client';

import { Badge } from './Badge';
import { formatBlastRadius } from '@/lib/utils';

interface BlastRadiusChipProps {
  /** Free-form severity from the backend, typically Low / Medium / High / Critical. */
  value?: string | null;
  className?: string;
  /**
   * Kept for backwards-compat with callers that used to opt into an
   * em-dash placeholder. We now always render an empty cell instead, since
   * Aegis copy never uses em dashes. Signature preserved so existing
   * callers don't need to be touched all at once.
   */
  showEmpty?: boolean;
}

/**
 * Color-coded severity pill for `blast_redius`.
 *
 *   low      → green
 *   medium   → amber
 *   high     → orange (primary)
 *   critical → red
 *   unknown  → renders nothing (empty cell)
 */
export function BlastRadiusChip({ value, className }: BlastRadiusChipProps) {
  const { level, label, tone } = formatBlastRadius(value);

  if (level === 'unknown') return null;

  return (
    <Badge
      tone={tone}
      uppercase
      leadingDot
      className={className}
      title={`Blast radius: ${label}`}
    >
      {label}
    </Badge>
  );
}
