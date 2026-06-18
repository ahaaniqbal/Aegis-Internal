import type { SessionAction } from './types';

const KNOWN_KEYS = new Set([
  'id',
  'session_id',
  'agent_name',
  'tool_name',
  'arguments',
  'action_pointers',
  'action_summary',
  'result',
  'decision',
  'target_repo',
  'target_branch',
  'sequence_order',
  'user_id',
  'timestamp',
  'execution_time',
]);

/**
 * Stable, API-shaped record for audit JSON/PDF exports and integrations.
 * Omits empty `action_pointers`; includes explicit nulls for nullable API fields.
 */
export function toCanonicalSessionAction(action: SessionAction): Record<string, unknown> {
  const row = action as unknown as Record<string, unknown>;
  const pointers = action.action_pointers;
  const base: Record<string, unknown> = {
    id: action.id,
    session_id: action.session_id,
    agent_name: action.agent_name ?? null,
    tool_name: action.tool_name ?? null,
    arguments: action.arguments ?? {},
    action_summary: action.action_summary ?? null,
    result: action.result ?? null,
    decision: action.decision ?? null,
    target_repo: action.target_repo ?? null,
    target_branch: action.target_branch ?? null,
    sequence_order: action.sequence_order ?? null,
    user_id: action.user_id ?? null,
    timestamp: action.timestamp ?? null,
    execution_time: action.execution_time ?? null,
  };
  if (Array.isArray(pointers) && pointers.length > 0) {
    base.action_pointers = pointers;
  }
  const extras: Record<string, unknown> = {};
  for (const k of Object.keys(row)) {
    if (!KNOWN_KEYS.has(k)) extras[k] = row[k];
  }
  const sortedExtraEntries = Object.keys(extras)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => [k, extras[k]] as const);
  for (const [k, v] of sortedExtraEntries) {
    base[k] = v;
  }
  return base;
}

/** Subset shown in Runs/Sessions/Audit “View raw JSON” only (exports use {@link toCanonicalSessionAction}). */
export function toSessionActionRawJsonView(action: SessionAction): Record<string, unknown> {
  return {
    agent_name: action.agent_name ?? null,
    tool_name: action.tool_name ?? null,
    arguments: action.arguments ?? {},
    result: action.result ?? null,
    target_repo: action.target_repo ?? null,
    target_branch: action.target_branch ?? null,
  };
}

export function sortSessionActionsDesc(a: SessionAction, b: SessionAction): number {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
}