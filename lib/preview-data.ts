/**
 * Preview-mode data shim — installs fake responses on the `api` singleton
 * so the dashboard renders fully-populated in design review without a
 * backend. Idempotent — safe to call on every render. Real production code
 * paths are untouched unless `aegis_preview` is on.
 */

import { api } from './api';
import type {
  AggregatedSessionAction,
  BlastRadiusLevel,
  BranchContextSnapshot,
  EnvContextSnapshot,
  MCPApproval,
  Metrics,
  PaginatedResponse,
  Repo,
  RepoContextSnapshot,
  RoomDetails,
  RoomInvite,
  RoomMember,
  RoomSessionAction,
  RoomSummary,
  SemanticType,
  Session,
  SessionAction,
  SessionContextSnapshot,
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
  // Canonical Aegis-managed working branch. Per the spec, this is the
  // persistent ephemeral branch where agents do iterative commits.
  // `ephemeral_force_push` semantic_type fires when force-pushing here.
  'aegis_workstation',
  // Legacy / pre-canonical naming pattern. Kept so existing demo
  // sessions don't all collapse to one branch; the spec calls these
  // out as deprecated but they still appear in older logs.
  'aegis/sess_8f3a/refactor-policies',
  'aegis/sess_b21c/add-webhooks',
  'chore/dependency-bump',
];

// Protected branches — used by the canonical classifier to detect
// `protected_branch_write` and `freeze_window_violation` semantic_types.
const PROTECTED_BRANCHES = new Set(['main', 'master', 'release']);

// Sensitive paths — used by the classifier to detect
// `sensitive_path_change` semantic_type. Mirrors the backend's
// `policies/sensitive_path_policy.py` pattern set.
const SENSITIVE_PATH_PREFIXES = [
  '.github/workflows/',
  'infra/',
  'terraform/',
  'auth/',
  'security/',
  '.github/actions/',
  'kubernetes/',
  'helm/',
];

// Test/docs path prefixes — used to detect `test_only_change`.
const TEST_PATH_PREFIXES = [
  'tests/',
  'test/',
  '__tests__/',
  'spec/',
  'docs/',
  'README',
  'CHANGELOG',
];

// ── Multi-connector tool catalog ─────────────────────────────────────────
//
// Tools are partitioned by connector so demo data can show a realistic mix
// of agent actions across GitHub + Slack (and additional connectors as
// they ship). The split also lets each connector ship its own action-phrase
// vocabulary so the demo doesn't read as "agent pushed code to Slack".
//
// Weighting: GitHub is still the dominant surface (the agent's primary
// job is shipping code), so most actions land in GitHub. Slack appears as
// the comms surface — agent posts status updates, replies to threads,
// occasionally invites teammates. This matches what real cross-tool agent
// sessions look like.

const GITHUB_TOOLS = [
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

const SLACK_TOOLS = [
  'list_channels',
  'list_users',
  'get_channel_history',
  'get_thread_replies',
  'search_messages',
  'post_message',
  'post_thread_reply',
  'add_reaction',
  'upload_file',
  'invite_user_to_channel',
  'delete_message',
  'archive_channel',
  'kick_user',
];

const LINEAR_TOOLS = [
  'list_issues',
  'get_issue',
  'list_projects',
  'get_project',
  'search_issues',
  'list_teams',
  'list_users',
  'create_issue',
  'update_issue',
  'add_issue_comment',
  'create_subtask',
  'move_issue',
  'assign_issue',
  'close_issue',
  'set_priority',
  'archive_issue',
];

const JIRA_TOOLS = [
  'list_issues',
  'get_issue',
  'search_issues',
  'list_projects',
  'list_boards',
  'create_issue',
  'update_issue',
  'add_comment',
  'transition_issue',
  'assign_issue',
  'create_subtask',
  'delete_issue',
  'archive_project',
];

const GITHUB_ACTIONS_TOOLS = [
  'list_workflows',
  'get_workflow',
  'list_workflow_runs',
  'get_workflow_run',
  'list_workflow_jobs',
  'get_run_logs',
  'list_secrets',
  'dispatch_workflow',
  'rerun_workflow',
  'cancel_workflow',
  'update_secret',
  'delete_secret',
  'delete_workflow_run',
];

const TERRAFORM_TOOLS = [
  'plan',
  'show',
  'state_list',
  'state_show',
  'output',
  'workspace_list',
  'workspace_select',
  'validate',
  'fmt_check',
  'apply',
  'destroy',
  'state_rm',
  'state_mv',
  'import',
  'taint',
  'workspace_new',
  'workspace_delete',
];

const POSTGRES_TOOLS = [
  'query_select',
  'describe_table',
  'list_tables',
  'list_databases',
  'show_indexes',
  'show_constraints',
  'explain_plan',
  'query_insert',
  'query_update',
  'create_table',
  'alter_table',
  'create_index',
  'query_delete',
  'drop_table',
  'truncate_table',
  'drop_index',
  'run_migration',
];

const DATADOG_TOOLS = [
  'list_dashboards',
  'get_dashboard',
  'list_monitors',
  'get_monitor',
  'search_logs',
  'query_metrics',
  'list_synthetics',
  'get_synthetic_check',
  'list_incidents',
  'get_incident',
  'list_events',
  'silence_monitor',
  'update_monitor',
  'create_dashboard',
  'update_dashboard',
  'post_event',
  'add_synthetic_check',
  'acknowledge_incident',
  'delete_dashboard',
  'delete_monitor',
  'delete_synthetic_check',
  'resolve_incident_force',
];

const SENTRY_TOOLS = [
  'list_projects',
  'list_issues',
  'get_issue',
  'list_releases',
  'get_release',
  'get_event',
  'list_alerts',
  'assign_issue',
  'resolve_issue',
  'mark_ignored',
  'add_issue_comment',
  'set_status',
  'create_release',
  'delete_issue',
  'bulk_resolve',
  'delete_project',
];

const KUBERNETES_TOOLS = [
  'kubectl_get',
  'kubectl_describe',
  'kubectl_logs',
  'kubectl_top',
  'kubectl_explain',
  'kubectl_diff',
  'kubectl_apply',
  'kubectl_patch',
  'kubectl_scale',
  'kubectl_rollout',
  'kubectl_label',
  'kubectl_annotate',
  'kubectl_set_image',
  'kubectl_delete',
  'kubectl_exec',
  'kubectl_drain',
  'kubectl_cordon',
  'kubectl_taint',
];

const CLOUDFLARE_TOOLS = [
  'list_zones',
  'get_zone',
  'list_dns_records',
  'get_dns_record',
  'list_workers',
  'get_worker',
  'list_kv_namespaces',
  'list_r2_buckets',
  'get_pages_project',
  'create_dns_record',
  'update_dns_record',
  'deploy_worker',
  'update_worker',
  'update_kv_pair',
  'create_kv_namespace',
  'create_r2_bucket',
  'delete_dns_record',
  'delete_worker',
  'delete_zone',
  'purge_cache',
  'delete_pages_project',
];

const NOTION_TOOLS = [
  'get_page',
  'search_pages',
  'query_database',
  'get_database',
  'list_users',
  'get_comments',
  'create_page',
  'update_page',
  'append_block',
  'create_database',
  'update_database',
  'add_comment',
  'delete_page',
  'archive_page',
  'share_page_publicly',
  'delete_database',
];

// Combined catalog for backwards compatibility with anything that wants a
// flat tool list (e.g. PREVIEW_ROOM_TOOLS role-based allowlists below).
const TOOLS = [
  ...GITHUB_TOOLS,
  ...SLACK_TOOLS,
  ...LINEAR_TOOLS,
  ...JIRA_TOOLS,
  ...GITHUB_ACTIONS_TOOLS,
  ...TERRAFORM_TOOLS,
  ...POSTGRES_TOOLS,
  ...DATADOG_TOOLS,
  ...SENTRY_TOOLS,
  ...KUBERNETES_TOOLS,
  ...CLOUDFLARE_TOOLS,
  ...NOTION_TOOLS,
];

type ConnectorSlug =
  | 'github'
  | 'slack'
  | 'linear'
  | 'jira'
  | 'github-actions'
  | 'terraform'
  | 'postgres'
  | 'datadog'
  | 'sentry'
  | 'kubernetes'
  | 'cloudflare'
  | 'notion';

// Lookup map: tool name → connector slug. Used by phraseForTool() and
// argsForTool() to render coherent rows regardless of which connector
// the random picker landed on.
const TOOL_TO_CONNECTOR: Record<string, ConnectorSlug> = (() => {
  const m: Record<string, ConnectorSlug> = {};
  for (const t of GITHUB_TOOLS) m[t] = 'github';
  for (const t of SLACK_TOOLS) m[t] = 'slack';
  for (const t of LINEAR_TOOLS) m[t] = 'linear';
  for (const t of JIRA_TOOLS) m[t] = 'jira';
  for (const t of GITHUB_ACTIONS_TOOLS) m[t] = 'github-actions';
  for (const t of TERRAFORM_TOOLS) m[t] = 'terraform';
  for (const t of POSTGRES_TOOLS) m[t] = 'postgres';
  for (const t of DATADOG_TOOLS) m[t] = 'datadog';
  for (const t of SENTRY_TOOLS) m[t] = 'sentry';
  for (const t of KUBERNETES_TOOLS) m[t] = 'kubernetes';
  for (const t of CLOUDFLARE_TOOLS) m[t] = 'cloudflare';
  for (const t of NOTION_TOOLS) m[t] = 'notion';
  return m;
})();

const GITHUB_ACTION_PHRASES = [
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

const SLACK_ACTION_PHRASES = [
  'Post a deployment status update in #engineering',
  'Reply to the on-call thread with the policy evaluator fix',
  'Notify #releases that the freeze window starts in 30 minutes',
  'Search recent messages for the bug report Mujtaba flagged',
  'List active members of the platform team for assignment',
  'Upload the policy evaluation logs to the #incident channel',
  'React with a checkmark on the PR review request',
  'DM the on-call engineer about a blocked approval',
  'Pull the conversation history from #aegis-eng for context',
  'Invite the new design partner contact to #early-access',
  'Tag the platform-lead role for review',
  'Archive the #wip-rate-limits channel after rollout',
];

const LINEAR_ACTION_PHRASES = [
  'Pull AEG-247 to read acceptance criteria before coding',
  'Move AEG-301 from In Review to Done',
  'Add a comment summarizing the policy evaluator fix on AEG-189',
  'Search active P1 issues for the rate-limit incident',
  'Create a subtask for the audit-export migration work',
  'Assign AEG-412 to mujtaba for review',
  'List all open P0 issues to triage before standup',
  'Re-prioritize AEG-501 from P3 to P2 after customer flag',
  'Get the latest activity timeline for AEG-256',
  'Close AEG-128 after merging the freeze-window fix',
];

const JIRA_ACTION_PHRASES = [
  'Pull AEGIS-247 to read acceptance criteria before coding',
  'Transition AEGIS-301 from In Review to Done',
  'Add a comment summarizing the rollout plan on AEGIS-189',
  'Search active P1 issues in the SECURITY board',
  'Create a subtask for the audit-export migration work',
  'Assign AEGIS-412 to platform-team for review',
];

const GITHUB_ACTIONS_PHRASES = [
  'Dispatch the deploy-staging workflow with the latest commit',
  'Re-run the failed unit-test job from yesterday',
  'List recent workflow runs to triage the flaky test',
  'Cancel the in-flight build that is targeting prod',
  'Rotate the STAGING_DB_URL secret per quarterly policy',
  'Pull job logs for the failing migration check',
  'Get the latest run status for the release-tag workflow',
];

const TERRAFORM_ACTION_PHRASES = [
  'Run terraform plan against the staging workspace',
  'Show the current state for the api-gateway module',
  'Validate the new EKS cluster module configuration',
  'List workspaces to identify the right target for the change',
  'Output the database endpoint after the plan completes',
  'Format-check the rate-limiter module before opening a PR',
  'Apply the network-tagging change to the staging workspace',
  'Import the existing S3 bucket into Terraform state',
];

const POSTGRES_ACTION_PHRASES = [
  'Query recent audit rows to verify policy decisions',
  'Describe the audit_events table to confirm the schema',
  'Run an EXPLAIN on the slow approval-queue query',
  'List indexes on the runs table to find a missing covering index',
  'Insert a backfill row for the missing token_meter session',
  'Update the policy_status column for archived rooms',
  'Create a covering index on (room_id, decided_at)',
  'Run the audit-retention migration against the staging DB',
  'Delete soft-deleted approval rows older than 90 days',
  'Drop the legacy approvals_v1 table after migration window',
];

const DATADOG_ACTION_PHRASES = [
  'Pull the last 6h of error logs from the approval-queue service',
  'Check the p95 latency monitor before declaring the rollout safe',
  'Read the on-call dashboard to confirm no active incidents',
  'Query metrics for the runs ingest pipeline since deploy',
  'List active synthetic checks for the public API',
  'Acknowledge the noisy ECS Task Failed monitor while we investigate',
  'Silence the staging policy-evaluator monitor during the migration',
  'Post a deployment event so the dashboard timeline reflects the release',
  'Update the SLO dashboard widget to track the new approval p99',
  'Add a synthetic check for the new /api/connectors endpoint',
  'Delete the deprecated approvals-v1 monitor after migration window',
];

const SENTRY_ACTION_PHRASES = [
  'List unresolved errors in the policy-evaluator project',
  'Read the stack trace for the spike in TimeoutError exceptions',
  'Inspect release health for the 4.18.0 deploy before promoting',
  'Pull the event payload from the latest 500 error',
  'Assign the runaway-loop error cluster to the policy-eval owner',
  'Resolve the issue cluster after shipping the fix',
  'Ignore the known third-party Slack-SDK timeout cluster',
  'Add a comment with the fix PR link to the resolved issue',
  'Create a release entry for 4.18.0 with the commit set',
  'Bulk-resolve everything in the approvals namespace',
  'Delete the test-fixture project that got created by mistake',
];

const KUBERNETES_ACTION_PHRASES = [
  'Get pods in the approvals namespace to confirm the rollout completed',
  'Describe the policy-evaluator deployment to inspect env vars',
  'Tail logs for the runs-ingest pod chasing a crashloop',
  'Run kubectl top to identify the memory-hot pod on the staging cluster',
  'Diff the staging manifest against what is applied',
  'Apply the new HorizontalPodAutoscaler for the approvals service',
  'Scale the policy-evaluator deployment to 8 replicas for the launch',
  'Patch the runs-ingest deployment image to the 4.18.0 tag',
  'Roll out the staging policy-evaluator restart',
  'Set image on the approvals-api deployment to the canary tag',
  'Delete the failed rollout job left behind from yesterday',
  'Exec into a runs-ingest pod to reproduce the OOM live',
  'Drain node ip-10-0-3-141 ahead of the scheduled maintenance',
];

const CLOUDFLARE_ACTION_PHRASES = [
  'List zones to confirm the runaegis.co apex DNS records',
  'Read the worker config for the api.runaegis.co edge function',
  'Inspect KV namespaces holding the policy-cache shards',
  'Check R2 buckets used by the audit-export pipeline',
  'Create a CNAME for status.runaegis.co pointing at the status page',
  'Update the api.runaegis.co worker route after rolling the deploy',
  'Deploy the policy-evaluator worker to the canary route',
  'Update a KV pair to flip the read-only feature flag for staging',
  'Create a new KV namespace for the connectors-v2 rollout',
  'Delete the unused legacy preview-staging DNS record',
  'Purge cache for /api/runs to flush the bad payload',
  'Delete the deprecated edge-router worker after migration',
];

const NOTION_ACTION_PHRASES = [
  'Read the policy authoring RFC before drafting the schema change',
  'Search Notion for the on-call runbook the incident touched',
  'Query the connectors database to list every roadmap item',
  'Pull the comments thread on the launch-readiness checklist',
  'List the platform team members for the new room',
  'Create a meeting-notes page for the weekly governance sync',
  'Update the public docs page with the new MCP endpoint URL',
  'Append a status note to the launch tracker',
  'Create a new database for tracking customer pilot logos',
  'Add a comment to the SOC 2 readiness page',
  'Delete the duplicate draft page accidentally created by the agent',
  'Share the audit-export how-to publicly so customers can self-serve',
];

const ACTION_PHRASES = [
  ...GITHUB_ACTION_PHRASES,
  ...SLACK_ACTION_PHRASES,
  ...LINEAR_ACTION_PHRASES,
  ...JIRA_ACTION_PHRASES,
  ...GITHUB_ACTIONS_PHRASES,
  ...TERRAFORM_ACTION_PHRASES,
  ...POSTGRES_ACTION_PHRASES,
  ...DATADOG_ACTION_PHRASES,
  ...SENTRY_ACTION_PHRASES,
  ...KUBERNETES_ACTION_PHRASES,
  ...CLOUDFLARE_ACTION_PHRASES,
  ...NOTION_ACTION_PHRASES,
];

/**
 * Return the connector a tool belongs to.
 */
function connectorForTool(tool: string): ConnectorSlug {
  return TOOL_TO_CONNECTOR[tool] ?? 'github';
}

/**
 * Connector mix for the demo workspace. Tuned to look like a realistic
 * cross-tool engineering agent fleet: GitHub dominates (the agent's
 * core job is code), Slack is the second most-used (comms checkpoints
 * throughout sessions), Linear is third (planning context lookups),
 * the rest taper. The numbers are guidance, not gospel — adjust to
 * make the demo data feel right.
 */
const CONNECTOR_WEIGHTS: Array<{ slug: ConnectorSlug; pool: readonly string[]; weight: number }> = [
  // Code + comms still dominate — that's the reality of an
  // engineering agent fleet.
  { slug: 'github',          pool: GITHUB_TOOLS,          weight: 30 },
  { slug: 'slack',           pool: SLACK_TOOLS,           weight: 14 },
  { slug: 'linear',          pool: LINEAR_TOOLS,          weight: 10 },
  { slug: 'github-actions',  pool: GITHUB_ACTIONS_TOOLS,  weight: 8 },
  { slug: 'postgres',        pool: POSTGRES_TOOLS,        weight: 6 },
  { slug: 'terraform',       pool: TERRAFORM_TOOLS,       weight: 5 },
  { slug: 'jira',            pool: JIRA_TOOLS,            weight: 3 },
  // New Stage 2 connectors. Observability + ops surfaces should
  // appear often enough that the demo data tells the "incident loop"
  // story without drowning out core code work.
  { slug: 'datadog',         pool: DATADOG_TOOLS,         weight: 7 },
  { slug: 'sentry',          pool: SENTRY_TOOLS,          weight: 6 },
  { slug: 'kubernetes',      pool: KUBERNETES_TOOLS,      weight: 5 },
  { slug: 'cloudflare',      pool: CLOUDFLARE_TOOLS,      weight: 3 },
  { slug: 'notion',          pool: NOTION_TOOLS,          weight: 3 },
];

/**
 * Weighted pick across all 7 connector tool pools. Replaces the
 * earlier 75/25 GitHub/Slack picker so the demo workspace can tell
 * the full control-plane story across every tool an engineering
 * agent touches.
 */
function pickToolWeighted(): string {
  const total = CONNECTOR_WEIGHTS.reduce((s, c) => s + c.weight, 0);
  const r = rand() * total;
  let acc = 0;
  for (const c of CONNECTOR_WEIGHTS) {
    acc += c.weight;
    if (r < acc) return pick(c.pool);
  }
  return pick(GITHUB_TOOLS);
}

const PHRASES_BY_CONNECTOR: Record<ConnectorSlug, readonly string[]> = {
  github: GITHUB_ACTION_PHRASES,
  slack: SLACK_ACTION_PHRASES,
  linear: LINEAR_ACTION_PHRASES,
  jira: JIRA_ACTION_PHRASES,
  'github-actions': GITHUB_ACTIONS_PHRASES,
  terraform: TERRAFORM_ACTION_PHRASES,
  postgres: POSTGRES_ACTION_PHRASES,
  datadog: DATADOG_ACTION_PHRASES,
  sentry: SENTRY_ACTION_PHRASES,
  kubernetes: KUBERNETES_ACTION_PHRASES,
  cloudflare: CLOUDFLARE_ACTION_PHRASES,
  notion: NOTION_ACTION_PHRASES,
};

/**
 * Pick an action phrase that matches the tool's connector so the
 * `tool_name` + `action_summary` columns in Runs / Audit always tell
 * a coherent story.
 */
function phraseForTool(tool: string): string {
  const connector = connectorForTool(tool);
  const pool = PHRASES_BY_CONNECTOR[connector] ?? GITHUB_ACTION_PHRASES;
  return pick(pool);
}

const SLACK_CHANNELS = [
  '#engineering',
  '#aegis-eng',
  '#releases',
  '#incident',
  '#on-call',
  '#early-access',
  '#wip-rate-limits',
  '#announcements',
];

const LINEAR_ISSUE_IDS = ['AEG-247', 'AEG-301', 'AEG-189', 'AEG-412', 'AEG-501', 'AEG-256', 'AEG-128'];
const JIRA_ISSUE_IDS = ['AEGIS-247', 'AEGIS-301', 'AEGIS-189', 'AEGIS-412'];
const GH_WORKFLOWS = ['deploy-staging', 'deploy-prod', 'unit-tests', 'integration-tests', 'release-tag', 'security-scan'];
const TERRAFORM_WORKSPACES = ['staging', 'production', 'dev', 'sandbox', 'data-platform'];
const POSTGRES_DBS = ['aegis_app', 'aegis_audit', 'aegis_metrics', 'staging_replica'];
const POSTGRES_TABLES = ['audit_events', 'runs', 'sessions', 'approvals', 'token_meter', 'rooms', 'members'];

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

// ── Session archetypes — coherent cross-tool agent journeys ──────────────
//
// Without these, every session is a random scatter of tool calls; the
// Sessions table looks like 14 identical sessions, each with ~7 random
// connectors. That's the opposite of what we want investors to see.
//
// With archetypes, each session has a discernible *story* — feature
// dev (GitHub-heavy + Slack updates), data migration (Postgres + Slack
// notifications), infra rollout (Terraform → GHActions deploy → Slack
// post), etc. Sessions tell coherent stories and the multi-tool
// control-plane claim becomes visible on first scan.
//
// Each archetype defines:
//   - `primary`: the dominant connector for this session
//   - `surfaces`: other connectors the agent dips into
//   - `weight`: relative frequency in the pool of archetypes

type SessionArchetype = {
  name: string;
  primary: ConnectorSlug;
  surfaces: ConnectorSlug[];
  weight: number;
};

const SESSION_ARCHETYPES: SessionArchetype[] = [
  // Feature work: read a Linear ticket, code on GitHub, post status to Slack.
  { name: 'feature_dev', primary: 'github', surfaces: ['github', 'linear', 'slack'], weight: 5 },
  // Incident triage: agent starts in Slack, fans out to GitHub + Linear.
  { name: 'incident_triage', primary: 'slack', surfaces: ['slack', 'github', 'linear'], weight: 2 },
  // Pure code work — agent in a coding session, no comms.
  { name: 'pure_code', primary: 'github', surfaces: ['github'], weight: 2 },
  // Release: GH Actions deploy + GitHub + Slack notify.
  { name: 'release_deploy', primary: 'github-actions', surfaces: ['github-actions', 'github', 'slack'], weight: 2 },
  // Data migration: Postgres-heavy + Slack notifications.
  { name: 'data_migration', primary: 'postgres', surfaces: ['postgres', 'slack', 'github'], weight: 1 },
  // Infra change: Terraform-heavy + GHA validation + Slack.
  { name: 'infra_change', primary: 'terraform', surfaces: ['terraform', 'github-actions', 'slack'], weight: 1 },
  // Planning sweep: Linear + Jira + GitHub references.
  { name: 'planning_sweep', primary: 'linear', surfaces: ['linear', 'jira', 'github'], weight: 1 },
  // Stage 2 archetypes — the new connectors get their own coherent
  // narratives so the demo shows them naturally, not as random noise.

  // Incident loop: agent reads a Datadog alert → pulls Sentry trace
  // → diffs the suspect commit on GitHub → posts status to Slack.
  // This is the moat slide narrative.
  { name: 'incident_loop',  primary: 'datadog',    surfaces: ['datadog', 'sentry', 'github', 'slack'], weight: 2 },
  // Cluster ops: kubectl get / describe / rollout, occasionally
  // touching GitHub for the manifest source of truth.
  { name: 'cluster_ops',    primary: 'kubernetes', surfaces: ['kubernetes', 'github', 'slack'],        weight: 1 },
  // Edge / DNS: Cloudflare worker + DNS changes, GHA workflow,
  // Slack notify on launch.
  { name: 'edge_deploy',    primary: 'cloudflare', surfaces: ['cloudflare', 'github-actions', 'slack'], weight: 1 },
  // Docs sweep: agent reads RFCs / runbooks from Notion before
  // taking action on the code. Cross-tool reads only.
  { name: 'docs_lookup',    primary: 'notion',     surfaces: ['notion', 'github', 'linear'],            weight: 1 },
];

const SESSION_ARCHETYPE_TOTAL_WEIGHT = SESSION_ARCHETYPES.reduce(
  (s, a) => s + a.weight,
  0,
);

function pickArchetype(): SessionArchetype {
  const r = rand() * SESSION_ARCHETYPE_TOTAL_WEIGHT;
  let acc = 0;
  for (const a of SESSION_ARCHETYPES) {
    acc += a.weight;
    if (r < acc) return a;
  }
  return SESSION_ARCHETYPES[0];
}

// Stable per-session archetype assignment. Picked once when the demo
// dataset is built so every run in a given session_id follows the same
// archetype's tool distribution.
const ARCHETYPE_BY_SESSION_ID: Map<string, SessionArchetype> = new Map(
  SESSION_IDS.map((id) => [id, pickArchetype()]),
);

// ── Session trigger taxonomy ─────────────────────────────────────────
//
// Most agent sessions arrive through one of four channels: an engineer
// chatting with the agent, a cron-style schedule, an external webhook
// (alert / PR opened / push to main), or a CI test suite invoking the
// agent in a sandbox. The Sessions page exposes these as a tab strip
// so reviewers can scope the list to whatever trigger they care about.
//
// We pin each archetype to its "natural" trigger and override roughly
// 1-in-4 sessions to `test` (deterministic by uuid hash, not rand(),
// so we don't shift the seeded RNG and re-roll downstream demo data).
// The deterministic override guarantees the Tests tab is always
// populated without changing anything else.
type TriggerType = 'chat' | 'scheduled' | 'webhook' | 'test';

const TRIGGER_BY_ARCHETYPE: Record<string, TriggerType> = {
  feature_dev: 'chat',
  incident_triage: 'webhook',
  pure_code: 'chat',
  release_deploy: 'scheduled',
  data_migration: 'scheduled',
  infra_change: 'chat',
  planning_sweep: 'scheduled',
  incident_loop: 'webhook',
  cluster_ops: 'chat',
  edge_deploy: 'scheduled',
  docs_lookup: 'chat',
};

/** Cheap, deterministic string hash. Used here so the trigger override
 *  doesn't consume entropy from the seeded rand() and shift the demo
 *  data downstream. */
function triggerHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const TRIGGER_BY_SESSION_ID: Map<string, TriggerType> = new Map(
  SESSION_IDS.map((id) => {
    const archetype = ARCHETYPE_BY_SESSION_ID.get(id);
    const base: TriggerType = archetype
      ? TRIGGER_BY_ARCHETYPE[archetype.name] ?? 'chat'
      : 'chat';
    // ~1-in-4 sessions become `test` regardless of archetype so the
    // Tests tab on the Sessions page is never empty.
    if (triggerHash(id) % 4 === 0) return [id, 'test'];
    return [id, base];
  }),
);

const POOL_BY_CONNECTOR: Record<ConnectorSlug, readonly string[]> = {
  github: GITHUB_TOOLS,
  slack: SLACK_TOOLS,
  linear: LINEAR_TOOLS,
  jira: JIRA_TOOLS,
  'github-actions': GITHUB_ACTIONS_TOOLS,
  terraform: TERRAFORM_TOOLS,
  postgres: POSTGRES_TOOLS,
  datadog: DATADOG_TOOLS,
  sentry: SENTRY_TOOLS,
  kubernetes: KUBERNETES_TOOLS,
  cloudflare: CLOUDFLARE_TOOLS,
  notion: NOTION_TOOLS,
};

/**
 * Pick a tool for a specific session's archetype. 65% of the time we
 * sample from the archetype's primary connector; the rest from the
 * archetype's surfaces array. That ratio is what makes sessions feel
 * coherent — primary surface dominates, secondary surfaces sprinkle.
 */
function pickToolForSession(sessionId: string): string {
  const archetype = ARCHETYPE_BY_SESSION_ID.get(sessionId);
  if (!archetype) return pick(GITHUB_TOOLS);
  const useSecondary = rand() < 0.35 && archetype.surfaces.length > 1;
  const slug = useSecondary
    ? pick(archetype.surfaces.filter((s) => s !== archetype.primary))
    : archetype.primary;
  return pick(POOL_BY_CONNECTOR[slug] ?? GITHUB_TOOLS);
}

/** Build a realistic args payload for a tool call. Slack and GitHub
 *  have completely different argument shapes; keeping this aligned to
 *  the tool keeps the Audit "raw payload" view (the JSON drawer) on
 *  message instead of leaking GitHub-shaped args into a Slack row. */
function argsForTool(tool: string, repo: string, branch: string): Record<string, unknown> {
  // GitHub-side
  switch (tool) {
    case 'create_pull_request':
      return { repo, title: 'Open PR for fix', base: 'main', head: branch };
    case 'create_or_update_file':
      return { repo, path: 'src/index.ts', branch, message: 'chore: update' };
    case 'search_code':
      return { q: 'evaluatePolicy', repo };
    case 'get_file_contents':
    case 'list_repository_files':
    case 'get_repository':
    case 'list_branches':
    case 'list_issues':
    case 'create_branch':
    case 'get_pull_request':
    case 'get_issue':
    case 'create_issue':
    case 'search_repositories':
    case 'search_issues':
    case 'get_latest_commit':
    case 'push_files':
      return { repo, branch };
  }
  const connector = connectorForTool(tool);

  // Slack
  if (connector === 'slack') {
    const channel = pick(SLACK_CHANNELS);
    switch (tool) {
      case 'post_message':
        return { channel, text: 'Deployment to staging is green. Promoting to prod in 10 minutes.' };
      case 'post_thread_reply':
        return { channel, thread_ts: '1716462100.000200', text: 'Fixed the race condition.' };
      case 'add_reaction':
        return { channel, timestamp: '1716462100.000200', name: 'white_check_mark' };
      case 'upload_file':
        return { channel, filename: 'policy-evaluator.log', filetype: 'text' };
      case 'invite_user_to_channel':
        return { channel, user_id: 'U02AB1CDEF' };
      case 'delete_message':
        return { channel, timestamp: '1716462100.000200' };
      case 'archive_channel':
        return { channel };
      case 'kick_user':
        return { channel, user_id: 'U02AB1CDEF' };
      case 'list_channels':
        return { limit: 100, exclude_archived: true };
      case 'list_users':
        return { limit: 200 };
      case 'get_channel_history':
        return { channel, limit: 50 };
      case 'get_thread_replies':
        return { channel, ts: '1716462100.000200' };
      case 'search_messages':
        return { query: 'rate limit' };
    }
    return { channel };
  }

  // Linear
  if (connector === 'linear') {
    const issueId = pick(LINEAR_ISSUE_IDS);
    switch (tool) {
      case 'list_issues':       return { team: 'AEG', state: 'open', limit: 50 };
      case 'get_issue':         return { issue_id: issueId };
      case 'list_projects':     return { team: 'AEG' };
      case 'get_project':       return { project_id: 'proj_aegis_dashboard' };
      case 'search_issues':     return { query: 'rate limit', team: 'AEG' };
      case 'list_teams':        return {};
      case 'list_users':        return { team: 'AEG' };
      case 'create_issue':      return { team: 'AEG', title: 'Track rate-limit incident', priority: 2 };
      case 'update_issue':      return { issue_id: issueId, title: 'Updated title from agent' };
      case 'add_issue_comment': return { issue_id: issueId, body: 'Pushed fix in PR #2847' };
      case 'create_subtask':    return { parent_id: issueId, title: 'Backfill audit rows' };
      case 'move_issue':        return { issue_id: issueId, state: 'In Progress' };
      case 'assign_issue':      return { issue_id: issueId, assignee: 'mujtaba' };
      case 'close_issue':       return { issue_id: issueId };
      case 'set_priority':      return { issue_id: issueId, priority: 1 };
      case 'archive_issue':     return { issue_id: issueId };
    }
    return { issue_id: issueId };
  }

  // Jira
  if (connector === 'jira') {
    const issueId = pick(JIRA_ISSUE_IDS);
    switch (tool) {
      case 'list_issues':        return { project: 'AEGIS', status: 'In Progress', limit: 50 };
      case 'get_issue':          return { issue_key: issueId };
      case 'search_issues':      return { jql: 'project = AEGIS AND priority = High' };
      case 'list_projects':      return {};
      case 'list_boards':        return { project: 'AEGIS' };
      case 'create_issue':       return { project: 'AEGIS', summary: 'Track rate-limit incident', priority: 'High' };
      case 'update_issue':       return { issue_key: issueId, fields: { summary: 'Updated' } };
      case 'add_comment':        return { issue_key: issueId, body: 'Pushed fix in PR #2847' };
      case 'transition_issue':   return { issue_key: issueId, transition: 'In Review' };
      case 'assign_issue':       return { issue_key: issueId, assignee: 'mujtaba' };
      case 'create_subtask':     return { parent: issueId, summary: 'Backfill audit rows' };
      case 'delete_issue':       return { issue_key: issueId };
      case 'archive_project':    return { project: 'AEGIS' };
    }
    return { issue_key: issueId };
  }

  // GitHub Actions
  if (connector === 'github-actions') {
    const workflow = pick(GH_WORKFLOWS);
    switch (tool) {
      case 'list_workflows':       return { repo };
      case 'get_workflow':         return { repo, workflow };
      case 'list_workflow_runs':   return { repo, workflow, limit: 25 };
      case 'get_workflow_run':     return { repo, run_id: 8742091 };
      case 'list_workflow_jobs':   return { repo, run_id: 8742091 };
      case 'get_run_logs':         return { repo, run_id: 8742091 };
      case 'list_secrets':         return { repo };
      case 'dispatch_workflow':    return { repo, workflow, ref: branch, inputs: { environment: 'staging' } };
      case 'rerun_workflow':       return { repo, run_id: 8742091 };
      case 'cancel_workflow':      return { repo, run_id: 8742091 };
      case 'update_secret':        return { repo, name: 'STAGING_DB_URL', encrypted_value: '<redacted>' };
      case 'delete_secret':        return { repo, name: 'STAGING_DB_URL' };
      case 'delete_workflow_run':  return { repo, run_id: 8742091 };
    }
    return { repo, workflow };
  }

  // Terraform
  if (connector === 'terraform') {
    const workspace = pick(TERRAFORM_WORKSPACES);
    switch (tool) {
      case 'plan':              return { workspace, var_file: 'staging.tfvars' };
      case 'show':              return { workspace, target: 'module.api_gateway' };
      case 'state_list':        return { workspace };
      case 'state_show':        return { workspace, address: 'aws_s3_bucket.audit_logs' };
      case 'output':            return { workspace };
      case 'workspace_list':    return {};
      case 'workspace_select':  return { workspace };
      case 'validate':          return { workspace };
      case 'fmt_check':         return { workspace };
      case 'apply':             return { workspace, auto_approve: false };
      case 'destroy':           return { workspace, target: 'module.api_gateway' };
      case 'state_rm':          return { workspace, address: 'aws_s3_bucket.legacy_audit_logs' };
      case 'state_mv':          return { workspace, from: 'aws_s3_bucket.foo', to: 'aws_s3_bucket.bar' };
      case 'import':            return { workspace, address: 'aws_s3_bucket.audit_logs', id: 'aegis-audit-prod' };
      case 'taint':             return { workspace, address: 'aws_instance.api_gateway' };
      case 'workspace_new':     return { name: 'feature-branch-1' };
      case 'workspace_delete':  return { workspace: 'feature-branch-1' };
    }
    return { workspace };
  }

  // Postgres
  if (connector === 'postgres') {
    const db = pick(POSTGRES_DBS);
    const table = pick(POSTGRES_TABLES);
    switch (tool) {
      case 'query_select':      return { database: db, sql: `SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 50` };
      case 'describe_table':    return { database: db, table };
      case 'list_tables':       return { database: db };
      case 'list_databases':    return {};
      case 'show_indexes':      return { database: db, table };
      case 'show_constraints':  return { database: db, table };
      case 'explain_plan':      return { database: db, sql: `SELECT * FROM ${table} WHERE room_id = $1` };
      case 'query_insert':      return { database: db, sql: `INSERT INTO ${table} (room_id, payload) VALUES ($1, $2)` };
      case 'query_update':      return { database: db, sql: `UPDATE ${table} SET status = 'archived' WHERE room_id = $1` };
      case 'create_table':      return { database: db, table: 'audit_archive', columns: '(id uuid, payload jsonb, archived_at timestamptz)' };
      case 'alter_table':       return { database: db, table, change: 'ADD COLUMN archived_at timestamptz' };
      case 'create_index':      return { database: db, table, columns: '(room_id, decided_at)' };
      case 'query_delete':      return { database: db, sql: `DELETE FROM ${table} WHERE deleted_at < NOW() - INTERVAL '90 days'` };
      case 'drop_table':        return { database: db, table: 'approvals_v1' };
      case 'truncate_table':    return { database: db, table: 'audit_events_v1' };
      case 'drop_index':        return { database: db, name: 'idx_legacy_decided_at' };
      case 'run_migration':     return { database: db, migration: '0042_audit_retention.sql' };
    }
    return { database: db, table };
  }

  // GitHub (default fallback)
  return { repo, branch };
}

// ── Contextual Intelligence Layer (CIL) demo signals ─────────────────────
//
// In production this is computed by a real baseline + statistical model.
// For the demo, we synthesize plausible-looking signals correlated with
// blast radius + decision so the pitch demo doesn't show "high risk" rows
// that the policy engine cleanly ALLOWED.

const BLAST_RISK_FLOOR: Record<string, number> = {
  Low: 0.08,
  Medium: 0.28,
  High: 0.55,
  Critical: 0.78,
};

function riskScoreFor(decision: string, blast: string): number {
  // Base floor from blast radius, lifted further when the action also
  // tripped a policy (DENY / REQUIRE_APPROVAL).
  const base = BLAST_RISK_FLOOR[blast] ?? 0.12;
  const decisionLift =
    decision === 'DENY' ? 0.18 : decision === 'REQUIRE_APPROVAL' ? 0.12 : decision === 'REWRITE' ? 0.06 : 0;
  const noise = (rand() - 0.5) * 0.1;
  return Math.max(0, Math.min(1, base + decisionLift + noise));
}

// Realistic anomaly explanations seeded by tool family so the banner
// reads as something CIL actually noticed about THIS action, not a
// generic "weird thing happened" message.
const ANOMALY_REASONS_BY_CONNECTOR: Record<ConnectorSlug, readonly string[]> = {
  github: [
    'touched 47 files in one commit; agent baseline is 3–7',
    'force-pushed to a protected branch; never observed for this agent',
    'opened 11 PRs in 6 minutes; baseline ≤ 2/hour',
    'created branch off a 4-month-old commit; baseline is HEAD-1d',
  ],
  slack: [
    'posted in 9 channels in 2 minutes; baseline is 1–2/session',
    'first time this agent has DM-d an external workspace member',
    'archive_channel from an agent that has never written before',
  ],
  linear: [
    're-prioritized 14 issues in one session; baseline ≤ 3',
    'closed a P0 without a referenced PR; pattern matches review-skip',
    'assigned 22 issues to a single user; off baseline by 5×',
  ],
  jira: [
    'transitioned 18 tickets to Done in 4 minutes',
    'deleted issue without an audit comment; matches review-skip pattern',
  ],
  'github-actions': [
    'dispatched the deploy-prod workflow from an unverified branch',
    'rotated 3 secrets in one session; baseline is 0',
    'cancelled a passing CI run during freeze window',
  ],
  terraform: [
    'queued `apply` against production from a non-OWNER agent',
    'attempted `destroy` on the data-platform workspace; never observed',
    'removed 4 resources from state in one call',
  ],
  postgres: [
    'DELETE without a WHERE on table `audit_events`',
    'DROP TABLE on the production replica; baseline never sees this',
    'SELECT pattern matches PII scrape across `members` + `audit_events`',
    'ran 23 schema migrations in 90 seconds',
  ],
  datadog: [
    'silenced 47 monitors at 03:14 IST; baseline ≤ 2 silences/session',
    'force-resolved an active P1 incident without a postmortem link',
    'deleted the customer-facing SLO dashboard; never observed before',
    'added a synthetic check from a region the agent has never touched',
  ],
  sentry: [
    'bulk-resolved 200 errors in the payments namespace in 8 seconds',
    'marked the runaway-loop cluster as `won\'t fix` mid-incident',
    'first time this agent has deleted a Sentry project',
    'resolution rate jumped 12× baseline; no matching fix PR landed',
  ],
  kubernetes: [
    '`kubectl delete pod -l app=payments --all` on prod; baseline never sees',
    'exec into a database pod; agent has never opened an interactive shell',
    'drained ip-10-0-3-141 outside the scheduled maintenance window',
    'scaled the runs-ingest deployment to 0 replicas without a rollback plan',
  ],
  cloudflare: [
    'created a public DNS record exposing an internal admin hostname',
    'purged the entire production cache during peak traffic',
    'deleted the api.runaegis.co edge worker; baseline never sees this',
    'updated a KV namespace touching 14k keys in one burst',
  ],
  notion: [
    'shared the SOC 2 evidence page publicly; baseline is internal-only',
    'archived 18 launch-readiness checklist pages in 90 seconds',
    'first time this agent has touched the executive workspace',
    'mass-deleted a database schema with 200+ tracked rows',
  ],
};

/**
 * Compose CIL anomaly signal for a run. Returns null for normal
 * actions; an anomaly object when the run should be flagged.
 *
 * Rate-tuned so ~6–10% of demo runs are flagged anomalous, with the
 * flag heavily concentrated on REQUIRE_APPROVAL / DENY + High /
 * Critical blast radius rows. That's the right shape for the
 * "CIL caught what static policies would miss" pitch story.
 */
function maybeAnomalyFor(
  tool: string,
  decision: string,
  blast: string,
): { anomaly: true; anomaly_reason: string } | { anomaly: false; anomaly_reason: null } {
  // Probability ramps with blast + tightened-decision.
  let p = 0;
  if (blast === 'Critical') p += 0.4;
  else if (blast === 'High') p += 0.22;
  else if (blast === 'Medium') p += 0.06;
  if (decision === 'DENY') p += 0.15;
  else if (decision === 'REQUIRE_APPROVAL') p += 0.1;
  if (rand() > p) return { anomaly: false, anomaly_reason: null };

  const connector = connectorForTool(tool);
  const reasons = ANOMALY_REASONS_BY_CONNECTOR[connector] ?? ANOMALY_REASONS_BY_CONNECTOR.github;
  return { anomaly: true, anomaly_reason: pick(reasons) };
}

// ─── Canonical Layer 2 (CIL / Semantic Classifier) ───────────────────────
//
// Mirrors the backend `lib/semantic_classifier.py`. Produces the 10
// canonical semantic_types deterministically from (tool, decision,
// branch, args). The decision is DERIVED from the semantic_type via
// the canonical mapping — same flow as the live classifier.
//
// In this demo layer, we work backwards from the existing (tool,
// decision, branch) to a CONSISTENT semantic_type. This keeps the
// existing decision distribution but adds the canonical reasoning
// trace on top.

/** Canonical action_type for each tool name. Mirrors the Layer 1
 *  normalization that makes policies portable across MCP servers. */
const CANONICAL_ACTION_TYPE: Record<string, string> = {
  // GitHub
  push_files: 'push_commit',
  create_or_update_file: 'push_commit',
  create_branch: 'create_branch',
  create_pull_request: 'create_pull_request',
  merge_pull_request: 'merge_pull_request',
  get_file_contents: 'read_file',
  list_repository_files: 'read_repo',
  get_repository: 'read_repo',
  search_code: 'read_repo',
  search_repositories: 'read_repo',
  list_branches: 'read_repo',
  list_issues: 'read_issue',
  get_issue: 'read_issue',
  create_issue: 'create_issue',
  get_pull_request: 'read_pr',
  search_issues: 'read_issue',
  get_latest_commit: 'read_repo',
  // Slack
  post_message: 'post_message',
  post_thread_reply: 'post_message',
  upload_file: 'upload_file',
  invite_user_to_channel: 'modify_channel',
  add_reaction: 'react_to_message',
  list_channels: 'read_channels',
  list_users: 'read_users',
  get_channel_history: 'read_messages',
  get_thread_replies: 'read_messages',
  search_messages: 'read_messages',
  delete_message: 'delete_message',
  archive_channel: 'modify_channel',
  kick_user: 'modify_channel',
  // Linear / Jira
  update_issue: 'update_issue',
  add_issue_comment: 'add_comment',
  add_comment: 'add_comment',
  create_subtask: 'create_issue',
  move_issue: 'transition_issue',
  assign_issue: 'update_issue',
  set_priority: 'update_issue',
  transition_issue: 'transition_issue',
  // GitHub Actions
  dispatch_workflow: 'trigger_workflow_dispatch',
  rerun_workflow: 'rerun_workflow',
  cancel_workflow_run: 'cancel_workflow',
  // Terraform
  terraform_apply: 'terraform_apply',
  terraform_destroy: 'terraform_destroy',
  terraform_plan: 'terraform_plan',
  // Postgres
  query_select: 'execute_query_read',
  query_insert: 'execute_query_write',
  query_update: 'execute_query_write',
  query_delete: 'execute_query_destructive',
  drop_table: 'execute_query_destructive',
  truncate_table: 'execute_query_destructive',
  run_migration: 'execute_migration',
  alter_table: 'alter_table',
};

/** Canonical semantic_type → decision mapping. Source of truth lives
 *  in the spec; copied here so the demo's decisions stay consistent
 *  with the classifier's outputs. */
const SEMANTIC_TYPE_TO_DECISION: Record<SemanticType, string> = {
  working_commit:            'ALLOW',
  ephemeral_force_push:      'ALLOW',
  test_only_change:          'ALLOW',
  protected_branch_write:    'REWRITE',
  freeze_window_violation:   'DENY',
  credential_exposure:       'DENY',
  large_blast_radius_change: 'REQUIRE_APPROVAL',
  sensitive_path_change:     'REQUIRE_APPROVAL',
  autonomous_merge_attempt:  'DENY',
  sequence_anomaly:          'REQUIRE_APPROVAL',
};

/** Canonical semantic_type → blast_radius mapping. The classifier's
 *  baseline output; specific actions can override (e.g. a `terraform_apply`
 *  that's also a sensitive_path_change gets bumped to critical). */
const SEMANTIC_TYPE_TO_BLAST: Record<SemanticType, BlastRadiusLevel> = {
  working_commit:            'low',
  ephemeral_force_push:      'minimal',
  test_only_change:          'low',
  protected_branch_write:    'high',
  freeze_window_violation:   'high',
  credential_exposure:       'critical',
  large_blast_radius_change: 'high',
  sensitive_path_change:     'critical',
  autonomous_merge_attempt:  'high',
  sequence_anomaly:          'high',
};

/** Generate the human-readable reasoning string the classifier emits.
 *  Reads like a real audit log line — "Direct write to protected branch
 *  'main' during active release freeze (Fri 18:00 → Mon 09:00 IST)". */
function blastRadiusReasonFor(
  semanticType: SemanticType,
  ctx: {
    tool: string;
    branch?: string | null;
    repo?: string;
    args?: Record<string, unknown>;
    freezeLabel?: string;
  },
): string {
  const branch = ctx.branch ?? 'main';
  switch (semanticType) {
    case 'working_commit':
      return `Routine commit by session owner to working branch '${branch}'. No protected-branch or freeze-window flags fired.`;
    case 'ephemeral_force_push':
      return `Force-push to aegis-managed working branch '${branch}' by session owner. No open PR on branch; safe per ephemeral_force_push rule.`;
    case 'test_only_change':
      return `Diff touches only paths matching tests/, docs/, or spec/. Classified test_only_change; routine ALLOW.`;
    case 'protected_branch_write':
      return `Direct write to protected/default branch '${branch}'. Auto-rewritten to feature branch with PR opened to '${branch}'.`;
    case 'freeze_window_violation':
      return `Write attempted during active freeze window${ctx.freezeLabel ? ` (${ctx.freezeLabel})` : ''} on protected branch '${branch}'. Hard DENY per P10.`;
    case 'credential_exposure': {
      const cred = ['OpenAI API Key', 'GitHub Token', 'Stripe API Key', 'AWS Access Key', 'Anthropic API Key', 'Bearer token'];
      return `Detected exposed credentials: ${pick(cred)}. Hard pre-policy DENY before payload reaches downstream MCP.`;
    }
    case 'large_blast_radius_change': {
      const fileCount = 50 + Math.floor(rand() * 80);
      return `Diff touches ${fileCount} files across ${1 + Math.floor(rand() * 4)} packages. Exceeds blast-radius threshold; routed to Approval.`;
    }
    case 'sensitive_path_change': {
      const path = pick(['.github/workflows/deploy.yml', 'terraform/modules/network/main.tf', 'auth/oauth.ts', 'security/csp.config.ts', 'infra/k8s/prod-ingress.yaml']);
      return `Write to sensitive path '${path}'. Requires human approval per P7.`;
    }
    case 'autonomous_merge_attempt':
      return `merge_pull_request called without recorded human PR approval. Hard DENY per P4.`;
    case 'sequence_anomaly': {
      const pushCount = 6 + Math.floor(rand() * 4);
      const failures = 3 + Math.floor(rand() * 3);
      return `Agent has pushed ${pushCount}× this session with ${failures} consecutive CI failures. Sequence anomaly — paused for review.`;
    }
  }
}

/**
 * Classify a demo action into its canonical semantic_type. Works
 * backwards from the (tool, decision, branch) the demo data already
 * picked, choosing the semantic_type that's most consistent. For
 * specific high-value canonical examples (protected_branch_write,
 * freeze_window_violation), we override with the dramatic version
 * so investors and customers see the moat at a glance.
 */
function classifyForDemo(
  tool: string,
  decision: string,
  branch: string | null,
  args: Record<string, unknown>,
): { semantic_type: SemanticType; blast_radius: BlastRadiusLevel; blast_radius_reason: string; confidence: number } {
  const isWrite = WRITE_TOOLS_RAW.has(tool);
  const branchLc = (branch ?? '').toLowerCase();
  const isProtected = PROTECTED_BRANCHES.has(branchLc);
  const isAegis = branchLc === 'aegis_workstation' || branchLc.startsWith('aegis/');
  const isFeature = branchLc.startsWith('feature/') || branchLc.startsWith('fix/') || branchLc.startsWith('chore/');

  // Specific path-aware checks for write tools. Look at args for path hints.
  const path = (args.path as string) ?? '';
  const message = (args.message as string) ?? '';
  const content = (args.content as string) ?? '';
  const sql = (args.sql as string) ?? '';
  const payloadText = `${path} ${message} ${content} ${sql}`.toLowerCase();

  const looksSensitive = SENSITIVE_PATH_PREFIXES.some((p) => path.startsWith(p));
  const looksTestOnly = !!path && TEST_PATH_PREFIXES.some((p) => path.startsWith(p));
  const looksLikeSecret =
    /api[_-]?key|token|password|secret|bearer|aws_access|stripe_key/i.test(payloadText) ||
    /\.env|\.pem|\.key|credentials\.json|secrets\.yaml/.test(path);
  const looksLikeMerge = tool === 'merge_pull_request';
  const looksDestructive = /drop\s+table|truncate|delete\s+from/i.test(sql);

  // Tool-aware early classifications — prevents read actions from
  // falling into write-only fallback paths (e.g. list_secrets being
  // tagged as autonomous_merge_attempt or list_branches being tagged as
  // freeze_window_violation). Both were real demo bugs.
  const looksLikeSecretEnumeration = /^(list_secrets|get_secret|get_secrets|list_credentials)$/i.test(tool);
  const isReadOnlyTool = /^(list_|get_|search_)/.test(tool) && !looksLikeSecretEnumeration;

  // Agent enumerating the secrets store is suspicious — DENY before
  // credentials are exposed. Great governance demo moment.
  if (looksLikeSecretEnumeration) {
    return {
      semantic_type: 'credential_exposure',
      blast_radius: 'critical',
      blast_radius_reason: 'Agent attempted to enumerate the secrets store. Hard pre-policy DENY before credentials are exposed.',
      confidence: 0.95,
    };
  }

  // Other read-only tools always classify as routine ALLOW. Reads
  // don't mutate state so they never fire a write-tier policy.
  if (isReadOnlyTool) {
    return {
      semantic_type: 'working_commit',
      blast_radius: 'minimal',
      blast_radius_reason: 'Read action — no state mutation, no policy concern.',
      confidence: 1.0,
    };
  }

  // Priority order matches the backend classifier:
  // credential_exposure > sensitive_path_change > freeze_window_violation
  // > ephemeral_force_push > protected_branch_write > test_only_change
  // > sequence_anomaly > autonomous_merge_attempt > working_commit / default

  if (isWrite && looksLikeSecret) {
    return {
      semantic_type: 'credential_exposure',
      blast_radius: 'critical',
      blast_radius_reason: blastRadiusReasonFor('credential_exposure', { tool, branch, args }),
      confidence: 0.95,
    };
  }
  if (isWrite && looksSensitive) {
    return {
      semantic_type: 'sensitive_path_change',
      blast_radius: 'critical',
      blast_radius_reason: blastRadiusReasonFor('sensitive_path_change', { tool, branch, args }),
      confidence: 0.92,
    };
  }
  // Freeze window — only when decision is DENY and branch is protected
  if (isWrite && isProtected && decision === 'DENY') {
    return {
      semantic_type: 'freeze_window_violation',
      blast_radius: 'high',
      blast_radius_reason: blastRadiusReasonFor('freeze_window_violation', { tool, branch, args, freezeLabel: 'Release Fridays 18:00 IST → Mon 09:00 IST' }),
      confidence: 1.0,
    };
  }
  if (isWrite && isAegis) {
    return {
      semantic_type: 'ephemeral_force_push',
      blast_radius: 'minimal',
      blast_radius_reason: blastRadiusReasonFor('ephemeral_force_push', { tool, branch, args }),
      confidence: 1.0,
    };
  }
  if (isWrite && isProtected) {
    // Decision should be REWRITE here per the canonical mapping
    return {
      semantic_type: 'protected_branch_write',
      blast_radius: 'high',
      blast_radius_reason: blastRadiusReasonFor('protected_branch_write', { tool, branch, args }),
      confidence: 1.0,
    };
  }
  if (isWrite && looksTestOnly) {
    return {
      semantic_type: 'test_only_change',
      blast_radius: 'low',
      blast_radius_reason: blastRadiusReasonFor('test_only_change', { tool, branch, args }),
      confidence: 0.9,
    };
  }
  if (looksLikeMerge && decision === 'DENY') {
    return {
      semantic_type: 'autonomous_merge_attempt',
      blast_radius: 'high',
      blast_radius_reason: blastRadiusReasonFor('autonomous_merge_attempt', { tool, branch, args }),
      confidence: 0.9,
    };
  }
  if (looksDestructive && decision === 'REQUIRE_APPROVAL') {
    return {
      semantic_type: 'large_blast_radius_change',
      blast_radius: 'high',
      blast_radius_reason: blastRadiusReasonFor('large_blast_radius_change', { tool, branch, args }),
      confidence: 0.85,
    };
  }
  if (decision === 'REQUIRE_APPROVAL') {
    // Distribute REQUIRE_APPROVAL between sequence_anomaly / large_blast_radius
    const t: SemanticType = rand() < 0.4 ? 'sequence_anomaly' : 'large_blast_radius_change';
    return {
      semantic_type: t,
      blast_radius: 'high',
      blast_radius_reason: blastRadiusReasonFor(t, { tool, branch, args }),
      confidence: 0.8,
    };
  }
  if (decision === 'DENY') {
    // Tool-aware DENY fallback. Don't random-pick between freeze /
    // autonomous_merge for tools that aren't writes or merges — that's
    // how the original demo bugs (list_secrets → autonomous_merge_attempt,
    // list_branches → freeze_window_violation) snuck through.
    if (looksLikeMerge) {
      return {
        semantic_type: 'autonomous_merge_attempt',
        blast_radius: 'high',
        blast_radius_reason: blastRadiusReasonFor('autonomous_merge_attempt', { tool, branch, args }),
        confidence: 0.9,
      };
    }
    if (isWrite && isProtected) {
      return {
        semantic_type: 'freeze_window_violation',
        blast_radius: 'high',
        blast_radius_reason: blastRadiusReasonFor('freeze_window_violation', { tool, branch, args, freezeLabel: 'Release Fridays 18:00 IST → Mon 09:00 IST' }),
        confidence: 0.9,
      };
    }
    // Catch-all DENY — credential_exposure is the most generic security
    // story and never makes the row "look wrong" the way merge / freeze do.
    return {
      semantic_type: 'credential_exposure',
      blast_radius: 'critical',
      blast_radius_reason: blastRadiusReasonFor('credential_exposure', { tool, branch, args }),
      confidence: 0.85,
    };
  }
  if (decision === 'REWRITE') {
    return {
      semantic_type: 'protected_branch_write',
      blast_radius: 'high',
      blast_radius_reason: blastRadiusReasonFor('protected_branch_write', { tool, branch, args }),
      confidence: 1.0,
    };
  }
  // Default ALLOW path — working_commit (most common)
  return {
    semantic_type: isFeature ? 'working_commit' : 'working_commit',
    blast_radius: 'low',
    blast_radius_reason: blastRadiusReasonFor('working_commit', { tool, branch, args }),
    confidence: 0.95,
  };
}

// Local WRITE_TOOLS set — needed BEFORE the larger WRITE_TOOLS export
// below because the classifier runs during makeRun() which is called
// before that export. Keep both in sync.
const WRITE_TOOLS_RAW = new Set<string>([
  'push_files',
  'create_or_update_file',
  'create_branch',
  'create_pull_request',
  'create_issue',
  'merge_pull_request',
  'post_message',
  'post_thread_reply',
  'upload_file',
  'invite_user_to_channel',
  'add_reaction',
  'update_issue',
  'add_issue_comment',
  'add_comment',
  'create_subtask',
  'move_issue',
  'assign_issue',
  'set_priority',
  'transition_issue',
  'dispatch_workflow',
  'rerun_workflow',
  'cancel_workflow_run',
  'terraform_apply',
  'terraform_destroy',
  'query_insert',
  'query_update',
  'query_delete',
  'drop_table',
  'truncate_table',
  'run_migration',
  'alter_table',
  'archive_channel',
  'delete_message',
  'kick_user',
]);

/** Generate plausible context snapshots that JUSTIFY a given semantic_type.
 *  The four context structs that Layer 2 assembles before classification —
 *  in the demo we build them backwards from the semantic_type so the audit
 *  trail is coherent. Reading the snapshots, you can see why the classifier
 *  fired what it fired. */
function generateContextSnapshots(
  semantic_type: SemanticType,
  ctx: {
    sessionId: string;
    agentName: string;
    branch: string | null;
    repo: string;
    timestamp: string;
    sequenceOrder: number;
    delegationUser?: string;
  },
): {
  session: SessionContextSnapshot;
  repo: RepoContextSnapshot;
  branch: BranchContextSnapshot;
  env: EnvContextSnapshot;
} {
  const branch = ctx.branch ?? 'main';
  const branchLc = branch.toLowerCase();
  const isProtected = PROTECTED_BRANCHES.has(branchLc);
  const isAegis = branchLc === 'aegis_workstation' || branchLc.startsWith('aegis/');

  const session: SessionContextSnapshot = {
    session_id: ctx.sessionId,
    agent_name: ctx.agentName,
    human_initiator: ctx.delegationUser ?? null,
    started_at: ctx.timestamp,
    push_count: semantic_type === 'sequence_anomaly' ? 6 + Math.floor(rand() * 4) : 1 + Math.floor(rand() * 4),
    denial_count: semantic_type === 'sequence_anomaly' ? 3 + Math.floor(rand() * 2) : Math.floor(rand() * 2),
    ci_failure_streak: semantic_type === 'sequence_anomaly' ? 3 + Math.floor(rand() * 2) : 0,
    sequence_order: ctx.sequenceOrder,
    linked_ticket: rand() < 0.6 ? pick(['AEGIS-247', 'AEGIS-301', 'AEGIS-419', 'PROD-88', 'PROD-122']) : null,
    workflow_stage: pick(['planning', 'coding', 'review', 'deploy', 'incident']) as SessionContextSnapshot['workflow_stage'],
    active_approval_count: semantic_type === 'large_blast_radius_change' || semantic_type === 'sensitive_path_change' ? 1 : 0,
    last_action_type: 'push_commit',
  };

  const repo: RepoContextSnapshot = {
    repo_id: ctx.repo,
    owner: ctx.repo.split('/')[0] ?? 'aegis',
    target_branch: branch,
    is_protected_branch: isProtected,
    protected_branches: ['main', 'master', 'release'],
    ci_passing: semantic_type === 'freeze_window_violation' || semantic_type === 'sequence_anomaly' || semantic_type === 'autonomous_merge_attempt'
      ? false
      : true,
    ci_failure_reason: semantic_type === 'sequence_anomaly'
      ? 'auth.spec.ts failing — TypeError: Cannot read property `sub` of undefined'
      : semantic_type === 'freeze_window_violation'
        ? 'integration-deploy.yml failed 2h 14m ago (timeout)'
        : null,
    freeze_window_active: semantic_type === 'freeze_window_violation',
    freeze_window_label: semantic_type === 'freeze_window_violation' ? 'Release Fridays 18:00 IST → Mon 09:00 IST' : null,
    freeze_window_expires: semantic_type === 'freeze_window_violation'
      ? new Date(Date.parse(ctx.timestamp) + 38 * 60 * 60 * 1000).toISOString()
      : null,
    open_pr_count: Math.floor(rand() * 4),
    last_deployment_at: new Date(Date.parse(ctx.timestamp) - (2 + Math.random() * 48) * 60 * 60 * 1000).toISOString(),
    sensitivity_level: semantic_type === 'sensitive_path_change' ? 'critical' : isProtected ? 'elevated' : 'standard',
  };

  const branchSnap: BranchContextSnapshot = {
    branch_name: branch,
    is_aegis_managed: isAegis,
    session_owner_match: isAegis ? true : rand() < 0.6,
    has_open_pr: semantic_type === 'protected_branch_write' ? false : rand() < 0.4,
    pr_number: rand() < 0.4 ? 200 + Math.floor(rand() * 800) : null,
    pr_reviewers: rand() < 0.5 ? ['kartik', 'jenil'] : [],
    branch_age_seconds: isAegis ? Math.floor(rand() * 60 * 60 * 4) : Math.floor(rand() * 60 * 60 * 24 * 14),
    commit_count_this_session: 1 + Math.floor(rand() * 8),
    last_pushed_by: ctx.delegationUser ?? ctx.agentName,
  };

  const env: EnvContextSnapshot = {
    environment_tier: isProtected ? 'production' : pick(['dev', 'staging', 'production']) as EnvContextSnapshot['environment_tier'],
    active_incident: semantic_type === 'sensitive_path_change' || semantic_type === 'freeze_window_violation' ? rand() < 0.4 : rand() < 0.05,
    incident_id: null,
    incident_severity: null,
    within_business_hours: !(semantic_type === 'freeze_window_violation'),
    timezone: 'Asia/Kolkata',
    deploy_locked: semantic_type === 'freeze_window_violation',
  };

  return { session, repo, branch: branchSnap, env };
}

// ── Agent delegation chain ───────────────────────────────────────────────
// Real-world Aegis records who-on-whose-behalf for every action. We mock
// a set of plausible humans with role mixes; each run gets stably
// assigned the delegation of its session so the journey reads as one
// human's work, not "scattered agents acting for random users."

const DEMO_HUMANS: Array<{ user: string; role: SessionAction['delegation'] extends infer T
  ? T extends { role: infer R } ? R : never : never }> = [
  { user: 'Ahaan Iqbal',      role: 'OWNER' },
  { user: 'Mujtaba Basheer',  role: 'ADMIN' },
  { user: 'Kartik Gupta',     role: 'DEVELOPER' },
  { user: 'Jenil Parmar',     role: 'DEVELOPER' },
  { user: 'Priya Subramanian', role: 'REVIEWER' },
];

const DELEGATION_EXPIRIES = [
  'in 4h',
  'in 7h',
  'in 38m',
  'Mon 09:00 IST',
  'Today 18:00 IST',
  'in 2h 14m',
];

/** Stable delegation per session — every action in a session is on
 *  behalf of the same human, in the same role, in the same scope. */
const DELEGATION_BY_SESSION_ID: Map<
  string,
  { user: string; role: string; expires_in: string }
> = new Map(
  SESSION_IDS.map((id) => {
    const human = pick(DEMO_HUMANS);
    return [
      id,
      {
        user: human.user,
        role: String(human.role),
        expires_in: pick(DELEGATION_EXPIRIES),
      },
    ];
  }),
);

function makeRun(seq: number): SessionAction {
  const ageDays = rand() ** 1.7 * 14; // bias toward recent
  const timestamp = new Date(NOW - ageDays * ONE_DAY).toISOString();
  const agent = pick(AGENTS);
  const sessionId = pick(SESSION_IDS);
  // Session-archetype-aware tool selection so each session reads as
  // a coherent agent journey across a primary surface + a few
  // secondary surfaces.
  const tool = pickToolForSession(sessionId);
  const repo = pick(REPOS);
  const branch = pick(BRANCHES);
  const decision = pickW(DECISIONS);
  const args = argsForTool(tool, repo, branch);
  const del = DELEGATION_BY_SESSION_ID.get(sessionId);

  // ── Layer 2 (CIL / Semantic Classifier) — canonical pipeline ──────
  // Run the demo classifier on (tool, decision, branch, args). The
  // semantic_type is the primary CIL output; blast_radius and
  // blast_radius_reason follow from it. Decision stays whatever the
  // weighted picker produced, except for cases where the classifier
  // forces consistency (e.g. branch=aegis_workstation must ALLOW).
  const cilResult = classifyForDemo(tool, decision, branch, args);

  // Enforce canonical decision mapping for the high-signal cases so
  // the demo's reasoning trace stays internally consistent:
  // - ephemeral_force_push → ALLOW
  // - protected_branch_write → REWRITE
  // - credential_exposure → DENY
  // - freeze_window_violation → DENY
  // - autonomous_merge_attempt → DENY
  let finalDecision = decision;
  if (
    cilResult.semantic_type === 'ephemeral_force_push' ||
    cilResult.semantic_type === 'test_only_change' ||
    cilResult.semantic_type === 'working_commit'
  ) {
    finalDecision = 'ALLOW';
  } else if (cilResult.semantic_type === 'protected_branch_write') {
    finalDecision = 'REWRITE';
  } else if (
    cilResult.semantic_type === 'credential_exposure' ||
    cilResult.semantic_type === 'freeze_window_violation' ||
    cilResult.semantic_type === 'autonomous_merge_attempt'
  ) {
    finalDecision = 'DENY';
  } else if (
    cilResult.semantic_type === 'sensitive_path_change' ||
    cilResult.semantic_type === 'large_blast_radius_change' ||
    cilResult.semantic_type === 'sequence_anomaly'
  ) {
    finalDecision = 'REQUIRE_APPROVAL';
  }

  const blast = cilResult.blast_radius;
  // Legacy behavioral-amplifier signal — still useful as a Series-A
  // overlay on top of the canonical classifier. ~12% of actions
  // also fire a behavioral anomaly (statistical baseline drift).
  const cilLegacy = maybeAnomalyFor(tool, finalDecision, blast);

  // Generate the four context snapshots that JUSTIFY the semantic_type.
  // The Approval detail page renders these as the reasoning trace.
  const snapshots = generateContextSnapshots(cilResult.semantic_type, {
    sessionId,
    agentName: agent,
    branch,
    repo,
    timestamp,
    sequenceOrder: seq,
    delegationUser: del?.user,
  });

  // REWRITE-specific fields. When the classifier returns
  // protected_branch_write, Aegis auto-creates a feature branch and
  // opens a PR. Synthesize plausible URLs for the demo.
  const isRewrite = cilResult.semantic_type === 'protected_branch_write';
  const rewritePrNumber = isRewrite ? 200 + Math.floor(rand() * 800) : null;
  const rewriteTargetBranch = isRewrite
    ? `feature/aegis-rewrite-${seq.toString().padStart(4, '0')}`
    : null;
  const rewritePrUrl = isRewrite
    ? `https://github.com/${repo}/pull/${rewritePrNumber}`
    : null;

  return {
    id: uuid(),
    session_id: sessionId,
    agent_name: agent,
    tool_name: tool,
    arguments: args,
    action_summary: phraseForTool(tool),
    result: finalDecision,
    decision: finalDecision,
    target_repo: repo,
    target_branch: branch,
    sequence_order: seq,
    timestamp,
    user_id: 'preview-user',
    execution_time: Math.floor(80 + rand() * rand() * 6500),
    // Risk signal — correlated with decision so demo mode shows the same
    // patterns prospects would see in a real workspace. PolicyChip +
    // BlastRadiusChip read these on the Runs / Sessions / Room Logs pages.
    policy: policyForDecision(finalDecision),
    blast_redius: blast,
    blast_radius: blast,
    // ── Behavioral amplifier (Series-A roadmap) ─────────────────────
    risk_score: riskScoreFor(finalDecision, blast),
    anomaly: cilLegacy.anomaly,
    anomaly_reason: cilLegacy.anomaly_reason,
    // ── Canonical Layer 2 outputs (primary CIL signals) ─────────────
    semantic_type: cilResult.semantic_type,
    blast_radius_reason: cilResult.blast_radius_reason,
    classifier_confidence: cilResult.confidence,
    canonical_action_type: CANONICAL_ACTION_TYPE[tool] ?? tool,
    session_context_snapshot: snapshots.session,
    repo_context_snapshot: snapshots.repo,
    branch_context_snapshot: snapshots.branch,
    env_context_snapshot: snapshots.env,
    // REWRITE-specific
    rewrite_target_branch: rewriteTargetBranch,
    rewrite_pr_number: rewritePrNumber,
    rewrite_pr_url: rewritePrUrl,
    // Agent delegation chain — "Acting as <user> · <role> · <scope>"
    delegation: del
      ? {
          user: del.user,
          role: del.role,
          scope: repo,
          expires_in: del.expires_in,
        }
      : null,
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
        connectors: [],
        has_anomaly: false,
        // Trigger taxonomy — preset by archetype, overridden to `test`
        // for ~1-in-4 sessions by `TRIGGER_BY_SESSION_ID`. Default to
        // 'chat' for unmapped sessions so legacy data still renders.
        trigger_type: TRIGGER_BY_SESSION_ID.get(sid) ?? 'chat',
        // Canonical Layer 2 signals at session level. Collect unique
        // semantic_types this session produced + flag REWRITE.
        semantic_types: [],
        has_rewrite: false,
      });
    }
    const s = map.get(sid)!;
    s.action_count = Number(s.action_count) + 1;
    if (r.timestamp < s.started_at!) s.started_at = r.timestamp;
    if (r.timestamp > s.last_action_at!) s.last_action_at = r.timestamp;
    if (r.target_repo && !(s.repos as string[]).includes(r.target_repo)) {
      (s.repos as string[]).push(r.target_repo);
    }
    // Track unique connectors touched + whether any action tripped
    // a CIL anomaly. These power the "tool journey" badge and the
    // session-level anomaly chip on the Sessions table row.
    const cn = connectorForTool(r.tool_name);
    const connectors = (s.connectors as string[] | undefined) ?? [];
    if (!connectors.includes(cn)) connectors.push(cn);
    s.connectors = connectors;
    if (r.anomaly) s.has_anomaly = true;
    // Track unique semantic_types + has_rewrite for the session row.
    if (r.semantic_type) {
      const sts = (s.semantic_types as SemanticType[]) ?? [];
      if (!sts.includes(r.semantic_type)) sts.push(r.semantic_type);
      s.semantic_types = sts;
    }
    if (r.decision === 'REWRITE') s.has_rewrite = true;
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
// APPROVALS are derived directly from REQUIRE_APPROVAL runs so the
// Approval detail page can locate the source SessionAction (with its
// full canonical CIL context: semantic_type + blast_radius_reason +
// 4 context snapshots). Previously approvals were independently
// generated, which broke the matchingRun lookup and hid the moat
// evidence. Now: each approval is tied to a real run.
const _approvalSourceRuns = RUNS.filter(
  (r) => r.decision === 'REQUIRE_APPROVAL',
).slice(0, 11);

const APPROVALS: MCPApproval[] = _approvalSourceRuns.map((run, i) => {
  const status = pickW(APPROVAL_STATUSES);
  const approved_at =
    status === 'pending'
      ? null
      : new Date(
          Date.parse(run.timestamp) + rand() * 60 * 60 * 1000,
        ).toISOString();
  return {
    id: `apv_${i}_${uuid()}`,
    user_id: 'preview-user',
    tool_name: run.tool_name,
    arguments: run.arguments,
    status,
    created_at: run.timestamp,
    approved_at,
    result: null,
    context: {
      user: run.agent_name,
      conversation_id: `conv_${uuid().slice(0, 6)}`,
      model: run.agent_name,
    },
    action_summary: run.action_summary,
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
  const tool = pickToolWeighted();
  const branch = pick(BRANCHES);
  const decision = pickW(DECISIONS);
  const sessionId = pick(SESSION_IDS);
  const member = pick(members);
  const args = argsForTool(tool, repo, branch);

  // Run the canonical Layer 2 classifier (same as makeRun above).
  const cilResult = classifyForDemo(tool, decision, branch, args);

  // Force consistent decision per canonical mapping.
  let finalDecision = decision;
  if (
    cilResult.semantic_type === 'ephemeral_force_push' ||
    cilResult.semantic_type === 'test_only_change' ||
    cilResult.semantic_type === 'working_commit'
  ) {
    finalDecision = 'ALLOW';
  } else if (cilResult.semantic_type === 'protected_branch_write') {
    finalDecision = 'REWRITE';
  } else if (
    cilResult.semantic_type === 'credential_exposure' ||
    cilResult.semantic_type === 'freeze_window_violation' ||
    cilResult.semantic_type === 'autonomous_merge_attempt'
  ) {
    finalDecision = 'DENY';
  } else if (
    cilResult.semantic_type === 'sensitive_path_change' ||
    cilResult.semantic_type === 'large_blast_radius_change' ||
    cilResult.semantic_type === 'sequence_anomaly'
  ) {
    finalDecision = 'REQUIRE_APPROVAL';
  }

  const blast = cilResult.blast_radius;
  const cilLegacy = maybeAnomalyFor(tool, finalDecision, blast);
  const snapshots = generateContextSnapshots(cilResult.semantic_type, {
    sessionId,
    agentName: agent,
    branch,
    repo,
    timestamp,
    sequenceOrder: seq,
    delegationUser: member.username,
  });

  const isRewrite = cilResult.semantic_type === 'protected_branch_write';
  const rewritePrNumber = isRewrite ? 200 + Math.floor(rand() * 800) : null;
  const rewriteTargetBranch = isRewrite
    ? `feature/aegis-rewrite-${seq.toString().padStart(4, '0')}`
    : null;
  const rewritePrUrl = isRewrite
    ? `https://github.com/${repo}/pull/${rewritePrNumber}`
    : null;

  return {
    id: uuid(),
    session_id: sessionId,
    agent_name: agent,
    tool_name: tool,
    arguments: args,
    action_summary: phraseForTool(tool),
    result: finalDecision,
    decision: finalDecision,
    target_repo: repo,
    target_branch: branch,
    sequence_order: seq,
    timestamp,
    user_id: member.user_id ?? member.username ?? 'preview-user',
    execution_time: Math.floor(80 + rand() * rand() * 6500),
    policy: policyForDecision(finalDecision),
    blast_redius: blast,
    blast_radius: blast,
    risk_score: riskScoreFor(finalDecision, blast),
    anomaly: cilLegacy.anomaly,
    anomaly_reason: cilLegacy.anomaly_reason,
    // Canonical Layer 2 outputs
    semantic_type: cilResult.semantic_type,
    blast_radius_reason: cilResult.blast_radius_reason,
    classifier_confidence: cilResult.confidence,
    canonical_action_type: CANONICAL_ACTION_TYPE[tool] ?? tool,
    session_context_snapshot: snapshots.session,
    repo_context_snapshot: snapshots.repo,
    branch_context_snapshot: snapshots.branch,
    env_context_snapshot: snapshots.env,
    rewrite_target_branch: rewriteTargetBranch,
    rewrite_pr_number: rewritePrNumber,
    rewrite_pr_url: rewritePrUrl,
    // Room actions get their delegation from the room member that the
    // action was attributed to.
    delegation: {
      user: member.username || 'unknown',
      role: (member.role as string) || 'DEVELOPER',
      scope: repo,
      expires_in: pick(DELEGATION_EXPIRIES),
    },
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

// Default tool policy per role. Aligned with the seven-connector
// catalog so each role tells a sensible governance story:
//
//   OWNER     — full surface, including destructive ops on data + infra
//   DEVELOPER — full code + comms + planning surface; destructive ops
//               denied (no DROP TABLE, no terraform destroy, no Slack
//               kick, no archive_channel)
//   REVIEWER  — read everything, post comments / approvals, no merges
//               or schema changes
//   VIEWER    — read-only across every connector
//
// Centralized helpers so each role's rule is one declarative line
// instead of an ever-growing list of `.includes()` checks that drift
// as we add tools.

/** Tools that DESTROY something across all 7 connectors. Used by the
 *  DEVELOPER role to exclude high-blast-radius destructive ops. */
const DESTRUCTIVE_TOOLS = new Set<string>([
  // GitHub doesn't have a destructive surface (we never expose
  // delete_repository or delete_branch on agents).
  // Slack
  'delete_message',
  'archive_channel',
  'kick_user',
  // Linear
  'archive_issue',
  'close_issue',
  // Jira
  'delete_issue',
  'archive_project',
  // GitHub Actions
  'delete_secret',
  'delete_workflow_run',
  // Terraform — the entire write/state-mutating surface is destructive
  'apply',
  'destroy',
  'state_rm',
  'state_mv',
  'import',
  'taint',
  'workspace_delete',
  // Postgres — schema and data destructive ops
  'drop_table',
  'truncate_table',
  'drop_index',
  'query_delete',
  'run_migration',
]);

/** Tools that WRITE without destroying. REVIEWERs lose access to
 *  these (they can read + comment but can't push fresh changes). */
const WRITE_TOOLS = new Set<string>([
  // GitHub writes
  'push_files',
  'create_or_update_file',
  'create_branch',
  'create_pull_request',
  'create_issue',
  // Slack writes
  'post_message',
  'post_thread_reply',
  'upload_file',
  'invite_user_to_channel',
  'add_reaction',
  // Linear writes
  'create_issue',
  'update_issue',
  'add_issue_comment',
  'create_subtask',
  'move_issue',
  'assign_issue',
  'set_priority',
  // Jira writes
  'update_issue',
  'add_comment',
  'transition_issue',
  'assign_issue',
  'create_subtask',
  // GitHub Actions writes
  'dispatch_workflow',
  'rerun_workflow',
  'cancel_workflow',
  'update_secret',
  // Terraform write surface = destructive (no non-destructive write).
  // Postgres writes
  'query_insert',
  'query_update',
  'create_table',
  'alter_table',
  'create_index',
]);

/** Read-only tools by naming convention or explicit allowlist.
 *  VIEWERs see exactly this set across every connector. */
function isReadOnlyTool(t: string): boolean {
  return (
    t.startsWith('get_') ||
    t.startsWith('list_') ||
    t.startsWith('search_') ||
    t.startsWith('describe_') ||
    t === 'show_indexes' ||
    t === 'show_constraints' ||
    t === 'explain_plan' ||
    t === 'query_select' ||
    t === 'show' ||
    t === 'state_list' ||
    t === 'state_show' ||
    t === 'output' ||
    t === 'workspace_list' ||
    t === 'validate' ||
    t === 'fmt_check' ||
    t === 'plan'
  );
}

const PREVIEW_ROOM_TOOLS: Record<string, Record<string, boolean>> = {
  OWNER: Object.fromEntries(TOOLS.map((t) => [t, true])),
  DEVELOPER: Object.fromEntries(
    TOOLS.map((t) => [t, !DESTRUCTIVE_TOOLS.has(t)]),
  ),
  REVIEWER: Object.fromEntries(
    // Reviewers can read everything + leave comments (the few
    // "comment"-ish writes). No fresh writes or destructive ops.
    TOOLS.map((t) => [
      t,
      isReadOnlyTool(t) ||
        t === 'add_issue_comment' ||
        t === 'add_comment' ||
        t === 'add_reaction',
    ]),
  ),
  VIEWER: Object.fromEntries(TOOLS.map((t) => [t, isReadOnlyTool(t)])),
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
        // Connector journey + CIL anomaly flag travel up from the
        // session aggregate so the Sessions table row already has
        // them without re-deriving from `sessions[]`.
        connectors: s.connectors,
        has_anomaly: s.has_anomaly,
        // Trigger taxonomy — needed for the Sessions tab strip.
        trigger_type: s.trigger_type,
        // Canonical Layer 2 signals at session level.
        semantic_types: s.semantic_types,
        has_rewrite: s.has_rewrite,
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
