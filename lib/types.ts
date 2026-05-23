export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
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