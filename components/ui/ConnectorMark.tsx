'use client';

/**
 * ConnectorMark — brand-logo container for the Connectors catalog.
 *
 * Each tool gets its official full-color brand logo on a neutral white
 * surface with a subtle border + soft inner highlight, matching the
 * "app store icon" treatment used by Stripe Apps, Linear's app
 * directory, and Vercel Marketplace. Multi-color logos (Slack's four
 * chambers, Jira's stacked diamond, Postgres elephant) are pulled from
 * VectorLogoZone; inherently-monochrome marks (Linear, Terraform,
 * GitHub Actions) are pulled from Simple Icons in their official brand
 * color via cdn.simpleicons.org.
 *
 * SVGs are stored under /public/integrations/{slug}-color.svg so the
 * monochrome originals stay available for any future white-on-color
 * treatment without needing to re-download.
 *
 * The single-source-of-truth `CONNECTORS` map here is also imported by
 * the Connectors page itself so we don't have two places to update when
 * a connector's brand color or copy changes.
 */

import { cn } from '@/lib/utils';

export type ConnectorId =
  | 'github'
  | 'slack'
  | 'linear'
  | 'jira'
  | 'github-actions'
  | 'terraform'
  | 'postgres'
  // Observability + ops surfaces. Datadog/Sentry round out the
  // "incident loop" demo (PagerDuty → Sentry → GitHub); Kubernetes
  // covers the cluster-control story; Cloudflare carries the edge /
  // DNS narrative; Notion governs the docs-as-attack-surface case.
  // Stage 2 connectors per the roadmap.
  | 'datadog'
  | 'sentry'
  | 'kubernetes'
  | 'cloudflare'
  | 'notion';

interface ConnectorDef {
  id: ConnectorId;
  /** Display name shown beside the mark. */
  name: string;
  /** Single-word category — appears as a small uppercase tag on the card. */
  category: string;
  /** One-sentence value prop. Used in card body and tooltip. */
  description: string;
  /** Default policy stance per action type — drives the small chip strip
   *  on each card so prospects can see what governance looks like out
   *  of the box. */
  policy: {
    read: PolicyStance;
    write: PolicyStance;
    destructive: PolicyStance;
  };
  /** Optional codified policy primitive (P12, T1, P17 etc.) — when set,
   *  surfaces as a small pill on the card. Pulled from PRODUCT.md +
   *  Notion task notes. */
  primitive?: string;
  /** Brand color for the mark bg. Picked from each tool's official
   *  brand guidelines where possible; tuned slightly for contrast. */
  bg: string;
  /** Filename slug under /public/integrations/. Simple Icons uses some
   *  conventions that don't match our ConnectorId — e.g. `githubactions`
   *  vs our `github-actions`, `postgresql` vs our `postgres`. */
  logoSlug: string;
}

type PolicyStance = 'allow' | 'approval' | 'deny';

export const CONNECTORS: Record<ConnectorId, ConnectorDef> = {
  github: {
    id: 'github',
    name: 'GitHub',
    category: 'Source control',
    description:
      'Pull-request gating, branch protection awareness, and repo-scoped tool allowlists. The original integration, fully live.',
    policy: { read: 'allow', write: 'approval', destructive: 'deny' },
    bg: '#181717',
    logoSlug: 'github',
  },
  slack: {
    id: 'slack',
    name: 'Slack',
    category: 'Messaging',
    description:
      'Both the trigger surface and the approval surface. Engineers start agents from a channel; humans approve risky actions inline.',
    policy: { read: 'allow', write: 'approval', destructive: 'deny' },
    bg: '#4A154B',
    logoSlug: 'slack',
  },
  linear: {
    id: 'linear',
    name: 'Linear',
    category: 'Project tracking',
    description:
      'Planning context for the agent. Read the ticket before writing code; status changes and reassignments route through human approval.',
    policy: { read: 'allow', write: 'approval', destructive: 'deny' },
    bg: '#5E6AD2',
    logoSlug: 'linear',
  },
  jira: {
    id: 'jira',
    name: 'Jira',
    category: 'Project tracking',
    description:
      'Enterprise sibling of the Linear connector. Same governance pack, same proxy pattern. Read is open; write needs approval.',
    policy: { read: 'allow', write: 'approval', destructive: 'deny' },
    bg: '#2684FF',
    logoSlug: 'jira',
  },
  'github-actions': {
    id: 'github-actions',
    name: 'GitHub Actions',
    category: 'CI / CD',
    description:
      'Extends GitHub governance into CI/CD. Workflow dispatch, re-run, and cancel require approval. Production deployment stays human-only.',
    policy: { read: 'allow', write: 'approval', destructive: 'deny' },
    bg: '#2088FF',
    logoSlug: 'githubactions',
  },
  terraform: {
    id: 'terraform',
    name: 'Terraform',
    category: 'Infrastructure',
    description:
      'Agents read and plan freely. Apply and destroy are hard-locked under the T1 IaC policy, so no agent ever runs a destructive change against your infrastructure.',
    primitive: 'T1 IaC Hard Lock',
    policy: { read: 'allow', write: 'deny', destructive: 'deny' },
    bg: '#7B42BC',
    logoSlug: 'terraform',
  },
  postgres: {
    id: 'postgres',
    name: 'PostgreSQL',
    category: 'Database',
    description:
      'Query freely, write under approval, destructive ops (DROP, TRUNCATE, DELETE without WHERE) hard-denied. P12 Migration Gate catches migrations without rollback.',
    primitive: 'P12 Migration Gate',
    policy: { read: 'allow', write: 'approval', destructive: 'deny' },
    bg: '#336791',
    logoSlug: 'postgresql',
  },
  datadog: {
    id: 'datadog',
    name: 'Datadog',
    category: 'Observability',
    description:
      'Read alerts, dashboards, and metrics freely. Silencing monitors and incident overrides route to approval. Bulk monitor deletion and synthetic-check tampering are hard-denied.',
    policy: { read: 'allow', write: 'approval', destructive: 'deny' },
    bg: '#632CA6',
    logoSlug: 'datadog',
  },
  sentry: {
    id: 'sentry',
    name: 'Sentry',
    category: 'Error tracking',
    description:
      'Read errors, projects, and releases. Resolve / ignore route to approval. Bulk issue mutations and project deletion hard-denied.',
    policy: { read: 'allow', write: 'approval', destructive: 'deny' },
    bg: '#362D59',
    logoSlug: 'sentry',
  },
  kubernetes: {
    id: 'kubernetes',
    name: 'Kubernetes',
    category: 'Infrastructure',
    description:
      'Read cluster state freely. Apply manifests under approval. Exec into pods, drain nodes, and delete in production are hard-denied under the T2 Cluster Hard Lock.',
    primitive: 'T2 Cluster Hard Lock',
    policy: { read: 'allow', write: 'approval', destructive: 'deny' },
    bg: '#326CE5',
    logoSlug: 'kubernetes',
  },
  cloudflare: {
    id: 'cloudflare',
    name: 'Cloudflare',
    category: 'Cloud / Edge',
    description:
      'Read zones, workers, and DNS freely. Worker deploys and DNS mutations require approval. Public exposure of internal hostnames is hard-denied.',
    policy: { read: 'allow', write: 'approval', destructive: 'deny' },
    bg: '#F38020',
    logoSlug: 'cloudflare',
  },
  notion: {
    id: 'notion',
    name: 'Notion',
    category: 'Docs',
    description:
      'Read pages, databases, and comments freely. Writes go through approval. Public sharing of internal pages and database schema deletion are hard-denied.',
    policy: { read: 'allow', write: 'approval', destructive: 'deny' },
    bg: '#000000',
    logoSlug: 'notion',
  },
};

/**
 * Per-connector tool catalogs. The canonical action names each connector's
 * MCP server exposes. Used by:
 *   • lib/preview-data.ts to generate realistic demo actions per tool
 *   • getConnectorForTool() below to infer which logo to render next to
 *     a tool name in the Runs / Audit / Sessions tables
 *
 * Keep these aligned with the real MCP server tool definitions when those
 * land. The GitHub list mirrors the GitHub MCP server's public surface;
 * Slack mirrors the official Slack MCP server tool names.
 */
export const TOOLS_BY_CONNECTOR: Record<ConnectorId, readonly string[]> = {
  github: [
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
  ],
  slack: [
    // Read surface — open by default in most policies.
    'list_channels',
    'list_users',
    'get_channel_history',
    'get_thread_replies',
    'search_messages',
    // Write surface — approval gate in default Slack policy pack.
    'post_message',
    'post_thread_reply',
    'add_reaction',
    'upload_file',
    'invite_user_to_channel',
    // Destructive surface — hard-deny in default pack.
    'delete_message',
    'archive_channel',
    'kick_user',
  ],
  linear: [
    // Planning context — agent reads ticket before writing code.
    'list_issues',
    'get_issue',
    'list_projects',
    'get_project',
    'search_issues',
    'list_teams',
    'list_users',
    // Write surface — approval gate.
    'create_issue',
    'update_issue',
    'add_issue_comment',
    'create_subtask',
    'move_issue',
    'assign_issue',
    // Workflow surface — hard-deny for state changes on P0/P1.
    'close_issue',
    'set_priority',
    'archive_issue',
  ],
  jira: [
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
  ],
  'github-actions': [
    // Read surface.
    'list_workflows',
    'get_workflow',
    'list_workflow_runs',
    'get_workflow_run',
    'list_workflow_jobs',
    'get_run_logs',
    'list_secrets',
    // Write surface — approval gate.
    'dispatch_workflow',
    'rerun_workflow',
    'cancel_workflow',
    'update_secret',
    // Destructive surface.
    'delete_secret',
    'delete_workflow_run',
  ],
  terraform: [
    // Read-only — allowed by default.
    'plan',
    'show',
    'state_list',
    'state_show',
    'output',
    'workspace_list',
    'workspace_select',
    'validate',
    'fmt_check',
    // T1 IaC Hard Lock — apply / destroy / state-mutating ops are
    // policy-denied across the board in default Aegis config.
    'apply',
    'destroy',
    'state_rm',
    'state_mv',
    'import',
    'taint',
    'workspace_new',
    'workspace_delete',
  ],
  postgres: [
    // Read — allowed; can be downgraded to "read-only on prod" by policy.
    'query_select',
    'describe_table',
    'list_tables',
    'list_databases',
    'show_indexes',
    'show_constraints',
    'explain_plan',
    // Write — approval gate.
    'query_insert',
    'query_update',
    'create_table',
    'alter_table',
    'create_index',
    // Destructive — P12 Migration Gate + hard-deny on prod for DROP / TRUNCATE.
    'query_delete',
    'drop_table',
    'truncate_table',
    'drop_index',
    'run_migration',
  ],
  datadog: [
    // Read — open by default; safe inspection of alerts + telemetry.
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
    // Write — approval gate. Silencing monitors during an incident is
    // legitimate but needs human sign-off.
    'silence_monitor',
    'update_monitor',
    'create_dashboard',
    'update_dashboard',
    'post_event',
    'add_synthetic_check',
    'acknowledge_incident',
    // Destructive — hard-deny by default.
    'delete_dashboard',
    'delete_monitor',
    'delete_synthetic_check',
    'resolve_incident_force',
  ],
  sentry: [
    // Read — open. Reading errors is the standard agent loop.
    'list_projects',
    'list_issues',
    'get_issue',
    'list_releases',
    'get_release',
    'get_event',
    'list_alerts',
    // Write — approval gate. Resolving issues without a fix PR is the
    // classic "agent gamed the SLO" attack.
    'assign_issue',
    'resolve_issue',
    'mark_ignored',
    'add_issue_comment',
    'set_status',
    'create_release',
    // Destructive — hard-deny.
    'delete_issue',
    'bulk_resolve',
    'delete_project',
  ],
  kubernetes: [
    // Read — `kubectl get`, `describe`, `logs`, `top` are observation
    // verbs. Safe by default in non-prod namespaces.
    'kubectl_get',
    'kubectl_describe',
    'kubectl_logs',
    'kubectl_top',
    'kubectl_explain',
    'kubectl_diff',
    // Write — apply / scale / rollout are intent-changing. Approval
    // gate in default policy.
    'kubectl_apply',
    'kubectl_patch',
    'kubectl_scale',
    'kubectl_rollout',
    'kubectl_label',
    'kubectl_annotate',
    'kubectl_set_image',
    // Destructive — T2 Cluster Hard Lock. `delete` / `exec` /
    // `drain` are the actions that take prod down.
    'kubectl_delete',
    'kubectl_exec',
    'kubectl_drain',
    'kubectl_cordon',
    'kubectl_taint',
  ],
  cloudflare: [
    // Read — open. Inspecting DNS, zones, workers is reconnaissance,
    // not action.
    'list_zones',
    'get_zone',
    'list_dns_records',
    'get_dns_record',
    'list_workers',
    'get_worker',
    'list_kv_namespaces',
    'list_r2_buckets',
    'get_pages_project',
    // Write — approval gate. DNS mutations and worker deploys are
    // production-impact changes.
    'create_dns_record',
    'update_dns_record',
    'deploy_worker',
    'update_worker',
    'update_kv_pair',
    'create_kv_namespace',
    'create_r2_bucket',
    // Destructive — hard-deny. Deleting zones, workers, or purging
    // cache during an incident is loud and irreversible.
    'delete_dns_record',
    'delete_worker',
    'delete_zone',
    'purge_cache',
    'delete_pages_project',
  ],
  notion: [
    // Read — open. Agents need page context to act on tickets / RFCs.
    'get_page',
    'search_pages',
    'query_database',
    'get_database',
    'list_users',
    'get_comments',
    // Write — approval gate. Editing canonical docs needs a human
    // signing off.
    'create_page',
    'update_page',
    'append_block',
    'create_database',
    'update_database',
    'add_comment',
    // Destructive — hard-deny. Sharing internal pages publicly or
    // deleting schemas is the doc-exfiltration vector.
    'delete_page',
    'archive_page',
    'share_page_publicly',
    'delete_database',
  ],
};

/**
 * Reverse index: tool name → ConnectorId. Built once at module load so the
 * Runs / Audit / Sessions table renderers can resolve a connector mark
 * for any tool_name in O(1) without each row doing its own scan.
 *
 * Tools not in the catalog (legacy, custom, unknown) resolve to `null` —
 * callers fall back to "no connector mark, just the tool name".
 */
const TOOL_TO_CONNECTOR: Record<string, ConnectorId> = (() => {
  const map: Record<string, ConnectorId> = {};
  for (const [connector, tools] of Object.entries(TOOLS_BY_CONNECTOR)) {
    for (const t of tools) map[t] = connector as ConnectorId;
  }
  return map;
})();

export function getConnectorForTool(toolName: string | undefined | null): ConnectorId | null {
  if (!toolName) return null;
  return TOOL_TO_CONNECTOR[toolName] ?? null;
}

interface ConnectorMarkProps {
  id: ConnectorId;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: { box: 28, icon: 18, radius: 8 },
  md: { box: 40, icon: 24, radius: 10 },
  lg: { box: 56, icon: 32, radius: 14 },
} as const;

/**
 * ConnectorIcon — small inline brand logo (no sticker container).
 *
 * Use this alongside a tool name in dense table rows where the full
 * ConnectorMark sticker would be visually too heavy. Renders just the
 * brand SVG at the given pixel size. Matches the height of adjacent text.
 *
 * For the table use-case the canonical caller is:
 *
 *   const connector = getConnectorForTool(run.tool_name);
 *   <div className="inline-flex items-center gap-1.5">
 *     {connector && <ConnectorIcon id={connector} size={14} />}
 *     <CodeChip>{run.tool_name}</CodeChip>
 *   </div>
 */
export function ConnectorIcon({
  id,
  size = 14,
  className,
  title,
}: {
  id: ConnectorId;
  /** Pixel size of the icon. Default 14, matching ~14px row line height. */
  size?: number;
  className?: string;
  title?: string;
}) {
  const def = CONNECTORS[id];
  return (
    <img
      // data-connector-id powers dark-mode logo inversion in
      // globals.css. Monochrome-dark brand logos (e.g. GitHub silhouette
      // at #181717) are invisible against the dark page bg; the CSS
      // rule inverts them when this component renders bare. Inside a
      // ConnectorMark (which carries data-connector-tile so its inline
      // #ffffff bg stays light even in dark mode), the override
      // suppresses the inversion so logos read on the light tile.
      data-connector-id={id}
      src={`/integrations/${def.logoSlug}-color.svg`}
      alt=""
      width={size}
      height={size}
      title={title ?? def.name}
      className={cn('inline-block shrink-0 select-none', className)}
      style={{ width: size, height: size }}
    />
  );
}

export function ConnectorMark({ id, size = 'md', className }: ConnectorMarkProps) {
  const def = CONNECTORS[id];
  const d = SIZE_MAP[size];
  return (
    <span
      aria-hidden
      // data-connector-tile signals "this brand logo sits on a hardcoded
      // light tile" so the dark-mode logo inversion is suppressed for
      // any ConnectorIcon nested inside (otherwise GitHub would invert
      // to white-on-white when it's already on the always-light sticker).
      data-connector-tile
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        // "Sticker on card" treatment — pattern referenced from Stripe
        // Apps, Cofounder integration tiles, and the DoorDash merchant
        // integrations page (Refero). Pure white container, no border
        // and no gradient, with a layered drop-shadow stack that makes
        // the mark visibly float above the warm-tinted card surface.
        //
        // Why this works where earlier iterations didn't:
        //   • Gradient grays (#f7f7f7 → #e6e6e6) read as "dirty" next
        //     to the card's warm orange inset gradient (cool-vs-warm
        //     color clash).
        //   • White-to-light-white gradient (#ffffff → #f5f5f5) had no
        //     contrast against the card's near-white base.
        //   • Pure white + strong drop shadow lets the warm card color
        //     show through the shadow's natural fall-off, so the
        //     container reads as a physical tile resting on the card.
        //
        // Locked to hardcoded values so dark mode keeps a light tile
        // (essential for the GitHub silhouette's #181717 fill).
        className,
      )}
      style={{
        width: d.box,
        height: d.box,
        borderRadius: d.radius,
        background: '#ffffff',
        boxShadow:
          'inset 0 1px 0 0 rgba(255,255,255,0.8),' +
          '0 1px 1px rgba(23,23,23,0.04),' +
          '0 4px 12px rgba(23,23,23,0.10)',
      }}
    >
      {/* Full-color brand logo. VectorLogoZone supplies multi-color
          marks (Slack chambers, Jira diamond, Postgres elephant); Simple
          Icons CDN supplies brand-color monochrome marks for tools
          whose official logo is single-color (Linear, Terraform, GitHub
          Actions). No filter — the logo renders in its native palette. */}
      <img
        src={`/integrations/${def.logoSlug}-color.svg`}
        alt=""
        width={d.icon}
        height={d.icon}
        style={{
          width: d.icon,
          height: d.icon,
        }}
      />
    </span>
  );
}
