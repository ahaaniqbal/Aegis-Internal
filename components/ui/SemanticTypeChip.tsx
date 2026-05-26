'use client';

import { Badge } from './Badge';
import { formatSemanticType } from '@/lib/utils';

interface SemanticTypeChipProps {
  /** Free-form semantic type from the backend. Maps to a fixed enum (see `normalizeSemanticType`). */
  value?: string | null;
  className?: string;
  /**
   * Kept for backwards-compat with callers that used to opt into an
   * em-dash placeholder. We always render an empty cell instead, since
   * Aegis copy never uses em dashes.
   */
  showEmpty?: boolean;
}

/**
 * Color-coded chip for the per-action `semantic_type`.
 *
 *   test_only_change         → green   (safe)
 *   working_commit           → neutral (routine)
 *   ephemeral_force_push     → amber   (risky pattern)
 *   protected_branch_write   → amber   (gated)
 *   autonomous_merge_attempt → amber   (autonomous)
 *   large_blast_radius_change → orange (wide impact)
 *   sensitive_path_change    → orange  (sensitive code)
 *   credential_exposure      → red     (security)
 *   freeze_window_violation  → red     (policy violation)
 *   sequence_anomaly         → red     (anomalous behavior)
 *   unknown / empty          → renders nothing
 */
export function SemanticTypeChip({ value, className }: SemanticTypeChipProps) {
  const { type, label, tone } = formatSemanticType(value);

  if (type === 'unknown' && !value) return null;

  return (
    <Badge
      tone={tone}
      leadingDot
      className={className}
      title={`Semantic type: ${label}`}
    >
      {label}
    </Badge>
  );
}
