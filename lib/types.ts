export interface SessionAction {
  id: string;
  session_id: string;
  agent_name: string;
  tool_name: string;
  arguments: Record<string, any>;
  action_summary: string;
  result: string;
  decision: 'ALLOW' | 'DENY' | 'REWRITE' | 'REQUIRE_APPROVAL' | string;
  target_repo: string;
  target_branch: string;
  sequence_order: number;
  timestamp: string;
  user_id: string;
}

export type MCPApprovalStatus = 'pending' | 'approved' | 'rejected' | string;

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

export interface RoomSummary {
  id?: string;
  room_id?: string;
  repo_id: string;
  owner_id?: string;
  created_at?: string;
}

export interface RoomDetails extends RoomSummary {
  [key: string]: any;
}

export interface RoomMember {
  id?: string;
  user_id: string;
  username?: string;
  role?: string;
  joined_at?: string;
  [key: string]: any;
}

export interface RoomInvite {
  id?: string;
  invite_code?: string;
  code?: string;
  room_id?: string;
  created_by?: string;
  max_uses?: number | null;
  used_count?: number;
  expires_at?: string | null;
  created_at?: string;
  [key: string]: any;
}
