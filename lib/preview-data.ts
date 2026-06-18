/**
 * Preview-mode data shim — installs fake responses on the `api` singleton
 * so the dashboard renders fully-populated in design review without a
 * backend. Idempotent — safe to call on every render. Real production code
 * paths are untouched unless `aegis_preview` is on.
 */

import { api } from './api';
import type {
  AggregatedSessionAction,
  MCPApproval,
  Metrics,
  PaginatedResponse,
  Repo,
  RoomDetails,
  RoomInvite,
  RoomMember,
  RoomSessionAction,
  RoomSummary,
  Session,
  SessionAction,
  TokenMeterResponse,
} from './types';

// ── deterministic PRNG so render is stable across re-mounts ────────────────
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x4ae9_15);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const pickW = <T,>(arr: readonly { value: T; weight: number }[]): T => {
  const total = arr.reduce((s, x) => s + x.weight, 0);
  let r = rand() * total;
  for (const x of arr) {
    if ((r -= x.weight) <= 0) return x.value;
  }
  return arr[arr.length - 1].value;
};
const uuid = (() => {
  let n = 0;
  return () => {
    n += 1;
    const h = (rand() * 0xffffffff).toString(16).padStart(8, '0');
    return `${h.slice(0, 8)}-${h.slice(0, 4)}-4${h.slice(1, 4)}-a${h.slice(0, 3)}-${(Date.now() + n).toString(16).padStart(12, '0').slice(0, 12)}`;
  };
})();

// ── data dictionaries ──────────────────────────────────────────────────────
const AGENTS = [
  'claude-sonnet-4',
  'gpt-4o',
  'cursor-agent',
  'windsurf-cascade',
  'devin',
  'aider',
  'github-copilot',
  'replit-agent',
];

const REPOS = [
  'aegis/dashboard',
  'aegis/mcp-server',
  'aegis/marketing',
  'runaegis/api',
  'runaegis/integrations',
  'jenilparmar/playground',
];

const BRANCHES = [
  'main',
  'develop',
  'feature/auth-flow',
  'feature/rate-limits',
  'fix/approval-race',
  'aegis/sess_8f3a/refactor-policies',
  'aegis/sess_b21c/add-webhooks',
  'chore/dependency-bump',
];

const TOOLS = [
  'create_or_update_file',
  'get_file_contents',
  'list_repository_files',
  'push_files',
  'search_repositories',
  'get_repository',
  'create_issue',
  'get_issue',
  'list_issues',
  'create_pull_request',
  'get_pull_request',
  'search_code',
  'search_issues',
  'get_latest_commit',
  'list_branches',
  'create_branch',
];

const ACTION_PHRASES = [
  'Open a pull request to refactor the approval queue handler',
  'Push a fix for the race condition in policy evaluation',
  'Read the README to understand repository layout',
  'List all open issues tagged `bug` for triage',
  'Create a feature branch from main',
  'Search the codebase for usages of the deprecated `evaluatePolicy` helper',
  'Add a webhook payload signing test',
  'Update README with the new MCP endpoint URL',
  'Comment on PR #142 with review notes',
  'Get the latest commit hash for the release branch',
  'Rename the `aegis_temp` table per migration plan',
  'Bump `motion` from 12.37 to 12.38',
  'Add the JetBrains Mono font import',
  'Remove an unused getInitials call from Topbar',
  'Patch the rate limiter to use Redis instead of in-memory',
  'Pull the latest schema for the audit table',
];

const DECISIONS = [
  { value: 'ALLOW',            weight: 60 },
  { value: 'REWRITE',          weight: 14 },
  { value: 'REQUIRE_APPROVAL', weight: 12 },
  { value: 'DENY',             weight: 14 },
] as const;

// ── Policy + blast-radius pickers ─────────────────────────────────────────
//
// Backend policy values are either `pass` (no policy fired) or the *name*
// of the policy that fired (e.g. `PROTECTED_MERGE`). Demo data correlates
// the policy choice with the decision so prospects see realistic patterns:
// DENY rows always show a named policy, ALLOW rows mostly show `pass`,
// REQUIRE_APPROVAL leans into the gating policies (Protected merge,
// Branch policy, Freeze window).

const HARD_POLICIES = [
  'PROTECTED_MERGE',
  'PROTECTED_BRANCH',
  'SECRET_SCAN',
  'FREEZE_WINDOW',
] as const;

const SOFT_POLICIES = [
  'BRANCH_POLICY',
  'MISSING_FIELDS',
  'LARGE_DIFF',
] as const;

function policyForDecision(decision: string): string {
  const r = rand();
  switch (decision) {
    case 'ALLOW':
      // Mostly pass, occasional informational soft policy that still allowed.
      return r < 0.7 ? 'pass' : pick(SOFT_POLICIES);
    case 'REWRITE':
      // The rewrite is usually triggered by a soft policy (e.g. missing
      // fields auto-filled) or a hard policy that we could rewrite around.
      return r < 0.65 ? pick(SOFT_POLICIES) : pick(HARD_POLICIES);
    case 'REQUIRE_APPROVAL':
      // Approval is almost always gated by a hard policy.
      return r < 0.8 ? pick(HARD_POLICIES) : pick(SOFT_POLICIES);
    case 'DENY':
      // Denied actions almost always tripped a hard policy.
      return r < 0.85 ? pick(HARD_POLICIES) : pick(SOFT_POLICIES);
    default:
      return 'pass';
  }
}

// Blast radius distributions per decision. Indexed-pick using cumulative
// weights so the math stays in one place.
const BLAST_WEIGHTS: Record<string, ReadonlyArray<{ value: string; weight: number }>> = {
  ALLOW:            [{ value: 'Low', weight: 70 }, { value: 'Medium', weight: 25 }, { value: 'High', weight: 5  }],
  REWRITE:          [{ value: 'Low', weight: 50 }, { value: 'Medium', weight: 40 }, { value: 'High', weight: 10 }],
  REQUIRE_APPROVAL: [{ value: 'Low', weight: 5  }, { value: 'Medium', weight: 40 }, { value: 'High', weight: 40 }, { value: 'Critical', weight: 15 }],
  DENY:             [{ value: 'Low', weight: 5  }, { value: 'Medium', weight: 20 }, { value: 'High', weight: 35 }, { value: 'Critical', weight: 40 }],
};

function blastRadiusForDecision(decision: string): string {
  const table = BLAST_WEIGHTS[decision] ?? BLAST_WEIGHTS.ALLOW;
  return pickW(table);
}

const APPROVAL_STATUSES = [
  { value: 'pending',  weight: 6 },
  { value: 'approved', weight: 3 },
  { value: 'rejected', weight: 2 },
] as const;

// ── generators ─────────────────────────────────────────────────────────────
const NOW = Date.now();
const ONE_DAY = 24 * 60 * 60 * 1000;

// Generate session IDs first so we can group runs into sessions of varying length.
const SESSION_IDS = Array.from({ length: 14 }, () => uuid());

function makeRun(seq: number): SessionAction {
  const ageDays = rand() ** 1.7 * 14; // bias toward recent
  const timestamp = new Date(NOW - ageDays * ONE_DAY).toISOString();
  const agent = pick(AGENTS);
  const tool = pick(TOOLS);
  const repo = pick(REPOS);
  const branch = pick(BRANCHES);
  const decision = pickW(DECISIONS);
  const sessionId = pick(SESSION_IDS);
  const args =
    tool === 'create_pull_request'
      ? { repo, title: 'Open PR for fix', base: 'main', head: branch }
      : tool === 'create_or_update_file'
      ? { repo, path: 'src/index.ts', branch, message: 'chore: update' }
      : tool === 'search_code'
      ? { q: 'evaluatePolicy', repo }
      : { repo, branch };

  return {
    id: uuid(),
    session_id: sessionId,
    agent_name: agent,
    tool_name: tool,
    arguments: args,
    action_summary: pick(ACTION_PHRASES),
    result: decision,
    decision,
    target_repo: repo,
    target_branch: branch,
    sequence_order: seq,
    timestamp,
    user_id: 'preview-user',
    execution_time: Math.floor(80 + rand() * rand() * 6500),
    // Risk signal — correlated with decision so demo mode shows the same
    // patterns prospects would see in a real workspace. PolicyChip +
    // BlastRadiusChip read these on the Runs / Sessions / Room Logs pages.
    policy: policyForDecision(decision),
    blast_redius: blastRadiusForDecision(decision),
  };
}

const RUNS: SessionAction[] = Array.from({ length: 96 }, (_, i) => makeRun(i + 1)).sort(
  (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
);

// Aggregate sessions from runs
function aggregateSessions(runs: SessionAction[]): Session[] {
  const map = new Map<string, Session>();
  for (const r of runs) {
    const sid = r.session_id;
    if (!map.has(sid)) {
      map.set(sid, {
        session_id: sid,
        agent_name: r.agent_name,
        user_id: 'preview-user',
        action_count: 0,
        started_at: r.timestamp,
        last_action_at: r.timestamp,
        repos: [],
        allows: 0,
        denies: 0,
        rewrites: 0,
        approvals: 0,
      });
    }
    const s = map.get(sid)!;
    s.action_count = Number(s.action_count) + 1;
    if (r.timestamp < s.started_at!) s.started_at = r.timestamp;
    if (r.timestamp > s.last_action_at!) s.last_action_at = r.timestamp;
    if (r.target_repo && !(s.repos as string[]).includes(r.target_repo)) {
      (s.repos as string[]).push(r.target_repo);
    }
    const d = r.decision?.toUpperCase() || '';
    if (d === 'ALLOW') s.allows = Number(s.allows) + 1;
    else if (d === 'DENY') s.denies = Number(s.denies) + 1;
    else if (d === 'REWRITE') s.rewrites = Number(s.rewrites) + 1;
    if (d.includes('APPROVAL')) s.approvals = Number(s.approvals) + 1;
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.last_action_at!).getTime() - new Date(a.last_action_at!).getTime(),
  );
}

const SESSIONS: Session[] = aggregateSessions(RUNS);

// Approvals
const APPROVALS: MCPApproval[] = Array.from({ length: 11 }, (_, i) => {
  const status = pickW(APPROVAL_STATUSES);
  const ageHours = rand() * 72;
  const created_at = new Date(NOW - ageHours * 60 * 60 * 1000).toISOString();
  const approved_at =
    status === 'pending'
      ? null
      : new Date(NOW - ageHours * 60 * 60 * 1000 + rand() * 60 * 60 * 1000).toISOString();
  const agent = pick(AGENTS);
  const repo = pick(REPOS);
  const branch = pick(BRANCHES);
  const tool = pick(TOOLS);
  return {
    id: `apv_${i}_${uuid()}`,
    user_id: 'preview-user',
    tool_name: tool,
    arguments: { repo, branch, base: 'main', title: pick(ACTION_PHRASES) },
    status,
    created_at,
    approved_at,
    result: null,
    context: { user: agent, conversation_id: `conv_${uuid().slice(0, 6)}`, model: agent },
    action_summary: pick(ACTION_PHRASES),
  };
}).sort(
  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
);

// Repos
const FULL_REPO_NAMES = [
  'aegis/dashboard',
  'aegis/mcp-server',
  'aegis/marketing',
  'aegis/cli',
  'aegis/policies',
  'aegis/sdk-js',
  'aegis/sdk-python',
  'runaegis/api',
  'runaegis/integrations',
  'runaegis/website',
  'jenilparmar/playground',
  'jenilparmar/snippets',
];

const PREVIEW_REPOS: Repo[] = FULL_REPO_NAMES.map((name, i) => ({
  repo_id: `repo_${i}`,
  github_repo_id: 100000 + i,
  full_name: name,
  name,
  is_private: i % 3 === 0,
  can_read: i < 8,                 // first 8 readable
  can_write: i < 5 && i % 2 === 0, // sparse write
  granted_at: new Date(NOW - i * ONE_DAY).toISOString(),
}));

// Token meter usage — one record per run-ish
const TOKEN_METER: TokenMeterResponse[] = RUNS.slice(0, 60).map((r, i) => ({
  id: `tm_${i}`,
  action_id: r.id,
  user_id: 'preview-user',
  input_token: Math.floor(200 + rand() * 4500),
  output_token: Math.floor(100 + rand() * 2500),
  session_id: r.session_id,
  timestamp: r.timestamp,
  created_at: r.timestamp,
}));

// Rooms
const PREVIEW_ROOMS: RoomSummary[] = [
  { id: 'room_dash',  room_id: 'room_dash',  repo_name: 'aegis/dashboard',  owner_username: 'preview-user', created_at: new Date(NOW - 12 * ONE_DAY).toISOString() },
  { id: 'room_mcp',   room_id: 'room_mcp',   repo_name: 'aegis/mcp-server', owner_username: 'preview-user', created_at: new Date(NOW - 30 * ONE_DAY).toISOString() },
  { id: 'room_api',   room_id: 'room_api',   repo_name: 'runaegis/api',     owner_username: 'preview-user', created_at: new Date(NOW -  5 * ONE_DAY).toISOString() },
];

const PREVIEW_ROOM_DETAILS: Record<string, RoomDetails> = Object.fromEntries(
  PREVIEW_ROOMS.map((r) => [r.room_id!, { ...r }]),
);

const PREVIEW_MEMBERS: Record<string, RoomMember[]> = {
  room_dash: [
    { id: 'm1', user_id: 'preview-user', username: 'demo',  role: 'OWNER',     joined_at: new Date(NOW - 12 * ONE_DAY).toISOString() },
    { id: 'm2', user_id: 'u_kai',        username: 'kai',      role: 'DEVELOPER', joined_at: new Date(NOW - 10 * ONE_DAY).toISOString() },
    { id: 'm3', user_id: 'u_sora',       username: 'sora',     role: 'REVIEWER',  joined_at: new Date(NOW -  9 * ONE_DAY).toISOString() },
    { id: 'm4', user_id: 'u_lin',        username: 'lin',      role: 'VIEWER',    joined_at: new Date(NOW -  6 * ONE_DAY).toISOString() },
  ],
  room_mcp: [
    { id: 'm5', user_id: 'preview-user', username: 'demo',  role: 'OWNER',     joined_at: new Date(NOW - 30 * ONE_DAY).toISOString() },
    { id: 'm6', user_id: 'u_amir',       username: 'amir',     role: 'DEVELOPER', joined_at: new Date(NOW - 28 * ONE_DAY).toISOString() },
  ],
  room_api: [
    { id: 'm7', user_id: 'preview-user', username: 'demo',  role: 'OWNER',     joined_at: new Date(NOW - 5 * ONE_DAY).toISOString() },
  ],
};

const PREVIEW_INVITES: Record<string, RoomInvite[]> = {
  room_dash: [
    { id: 'inv1', invite_code: 'aeg-dash-fern',  room_id: 'room_dash', created_by: 'preview-user', max_uses: 5,    used_count: 2, expires_at: new Date(NOW + 7 * ONE_DAY).toISOString(),  created_at: new Date(NOW - 2 * ONE_DAY).toISOString() },
    { id: 'inv2', invite_code: 'aeg-dash-moss',  room_id: 'room_dash', created_by: 'preview-user', max_uses: null, used_count: 0, expires_at: null,                                       created_at: new Date(NOW - 1 * ONE_DAY).toISOString() },
  ],
  room_mcp: [
    { id: 'inv3', invite_code: 'aeg-mcp-ridge',  room_id: 'room_mcp',  created_by: 'preview-user', max_uses: 10,   used_count: 1, expires_at: new Date(NOW + 14 * ONE_DAY).toISOString(), created_at: new Date(NOW - 6 * ONE_DAY).toISOString() },
  ],
  room_api: [],
};

// ── Per-room activity (audit log used by the room's Activity tab) ─────────
//
// Each entry is a RoomSessionAction — the same shape as a SessionAction
// but with `room_id` + `username` resolved server-side. We pin the repo
// to the room's repo so it's coherent (a row in `room_dash` always says
// "aegis/dashboard", not a random repo) and pick the user from the room's
// member list so usernames are believable for the team that lives there.
//
// Volume is tuned per room so the demo feels lived-in:
//   room_dash (busiest, 4 members) → ~50 actions
//   room_mcp  (medium, 2 members)  → ~24 actions
//   room_api  (newest, 1 member)   → ~9 actions

function makeRoomAction(
  roomId: string,
  repo: string,
  members: RoomMember[],
  seq: number,
): RoomSessionAction {
  // Re-pick the underlying randoms so each room action gets its own
  // random tool/decision/timing rather than inheriting from RUNS.
  const ageDays = rand() ** 1.6 * 14;
  const timestamp = new Date(NOW - ageDays * ONE_DAY).toISOString();
  const agent = pick(AGENTS);
  const tool = pick(TOOLS);
  const branch = pick(BRANCHES);
  const decision = pickW(DECISIONS);
  const sessionId = pick(SESSION_IDS);
  const member = pick(members);

  const args =
    tool === 'create_pull_request'
      ? { repo, title: 'Open PR for fix', base: 'main', head: branch }
      : tool === 'create_or_update_file'
      ? { repo, path: 'src/index.ts', branch, message: 'chore: update' }
      : tool === 'search_code'
      ? { q: 'evaluatePolicy', repo }
      : { repo, branch };

  return {
    id: uuid(),
    session_id: sessionId,
    agent_name: agent,
    tool_name: tool,
    arguments: args,
    action_summary: pick(ACTION_PHRASES),
    result: decision,
    decision,
    target_repo: repo,
    target_branch: branch,
    sequence_order: seq,
    timestamp,
    user_id: member.user_id ?? member.username ?? 'preview-user',
    execution_time: Math.floor(80 + rand() * rand() * 6500),
    policy: policyForDecision(decision),
    blast_redius: blastRadiusForDecision(decision),
    room_id: roomId,
    username: member.username,
  };
}

// Build all rooms' activity once at module init so re-renders are stable.
const PREVIEW_ROOM_ACTIONS: Record<string, RoomSessionAction[]> = (() => {
  const out: Record<string, RoomSessionAction[]> = {};
  // Volume tuned per room — busier rooms get richer logs.
  const VOLUMES: Record<string, number> = {
    room_dash: 50,
    room_mcp: 24,
    room_api: 9,
  };
  for (const room of PREVIEW_ROOMS) {
    const id = room.room_id!;
    const repo = room.repo_name;
    const members = PREVIEW_MEMBERS[id] ?? [];
    const count = VOLUMES[id] ?? 12;
    const actions = Array.from({ length: count }, (_, i) =>
      makeRoomAction(id, repo, members, i + 1),
    ).sort(
      // Newest first — matches the order the table renders by default.
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    out[id] = actions;
  }
  return out;
})();

// Default tool policy per role — mostly true, a few false to add nuance.
const PREVIEW_ROOM_TOOLS: Record<string, Record<string, boolean>> = {
  DEVELOPER: Object.fromEntries(TOOLS.map((t) => [t, !t.includes('search_issues')])),
  REVIEWER:  Object.fromEntries(TOOLS.map((t) => [t, !['push_files', 'create_or_update_file', 'create_branch'].includes(t)])),
  VIEWER:    Object.fromEntries(TOOLS.map((t) => [t, t.startsWith('get_') || t.startsWith('list_') || t.startsWith('search_')])),
  OWNER:     Object.fromEntries(TOOLS.map((t) => [t, true])),
};

// Freeze windows
const PREVIEW_FREEZE_WINDOWS = [
  {
    id: 'fw_1',
    user_id: 'preview-user',
    timezone: 'America/New_York',
    work_days: [0, 1, 2, 3, 4],
    window_start: '17:00:00',
    window_end: '23:59:00',
    created_at: new Date(NOW - 20 * ONE_DAY).toISOString(),
  },
  {
    id: 'fw_2',
    user_id: 'preview-user',
    timezone: 'Asia/Kolkata',
    work_days: [5, 6],
    window_start: '00:00:00',
    window_end: '23:59:00',
    created_at: new Date(NOW - 5 * ONE_DAY).toISOString(),
  },
];

// Computed metrics
function computeMetrics(runs: SessionAction[]): Metrics {
  return {
    total: runs.length,
    allows:    runs.filter((r) => r.decision === 'ALLOW').length,
    denies:    runs.filter((r) => r.decision === 'DENY').length,
    rewrites:  runs.filter((r) => r.decision === 'REWRITE').length,
    approvals: runs.filter((r) => r.decision === 'REQUIRE_APPROVAL').length,
  };
}

const METRICS = computeMetrics(RUNS);

// ── install ────────────────────────────────────────────────────────────────
let installed = false;

export function installPreviewApi() {
  if (installed) return;
  installed = true;

  api.healthCheck = async () => ({ ok: true, mode: 'preview' });

  // Sign-out — real impl swallows network errors but still pings the
  // backend. In preview we skip that ping entirely and just clear the
  // local user cache, matching the real cleanup behavior. The
  // Sidebar / UserMenu / Settings sign-out flows continue to redirect
  // to /auth after this resolves.
  api.logOut = async () => {
    try {
      localStorage.removeItem('aegis_user');
      localStorage.removeItem('aegis_onboarding_step');
    } catch {
      // ignore — localStorage may be unavailable in embedded contexts
    }
  };

  api.getRuns           = async () => RUNS;
  api.getSessions       = async () => SESSIONS;
  api.getMetrics        = async () => METRICS;

  // Paginated variants — these are what `DashboardDataProvider` calls
  // on mount for every dashboard route. Without these mocks, the
  // provider's `sessionActions` stays empty across navigations and
  // every page downstream (/runs, /sessions, /audit, etc.) renders
  // empty even though preview mode is on. The Dashboard home page is
  // the one exception because it reads from `api.getRuns` directly,
  // bypassing the paginated context — that's why ONLY Dashboard
  // appeared populated before this fix.
  api.getSessionActionsPage = async (_userId, page = 1, page_size = 20) => {
    const start = (page - 1) * page_size;
    const items = RUNS.slice(start, start + page_size);
    return {
      items,
      total: RUNS.length,
      page,
      page_size,
      pages: Math.max(1, Math.ceil(RUNS.length / page_size)),
    };
  };

  // Aggregated sessions — same paginated shape but with the session-level
  // aggregate plus the constituent runs inlined (`sessions` array). The
  // Sessions page renders the parent row from the aggregate and the
  // expanded child rows from `sessions[]`.
  api.getAggregatedSessions = async (_userId, page = 1, page_size = 20) => {
    const aggregated: AggregatedSessionAction[] = SESSIONS.map((s) => {
      const sessionRuns = RUNS.filter((r) => r.session_id === s.session_id);
      const execTimes = sessionRuns.map((r) => r.execution_time ?? 0);
      const tools = Array.from(new Set(sessionRuns.map((r) => r.tool_name)));
      return {
        session_id: s.session_id,
        user_id: 'preview-user',
        action_count: sessionRuns.length,
        started_at: s.started_at ?? sessionRuns[sessionRuns.length - 1]?.timestamp ?? new Date().toISOString(),
        ended_at: s.last_action_at ?? sessionRuns[0]?.timestamp ?? new Date().toISOString(),
        total_execution_time: execTimes.reduce((a, b) => a + b, 0),
        tools_used: tools,
        sessions: sessionRuns,
      };
    });
    const start = (page - 1) * page_size;
    const items = aggregated.slice(start, start + page_size);
    return {
      items,
      total: aggregated.length,
      page,
      page_size,
      pages: Math.max(1, Math.ceil(aggregated.length / page_size)),
    };
  };
  api.getSessionActions = async (sessionId: string) =>
    RUNS.filter((r) => r.session_id === sessionId).sort(
      (a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0),
    );
  api.getApprovals      = async () => RUNS.filter((r) => r.decision.includes('APPROVAL'));
  api.getMcpApprovals   = async () => APPROVALS;
  api.executeMcpApproval = async (id: string, reject: boolean) => {
    const a = APPROVALS.find((x) => x.id === id);
    if (a) {
      a.status = reject ? 'rejected' : 'approved';
      a.approved_at = new Date().toISOString();
    }
    return { success: true };
  };
  api.getAuditTrail = async (_uid?: string, limit = 50, offset = 0) =>
    RUNS.slice(offset, offset + limit);
  api.getAuditTrailByDateRange = async (
    _uid: string,
    startDate: string,
    endDate: string,
  ) => {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return RUNS.filter((r) => {
      const t = new Date(r.timestamp).getTime();
      return t >= start && t <= end;
    });
  };
  api.getRecentActionCount = async () => [{ count: RUNS.slice(0, 3).length }];

  api.getUserTokenUsage = async () => ({
    items: TOKEN_METER,
    total: TOKEN_METER.length,
    page: 1,
    page_size: TOKEN_METER.length,
    pages: 1,
  });

  api.getUserTokenUsageAll = async () => [...TOKEN_METER];

  api.getRepos = async () => ({ repos: PREVIEW_REPOS });
  api.syncRepos = async () => ({ success: true, synced: PREVIEW_REPOS.length });
  api.setPermission = async () => ({ success: true });
  api.setPermissions = async () => ({ success: true });

  api.getUserPolicy = async () => '1111111101'; // 9 of 10 armed by default
  api.upsertUserPolicy = async () => undefined;

  api.getMyRooms = async () => PREVIEW_ROOMS;
  api.getRoomDetails = async (roomId: string) =>
    PREVIEW_ROOM_DETAILS[roomId] ?? PREVIEW_ROOMS[0];
  api.getRoomMembers = async (roomId: string) => PREVIEW_MEMBERS[roomId] ?? [];
  api.getRoomInvites = async (roomId: string) => PREVIEW_INVITES[roomId] ?? [];
  // Activity tab inside a room. Returns paginated `RoomSessionAction[]`
  // pinned to that room — same shape as the real endpoint
  // `GET /sessions_by_room_id/{room_id}` Jenil shipped.
  api.getSessionsByRoomId = async (
    roomId: string,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedResponse<RoomSessionAction>> => {
    const all = PREVIEW_ROOM_ACTIONS[roomId] ?? [];
    const total = all.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), pages);
    const start = (safePage - 1) * pageSize;
    const items = all.slice(start, start + pageSize);
    return { items, total, page: safePage, page_size: pageSize, pages };
  };
  api.getRoomTools = async (_roomId: string, role: string) =>
    PREVIEW_ROOM_TOOLS[role] ?? PREVIEW_ROOM_TOOLS.DEVELOPER;
  api.updateRoomTools = async () => ({ success: true });
  // Room MCP integration URL — rendered into the copyable Integration
  // field on the rooms page. Without this mock the Promise.all on
  // /dashboard/rooms rejects and the whole detail panel goes empty.
  // Format mirrors the real shape: a stable per-room slug + opaque token.
  api.getRoomIntegrationConfig = async (roomId: string) => ({
    url: `https://mcp.runaegis.co/r/${roomId}/aeg_${roomId.replace('room_', '')}_preview_token`,
  });
  // Create a room AND seed it correctly into the in-memory mock store
  // so the user-just-created flow works end-to-end:
  //   • getMyRooms() returns the new room (so the RoomSwitcher + index
  //     show it immediately)
  //   • getRoomDetails(newId) returns the right repo (not PREVIEW_ROOMS[0]
  //     fallback)
  //   • getRoomMembers(newId) returns the creator as OWNER (so the demo
  //     user shows as OWNER in the room header, NOT the DEVELOPER fallback
  //     RoomContext was resolving to)
  //   • role: 'OWNER' on the returned summary so RoomContext picks it up
  //     immediately without a refetch race
  // Net effect: creating a new room surfaces all OWNER-only affordances
  // (Generate invite, etc.) the same way the seeded demo rooms do.
  api.createRoom = async (repoId: string) => {
    const newId = `room_${Date.now()}`;
    const createdAt = new Date().toISOString();
    const newRoom: RoomSummary = {
      id: newId,
      room_id: newId,
      repo_name: repoId,
      owner_username: 'demo',
      role: 'OWNER',
      created_at: createdAt,
    };
    PREVIEW_ROOMS.push(newRoom);
    PREVIEW_ROOM_DETAILS[newId] = { ...newRoom };
    PREVIEW_MEMBERS[newId] = [
      {
        id: `m_${Date.now()}`,
        user_id: 'preview-user',
        username: 'demo',
        role: 'OWNER',
        joined_at: createdAt,
      },
    ];
    PREVIEW_INVITES[newId] = [];
    PREVIEW_ROOM_ACTIONS[newId] = [];
    return newRoom;
  };
  // Create an invite AND persist it into PREVIEW_INVITES so a refetch
  // of getRoomInvites(roomId) actually returns the new row. Without
  // the push, the Members tab's "Active invites" list stayed empty
  // after Generate, even though the toast claimed success.
  api.createRoomInvite = async (_roomId, payload) => {
    const newInvite: RoomInvite = {
      id: `inv_${Date.now()}`,
      invite_code: `aeg-${Math.random().toString(36).slice(2, 8)}`,
      room_id: _roomId,
      max_uses: payload.max_uses ?? null,
      used_count: 0,
      expires_at: payload.expires_at ?? null,
      created_at: new Date().toISOString(),
    };
    if (!PREVIEW_INVITES[_roomId]) PREVIEW_INVITES[_roomId] = [];
    PREVIEW_INVITES[_roomId].unshift(newInvite);
    return newInvite;
  };
  api.joinRoom = async () => ({ success: true });

  api.getFreezeWindows = async () => PREVIEW_FREEZE_WINDOWS;
  api.createFreezeWindow = async (payload: any) => {
    const fw = { id: `fw_${Date.now()}`, user_id: 'preview-user', created_at: new Date().toISOString(), ...payload };
    PREVIEW_FREEZE_WINDOWS.push(fw);
    return fw;
  };
  api.updateFreezeWindow = async (id: string, payload: any) => {
    const idx = PREVIEW_FREEZE_WINDOWS.findIndex((w) => w.id === id);
    if (idx >= 0) Object.assign(PREVIEW_FREEZE_WINDOWS[idx], payload);
    return PREVIEW_FREEZE_WINDOWS[idx];
  };
  api.deleteFreezeWindow = async (id: string) => {
    const idx = PREVIEW_FREEZE_WINDOWS.findIndex((w) => w.id === id);
    if (idx >= 0) PREVIEW_FREEZE_WINDOWS.splice(idx, 1);
    return { success: true };
  };

  api.saveUser = async (u) => ({
    ...u,
    id: 'preview-user',
    email: 'preview@runaegis.co',
    created_at: new Date().toISOString(),
  });
  api.getUserDetails = async () => ({
    id: 'preview-user',
    username: 'demo',
    email: 'preview@runaegis.co',
    github_user_id: 0,
  });
  // Preview onboarding when the user is actually ON /onboarding (so
  // designers can review the flow). Anywhere else, claim "complete" so
  // they don't get pulled back into the wizard mid-session. The numeric
  // value matters: > 4 redirects to /dashboard, 1..4 renders that step.
  api.getOnboardingStep = async () => {
    const onOnboarding =
      typeof window !== 'undefined' &&
      window.location.pathname.startsWith('/onboarding');
    return { onboarding_step: onOnboarding ? 1 : 6 };
  };
  api.updateOnboardingStep = async () => ({ success: true });
}
