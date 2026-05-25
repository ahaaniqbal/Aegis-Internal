export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

/**
 * The canonical 10 semantic_types produced by Layer 2 (Contextual
 * Intelligence Layer / Semantic Classifier). Each maps deterministically
 * to a decision via the classifier rules. Backend `semantic_classifier.py`
 * is the source of truth.
 */
export type SemanticType =
  | 'working_commit'           // ALLOW — agent committing to its own aegis-managed branch
  | 'ephemeral_force_push'     // ALLOW — force push to aegis_workstation by session owner, no open PR
  | 'test_only_change'         // ALLOW — diff touches only test/docs files
  | 'protected_branch_write'   // REWRITE — write to main/master/release branch
  | 'freeze_window_violation'  // DENY — write during active freeze window
  | 'credential_exposure'      // DENY (hard) — payload contains secrets pattern
  | 'large_blast_radius_change'// REQUIRE_APPROVAL — diff touches > threshold files, not test-only
  | 'sensitive_path_change'    // REQUIRE_APPROVAL — path matches .github/workflows, infra/, terraform/, auth/, security/
  | 'autonomous_merge_attempt' // DENY — merge call without human PR approval
  | 'sequence_anomaly';        // REQUIRE_APPROVAL — push_count > 5 AND ci_failure_streak > 3

/** Canonical blast_radius values from the Layer 2 classifier. */
export type BlastRadiusLevel = 'minimal' | 'low' | 'medium' | 'high' | 'critical';

/**
 * SessionContext — the agent's recent history in this session.
 * One of the four context structs Layer 2 assembles before classification.
 * Snapshot stored at decision time so the audit trail captures exactly
 * what the classifier saw.
 */
export interface SessionContextSnapshot {
  session_id?: string;
  agent_id?: string;
  agent_name?: string;
  human_initiator?: string | null;
  started_at?: string;
  push_count?: number;
  denial_count?: number;
  ci_failure_streak?: number;
  sequence_order?: number;
  linked_ticket?: string | null;
  workflow_stage?: 'planning' | 'coding' | 'review' | 'deploy' | 'incident';
  active_approval_count?: number;
  last_action_type?: string;
}

/** RepoContext — the state of the target repository right now. */
export interface RepoContextSnapshot {
  repo_id?: string;
  owner?: string;
  target_branch?: string;
  is_protected_branch?: boolean;
  protected_branches?: string[];
  ci_passing?: boolean;
  ci_failure_reason?: string | null;
  freeze_window_active?: boolean;
  freeze_window_label?: string | null;
  freeze_window_expires?: string | null;
  open_pr_count?: number;
  last_deployment_at?: string | null;
  sensitivity_level?: 'standard' | 'elevated' | 'critical';
}

/** BranchContext — the nature of this specific branch. */
export interface BranchContextSnapshot {
  branch_name?: string;
  is_aegis_managed?: boolean;
  session_owner_match?: boolean;
  has_open_pr?: boolean;
  pr_number?: number | null;
  pr_reviewers?: string[];
  branch_age_seconds?: number;
  commit_count_this_session?: number;
  last_pushed_by?: string | null;
}

/** EnvContext — deployment posture and incident state. */
export interface EnvContextSnapshot {
  environment_tier?: 'dev' | 'staging' | 'production';
  active_incident?: boolean;
  incident_id?: string | null;
  incident_severity?: 'p1' | 'p2' | 'p3' | null;
  within_business_hours?: boolean;
  timezone?: string;
  deploy_locked?: boolean;
}

export interface SessionAction {
  id: string;
  session_id: string;
  agent_name: string;
  tool_name: string;
  arguments: Record<string, any>;
  /** Human-readable bullet points; preferred over raw `arguments` in the UI when present. */
  action_pointers?: string[];
  action_summary: string;
  result: string;
  decision: "ALLOW" | "DENY" | "cd" | "REQUIRE_APPROVAL" | string;
  target_repo: string;
  target_branch: string | null;
  sequence_order: number;
  timestamp: string;
  user_id: string;
  execution_time: number;
  /**
   * Policy verdict for this action. `"pass"` when every policy check passed,
   * otherwise an enforced state (`"enforced"` / `"policy_enforced"` / etc.).
   * Stored as a free-form string so backend can evolve labels.
   */
  policy?: string | null;
  /**
   * Severity of the action if it were to take effect. Backend currently emits
   * `"Low" | "Medium" | "High" | "Critical"`. Field name preserves the
   * backend's spelling (`blast_redius`); also reads `blast_radius` for
   * forward-compat once the typo is corrected upstream.
   */
  blast_redius?: string | null;
  blast_radius?: string | null;
  /**
   * Contextual Intelligence Layer signals.
   *
   * `risk_score` — composite 0.0–1.0 score per action. Composed from
   * blast radius + anomaly distance + policy density. Surfaced in the
   * Runs table as a small bar / chip; ≥ 0.8 auto-routes to Approval.
   *
   * `anomaly` — whether this action falls outside its agent's
   * behavioral baseline (>2σ on token count, file count, or tool
   * sequence). Surfaces as an inline banner on the Runs row + on the
   * Dashboard "anomalies this week" stat.
   *
   * `anomaly_reason` — human-readable explanation when `anomaly` is
   * true. Reads as a sentence ("touched 47 files, baseline 3–7").
   *
   * All three are optional so legacy/real-mode data (without CIL
   * scoring yet) renders cleanly.
   */
  risk_score?: number | null;
  anomaly?: boolean;
  anomaly_reason?: string | null;
  /**
   * Agent delegation chain — the human + role + room scope the agent
   * was acting on behalf of when this action fired. Surfaces in the
   * Audit detail + Runs expanded row as identity-infrastructure
   * evidence: "this agent acted as Ahaan, with DEVELOPER role in the
   * aegis/dashboard room, with credentials expiring in 4h."
   *
   * Each entry is one link in the chain. Order: human → role → room.
   * Real backend can extend this (workspace, MCP session id, etc.).
   */
  delegation?: {
    /** Human display name acting through the agent. */
    user: string;
    /** Role the human held in the active room. */
    role: 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'REVIEWER' | 'VIEWER' | string;
    /** Repo / room scope this delegation is scoped to. */
    scope: string;
    /** Relative expiry string ("4h", "Mon 9am"). Mocked in demo. */
    expires_in?: string;
  } | null;
  /**
   * Canonical Layer 2 (CIL / Semantic Classifier) outputs. These are
   * the PRIMARY signals — `semantic_type` is what the policy engine
   * acts on, not the raw tool name. `blast_radius` and
   * `blast_radius_reason` carry the classifier's verdict and its
   * reasoning trace. Optional so legacy data without classifier
   * output still parses.
   *
   * Note: `anomaly` / `anomaly_reason` / `risk_score` above are the
   * BEHAVIORAL AMPLIFIER signals (Series-A roadmap). They sit on top
   * of the deterministic classifier; they are not the classifier
   * itself. The canonical moat lives in `semantic_type`.
   */
  semantic_type?: SemanticType | null;
  /**
   * Human-readable reasoning the classifier emits explaining WHY this
   * action got this semantic_type. Reads like an audit log line —
   * "Direct write to protected/default branch 'main'" or "Detected
   * exposed credentials: GitHub Token". Surfaced inline on Runs row
   * + as the deny_reason on DENY responses.
   */
  blast_radius_reason?: string | null;
  /**
   * Classifier confidence (0.0–1.0). Mostly 1.0 for rule-based hits;
   * lower for fallback / catch-all semantic_types.
   */
  classifier_confidence?: number | null;
  /**
   * The normalized canonical action type (`push_commit`,
   * `create_pull_request`, `terraform_apply`, etc.). This is what
   * makes policies portable across MCP servers — write a policy
   * against `terraform_destroy` once, applies to every connector
   * that produces that action type.
   */
  canonical_action_type?: string | null;
  /**
   * Snapshots of the 4 context structs at decision time. Stored so
   * the audit trail captures EXACTLY what the classifier saw. The
   * Approval detail page renders these as the reasoning trace.
   */
  session_context_snapshot?: SessionContextSnapshot | null;
  repo_context_snapshot?: RepoContextSnapshot | null;
  branch_context_snapshot?: BranchContextSnapshot | null;
  env_context_snapshot?: EnvContextSnapshot | null;
  /**
   * REWRITE-specific fields. When `decision === 'REWRITE'`, these
   * carry the auto-created branch + PR Aegis spawned to make the
   * agent's intent safe.
   */
  rewrite_target_branch?: string | null;
  rewrite_pr_url?: string | null;
  rewrite_pr_number?: number | null;
}

export interface AggregatedSessionAction {
  session_id: string;
  user_id: string;
  action_count: number;
  started_at: string;
  ended_at: string;
  total_execution_time: number;
  tools_used: string[];
  sessions: Array<SessionAction>;
  /**
   * Unique connector slugs this session touched, in first-seen order.
   * Powers the "tool journey" badges on the Sessions table row. Same
   * shape as `Session.connectors` — backend can compute either by
   * walking the session's action stream.
   */
  connectors?: string[];
  /**
   * Whether ANY action in this aggregated session was flagged
   * anomalous by the CIL. Used to surface a CIL chip on the session
   * row.
   */
  has_anomaly?: boolean;
  /**
   * Trigger that fired this session (chat / scheduled / webhook / test).
   * Mirrors `Session.trigger_type`; powers the trigger-type tabs on
   * the Sessions page.
   */
  trigger_type?: 'chat' | 'scheduled' | 'webhook' | 'test';
  /**
   * Unique semantic_types that fired during this session. Powers the
   * "CIL classifications in this session" surface on the Sessions
   * row + the CIL Insights distribution chart.
   */
  semantic_types?: SemanticType[];
  /**
   * Whether this session contains at least one REWRITE action. Used
   * to highlight sessions that demonstrate the REWRITE flow visibly.
   */
  has_rewrite?: boolean;
}

/**
 * One action in a room's audit log. Same shape as `SessionAction` plus the
 * room scope and the resolved `username` of the user that triggered the run.
 * Returned by `GET /sessions_by_room_id/{room_id}` (paginated).
 */
export interface RoomSessionAction extends SessionAction {
  room_id: string;
  /** Resolved display name of the user that initiated this action. */
  username?: string | null;
}

export type MCPApprovalStatus = "pending" | "approved" | "rejected" | string;

export interface MCPApproval {
  id: string;
  user_id: string;
  tool_name: string;
  arguments: Record<string, any>;
  status: MCPApprovalStatus;
  created_at: string;
  approved_at: string | null;
  result: any;
  context: Record<string, any>;
  action_summary: string;
  /**
   * Backend-supplied human-readable bullet points. For PR-related tools the
   * last entry typically contains the GitHub PR URL so reviewers can jump to
   * the PR before approving / denying.
   */
  action_pointers?: string[];
}

export interface Session {
  session_id: string;
  agent_name: string;
  action_count: number;
  started_at: string;
  last_action_at: string;
  repos: string[];
  allows: number;
  denies: number;
  rewrites: number;
  approvals: number;
  user_id: string;
  /**
   * Unique connector slugs this session touched, in first-seen order.
   * Powers the "tool journey" badges on the Sessions table row —
   * sessions that span 3+ connectors are the visible proof of the
   * control-plane claim. Real backend can compute this from the
   * session's action stream the same way the demo data does.
   */
  connectors?: string[];
  /**
   * Whether ANY action in this session was flagged anomalous by the
   * Contextual Intelligence Layer. Used to surface a CIL chip on the
   * session row.
   */
  has_anomaly?: boolean;
  /**
   * Where this session originated. Powers the trigger-type tabs on
   * the Sessions page (All / Chats / Scheduled / Webhook / Tests).
   *
   *   `chat`      — engineer interactively asked the agent for help.
   *   `scheduled` — cron-style trigger (nightly deploy, weekly sweep).
   *   `webhook`   — external event fired the session (alert, PR open).
   *   `test`      — CI / test-suite run that invoked the agent.
   *
   * Optional so legacy / pre-trigger data still parses cleanly.
   */
  trigger_type?: 'chat' | 'scheduled' | 'webhook' | 'test';
  /** Unique semantic_types that fired during this session. */
  semantic_types?: SemanticType[];
  /** Whether this session contains at least one REWRITE action. */
  has_rewrite?: boolean;
}

export interface User {
  id?: string; // UUID primary key from database
  github_user_id: number;
  username: string;
  email: string;
  created_at?: string;
  github_pat?: string;
  access_token?: string;
}

export interface RepoPermission {
  github_repo_id: number;
  can_read?: boolean;
  can_write?: boolean;
}

export interface Repo {
  repo_id: string;
  github_repo_id: number;
  full_name: string;
  name: string;
  is_private: boolean;
  can_read: boolean;
  can_write: boolean;
  granted_at?: string;
}

export interface Metrics {
  total: number;
  allows: number;
  denies: number;
  rewrites: number;
  approvals: number;
}

export interface TokenMeterResponse {
  id: string;
  action_id: string;
  user_id: string;
  input_token: number;
  output_token: number;
  session_id: string;
  timestamp?: string;
  created_at?: string;
}

export interface RoomSummary {
  id?: string;
  room_id?: string;

  repo_name: string;
  owner_username?: string;

  role?: string;
  is_active?: boolean;

  created_at?: string;
}
export interface RoomDetails extends RoomSummary {
  [key: string]: any;
}

export interface RoomMember {
  username: string;
  role?: string;
  joined_at?: string;

  [key: string]: any;
}

export interface RoomInvite {
  id?: string;
  invite_code?: string;
  code?: string;
  room_id?: string;
  created_by_username?: string;
  max_uses?: number | null;
  used_count?: number;
  expires_at?: string | null;
  created_at?: string;
  [key: string]: any;
}