import {
  SessionAction,
  Session,
  User,
  RepoPermission,
  Metrics,
  MCPApproval,
  RoomSummary,
  RoomDetails,
  RoomMember,
  RoomInvite,
} from './types';

type SaveUserPayload = Pick<User, 'github_user_id' | 'username' | 'github_pat'> & {
  email?: string;
};

function getAPIBase(): string {
  let url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url;
}

const API_BASE = getAPIBase();

if (typeof window !== 'undefined') {
  console.log('[Aegis API] Using endpoint:', API_BASE);
}

function parseDatetime(value: any): string | any {
  if (typeof value !== 'string') return value;
  const datetimeMatch = value.match(
    /datetime\.datetime\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)/
  );
  if (datetimeMatch) {
    const [, year, month, day, hour, minute, second, microsecond] = datetimeMatch;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second),
      parseInt(microsecond) / 1000
    ).toISOString();
  }
  return value;
}


function parseRow(row: any, columns?: string[]): any {
  let obj: any = row;
  if (Array.isArray(row) && columns) {
    obj = Object.fromEntries(columns.map((col: string, i: number) => [col, row[i]]));
  }
  const datetimeFields = ['timestamp', 'started_at', 'last_action_at', 'created_at', 'approved_at'];
  for (const field of datetimeFields) {
    if (obj[field]) obj[field] = parseDatetime(String(obj[field]));
  }
  return obj;
}

function getJsonHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === 'string') return body.detail;
    if (typeof body?.message === 'string') return body.message;
    if (typeof body?.error === 'string') return body.error;
  } catch {
    // Fallback to generic status text
  }
  return res.statusText || 'Request failed';
}

// ── Cache keyed by userId so switching accounts works correctly ───────────────
const _cache = new Map<string, { rows: SessionAction[]; time: number }>();
const CACHE_TTL = 30_000;

async function getUserActions(userId: string): Promise<SessionAction[]> {
  const now = Date.now();
  const cached = _cache.get(userId);
  if (cached && now - cached.time < CACHE_TTL) return cached.rows;

  const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.statusText}`);

  const payload = await res.json();

  // Backend returns { user_id, count, sessions: SessionAction[] }
  const raw: any[] = Array.isArray(payload.sessions) ? payload.sessions : [];
  const rows = raw.map((r) => parseRow(r)) as SessionAction[];

  _cache.set(userId, { rows, time: now });
  return rows;
}

export function invalidateCache(userId?: string) {
  if (userId) _cache.delete(userId);
  else _cache.clear();
}

// ── Session aggregation helper ────────────────────────────────────────────────
function aggregateSessions(actions: SessionAction[]): Session[] {
  const map = new Map<string, Session>();

  for (const row of actions) {
    const sid = row.session_id;
    if (!sid) continue;

    if (!map.has(sid)) {
      map.set(sid, {
        session_id: sid,
        agent_name: row.agent_name,
        user_id: row.user_id,
        action_count: 0,
        started_at: row.timestamp,
        last_action_at: row.timestamp,
        repos: [],
        allows: 0,
        denies: 0,
        rewrites: 0,
        approvals: 0,
      });
    }

    const s = map.get(sid)!;
    s.action_count = (Number(s.action_count) || 0) + 1;
    if (row.timestamp && row.timestamp < s.started_at!) s.started_at = row.timestamp;
    if (row.timestamp && row.timestamp > s.last_action_at!) s.last_action_at = row.timestamp;
    if (row.target_repo && !(s.repos as string[]).includes(row.target_repo)) {
      (s.repos as string[]).push(row.target_repo);
    }
    const d = row.decision?.toUpperCase() || '';
    if (d === 'ALLOW') s.allows = (Number(s.allows) || 0) + 1;
    else if (d === 'DENY') s.denies = (Number(s.denies) || 0) + 1;
    else if (d === 'REWRITE') s.rewrites = (Number(s.rewrites) || 0) + 1;
    if (d.includes('APPROVAL')) s.approvals = (Number(s.approvals) || 0) + 1;
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.last_action_at!).getTime() - new Date(a.last_action_at!).getTime()
  );
}

export const api = {
  healthCheck: () =>
    fetch(`${API_BASE}/health`).then((r) => r.json()),

  getRuns: async (userId?: string): Promise<SessionAction[]> => {
    if (!userId) return [];
    const rows = await getUserActions(userId);
    return [...rows].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  },

  getSessions: async (userId?: string): Promise<Session[]> => {
    if (!userId) return [];
    const rows = await getUserActions(userId);
    return aggregateSessions(rows);
  },

  getRoomTools: (roomId: string, role: string, token: string) =>
  fetch(`${API_BASE}/room/${roomId}/tools/${role}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(res => res.json()),

updateRoomTools: (roomId: string, role: string, data: Record<string, boolean>, token: string) =>
  fetch(`${API_BASE}/room/${roomId}/tools/${role}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ tools: data }),  // ← IMPORTANT: Wrap in { tools: ... }
  })
    .then(async (res) => {
      const json = await res.json();
      if (!res.ok) {
  const message =
    typeof json.detail === "string"
      ? json.detail
      : JSON.stringify(json.detail);

  throw new Error(message || `HTTP ${res.status}`);
}
      return json;
    }),

  getSessionActions: async (sessionId: string, userId?: string): Promise<SessionAction[]> => {
    // If we have userId, pull from cache to avoid an extra fetch
    if (userId) {
      const rows = await getUserActions(userId);
      return rows
        .filter((r) => r.session_id === sessionId)
        .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));
    }
    // Fallback: fetch all and filter (no userId known)
    const res = await fetch(`${API_BASE}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `SELECT * FROM session_actions WHERE session_id = %s ORDER BY sequence_order ASC`,
        params: [sessionId],
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Query failed');
    return data.rows.map((row: any) => parseRow(row, data.columns)) as SessionAction[];
  },

  getMetrics: async (userId?: string): Promise<Metrics> => {
    if (!userId) return { total: 0, allows: 0, denies: 0, rewrites: 0, approvals: 0 };
    const runs = await getUserActions(userId);
    return {
      total: runs.length,
      allows: runs.filter((r) => r.result?.toUpperCase() === 'ALLOW').length,
      denies: runs.filter((r) => r.result?.toUpperCase() === 'DENY').length,
      rewrites: runs.filter((r) => r.result?.toUpperCase() === 'REWRITE').length,
      approvals: runs.filter((r) => r.result?.toUpperCase().includes('APPROVAL')).length,
    };
  },

  getApprovals: async (userId?: string): Promise<SessionAction[]> => {
    if (!userId) return [];
    const rows = await getUserActions(userId);
    return rows.filter((r) => r.decision?.toUpperCase().includes('APPROVAL'));
  },

  getMcpApprovals: async (userId?: string): Promise<MCPApproval[]> => {
    if (!userId) return [];

    const params = new URLSearchParams({ user_id: userId });
    const res = await fetch(`${API_BASE}/get_mcp_approvals?${params.toString()}`);
    if (!res.ok) throw new Error(`Failed to fetch MCP approvals: ${res.statusText}`);

    const payload = await res.json();
    const body = Array.isArray(payload) ? payload[0] : payload;

    if (!body?.success) {
      throw new Error(body?.error || 'Failed to fetch MCP approvals');
    }

    const rows = Array.isArray(body.rows) ? body.rows : [];
    return rows
      .map((row: any) => parseRow(row, body.columns))
      .sort(
        (a: MCPApproval, b: MCPApproval) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  },

  executeMcpApproval: async (recordId: string, reject: boolean) => {
    const params = new URLSearchParams({
      record_uuid_mcp_approval: recordId,
      reject: String(reject),
    });

    const res = await fetch(`${API_BASE}/execute_tool_call?${params.toString()}`);
    if (!res.ok) throw new Error(`Failed to update approval: ${res.statusText}`);

    const payload = await res.json();
    const body = Array.isArray(payload) ? payload[0] : payload;

    if (body?.failure) {
      throw new Error(body.failure);
    }

    return body;
  },

  getAuditTrail: async (userId?: string, limit = 50, offset = 0): Promise<SessionAction[]> => {
    if (!userId) return [];
    const rows = await getUserActions(userId);
    return rows
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(offset, offset + limit);
  },

  getAuditTrailByDateRange: async (
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<SessionAction[]> => {
    const rows = await getUserActions(userId);
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return rows.filter((r) => {
      const t = new Date(r.timestamp).getTime();
      return t >= start && t <= end;
    });
  },

  getRecentActionCount: async (userId: string, username: string): Promise<{ count: number }[]> => {
    const rows = await getUserActions(userId);
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const count = rows.filter(
      (r) =>
        r.agent_name?.toLowerCase().includes(username.toLowerCase()) &&
        new Date(r.timestamp).getTime() > fiveMinutesAgo
    ).length;
    return [{ count }];
  },

  saveUser: async (user: SaveUserPayload) => {
    const createResponse = await fetch(`${API_BASE}/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        github_user_id: user.github_user_id,
        username: user.username,
        github_pat: user.github_pat,
        email: user.email,
      }),
    }).then((r) => r.json());

    console.log('[API] POST /user response:', createResponse);
    if (!createResponse.success) {
      throw new Error(createResponse.message || 'Failed to create user');
    }

    if (createResponse.id) {
      return createResponse;
    }

    const lookupCandidates: string[] = [
      `${API_BASE}/user?github_user_id=${encodeURIComponent(String(user.github_user_id))}`,
      `${API_BASE}/user?username=${encodeURIComponent(user.username)}`,
    ];

    if (user.email) {
      lookupCandidates.push(`${API_BASE}/user?email=${encodeURIComponent(user.email)}`);
    }

    for (const lookupUrl of lookupCandidates) {
      try {
        const userFetch = await fetch(lookupUrl);
        if (!userFetch.ok) continue;

        const userResponse = await userFetch.json();
        if (userResponse.detail || userResponse.error) continue;

        return userResponse;
      } catch {
        // Try next lookup strategy
      }
    }

    throw new Error('Failed to retrieve user after save');
  },

  syncRepos: (github_user_id: number, github_pat: string) =>
    fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github_user_id, github_pat }),
    }).then((r) => r.json()),

  getRepos: (user_id: string) =>
    fetch(`${API_BASE}/repos/${user_id}`).then((r) => r.json()),

  setPermission: (
    user_id: string,
    github_repo_id: number,
    can_read: boolean,
    can_write: boolean
  ) =>
    fetch(`${API_BASE}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, github_repo_id, can_read, can_write }),
    }).then((r) => r.json()),

  setPermissions: (user_id: string, permissions: RepoPermission[]) =>
    fetch(`${API_BASE}/permissions/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permissions: permissions.map((p) => ({
          user_id,
          github_repo_id: p.github_repo_id,
          can_read: p.can_read || false,
          can_write: p.can_write || false,
        })),
      }),
    }).then((r) => r.json()),
  // POST /policy -> returns existing row or creates a new one with defaults
  getUserPolicy: async (userId: string): Promise<string | null> => {
    const res = await fetch(`${API_BASE}/policy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!res.ok) throw new Error(`Failed to fetch policy: ${res.statusText}`);

    const data = await res.json();
    const body = Array.isArray(data) ? data[0] : data;
    if (!body?.success || body.rowcount === 0) return null;

    const row = Array.isArray(body.rows) ? body.rows[0] : undefined;
    if (!row) return null;

    const parsed = parseRow(row, body.columns) as Record<string, unknown>;
    return typeof parsed.policy_string === 'string' ? parsed.policy_string : null;
  },

  upsertUserPolicy: async (userId: string, policyString: string): Promise<void> => {
    const params = new URLSearchParams({ policy_string: policyString });
    const res = await fetch(`${API_BASE}/policy/${encodeURIComponent(userId)}?${params.toString()}`, {
      method: 'PUT',
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to save policy: ${res.status} ${text || res.statusText}`);
    }
  },

  createRoom: async (repoId: string, token?: string): Promise<RoomDetails> => {
    const res = await fetch(`${API_BASE}/room/`, {
      method: 'POST',
      headers: getJsonHeaders(token),
      body: JSON.stringify({ repo_id: repoId }),
    });

    if (!res.ok) {
      throw new Error(`Failed to create room: ${await readErrorMessage(res)}`);
    }

    return res.json();
  },

  getMyRooms: async (token?: string): Promise<RoomSummary[]> => {
    const res = await fetch(`${API_BASE}/room/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!res.ok) {
      throw new Error(`Failed to load rooms: ${await readErrorMessage(res)}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  getRoomDetails: async (roomId: string, token?: string): Promise<RoomDetails> => {
    const res = await fetch(`${API_BASE}/room/${encodeURIComponent(roomId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!res.ok) {
      throw new Error(`Failed to load room: ${await readErrorMessage(res)}`);
    }

    return res.json();
  },

  getRoomMembers: async (roomId: string, token?: string): Promise<RoomMember[]> => {
    const res = await fetch(`${API_BASE}/room/${encodeURIComponent(roomId)}/members`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!res.ok) {
      throw new Error(`Failed to load room members: ${await readErrorMessage(res)}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  getRoomInvites: async (roomId: string, token?: string): Promise<RoomInvite[]> => {
    const res = await fetch(`${API_BASE}/room/${encodeURIComponent(roomId)}/invites`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!res.ok) {
      throw new Error(`Failed to load room invites: ${await readErrorMessage(res)}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  createRoomInvite: async (
    roomId: string,
    payload: { max_uses?: number; expires_at?: string },
    token?: string
  ): Promise<RoomInvite> => {
    const res = await fetch(`${API_BASE}/room/${encodeURIComponent(roomId)}/invite`, {
      method: 'POST',
      headers: getJsonHeaders(token),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Failed to create invite: ${await readErrorMessage(res)}`);
    }

    return res.json();
  },

  joinRoom: async (inviteCode: string, token?: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/room/join/${encodeURIComponent(inviteCode)}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!res.ok) {
      throw new Error(`Failed to join room: ${await readErrorMessage(res)}`);
    }

    return res.json();
  },
};