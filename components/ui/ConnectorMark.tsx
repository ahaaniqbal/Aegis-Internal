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
  | 'postgres';

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
};

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

export function ConnectorMark({ id, size = 'md', className }: ConnectorMarkProps) {
  const def = CONNECTORS[id];
  const d = SIZE_MAP[size];
  return (
    <span
      aria-hidden
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
