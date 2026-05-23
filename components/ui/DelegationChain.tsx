'use client';

/**
 * DelegationChain — renders the "Acting as X · ROLE in <scope> · expires in Yh"
 * line. The identity story for Aegis: every agent action is on behalf
 * of a specific human, in a specific role, scoped to a specific repo
 * or room, with a hard expiry.
 *
 * Visually:
 *   <user-avatar> Acting as <bold name> · <role-pill> in <scope> · expires <when>
 *
 * Use cases:
 *   • Runs expanded row: full chain rendered inline so the reviewer
 *     sees exactly who authorised this action.
 *   • Approvals row: shows reviewer whose access the agent is using.
 *   • Audit detail drawer: forensic-grade evidence chain for SOC 2.
 *
 * Compact mode renders just "<name> · <role>" for dense rows.
 */

import { Shield } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { CodeChip } from '@/components/ui/CodeChip';
import { IconMark } from '@/components/ui/IconMark';

interface DelegationChainProps {
  delegation?: {
    user: string;
    role: string;
    scope: string;
    expires_in?: string;
  } | null;
  /** `full` (default) renders the inline-card variant for expanded
   *  detail drawers. `compact` renders a 1-line variant. */
  variant?: 'full' | 'compact';
  className?: string;
}

const ROLE_TONE: Record<string, { bg: string; text: string }> = {
  OWNER:     { bg: 'rgba(250, 115, 25, 0.14)', text: 'var(--primary-dark)' },
  ADMIN:     { bg: 'rgba(125, 82, 244, 0.14)', text: 'var(--feature-dark)' },
  DEVELOPER: { bg: 'rgba(31, 193, 107, 0.14)', text: 'var(--success-dark)' },
  REVIEWER:  { bg: 'rgba(246, 181, 30, 0.14)', text: 'var(--warning-dark)' },
  VIEWER:    { bg: 'var(--neutral-weak-50)',   text: 'var(--neutral-sub-600)' },
};

export function DelegationChain({
  delegation,
  variant = 'full',
  className,
}: DelegationChainProps) {
  if (!delegation) return null;
  const role = (delegation.role || '').toUpperCase();
  const tone = ROLE_TONE[role] ?? ROLE_TONE.VIEWER;
  // Expires-soon detection — when the human's delegation is about to
  // lapse, the time chip shifts to warning tone so a reviewer scanning
  // the audit drawer immediately spots "this evidence chain is about
  // to need re-attestation." We match "in Xm" with no preceding hours
  // (urgent: less than an hour). "in 2h 14m" or "in 4h" stay neutral.
  const expiresSoon = /^in \d+m\b/.test(delegation.expires_in ?? '');

  if (variant === 'compact') {
    return (
      <span className={['inline-flex items-center gap-1.5 text-[11px]', className ?? ''].join(' ')}>
        <UserAvatar seed={delegation.user} size={14} radius={4} />
        <span className="font-medium text-[var(--neutral-sub-600)]">
          {delegation.user}
        </span>
        <span
          className="rounded-[4px] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em]"
          style={{ backgroundColor: tone.bg, color: tone.text }}
        >
          {role}
        </span>
      </span>
    );
  }

  return (
    <div
      className={[
        'flex items-center gap-3 rounded-[10px] border bg-[var(--neutral-weak-50)] px-3.5 py-3',
        className ?? '',
      ].join(' ')}
      style={{ borderColor: 'var(--stroke-soft-200)' }}
    >
      {/* Canonical IconMark — concentric ring sticker carrying the
          Shield icon. Matches the dashboard icon family so every
          "evidence/signal" mark in the product reads consistently. */}
      <IconMark icon={Shield} />
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
          Agent delegation · SOC 2 evidence
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] leading-[1.4] text-[var(--neutral-strong-950)]">
          <UserAvatar seed={delegation.user} size={16} radius={4} />
          <span>
            Acting as{' '}
            <span className="font-semibold tracking-[-0.005em]">
              {delegation.user}
            </span>
          </span>
          <span
            className="inline-flex items-center rounded-[5px] px-1.5 py-[2px] text-[9.5px] font-bold uppercase tracking-[0.06em]"
            style={{ backgroundColor: tone.bg, color: tone.text }}
          >
            {role}
          </span>
          <span className="text-[var(--neutral-soft-400)]">in</span>
          <CodeChip>{delegation.scope}</CodeChip>
          {delegation.expires_in && (
            <>
              <span className="text-[var(--neutral-soft-400)]">·</span>
              <span className="inline-flex items-center gap-1 text-[var(--neutral-sub-600)]">
                expires{' '}
                <span
                  className="font-medium tabular-nums"
                  style={{
                    color: expiresSoon
                      ? 'var(--warning-dark)'
                      : 'var(--neutral-strong-950)',
                  }}
                >
                  {delegation.expires_in}
                </span>
                {expiresSoon && (
                  <span
                    aria-label="Delegation expires soon"
                    className="ml-0.5 rounded-[4px] px-1 py-[1px] text-[9px] font-bold uppercase tracking-[0.06em]"
                    style={{
                      backgroundColor: 'rgba(246, 181, 30, 0.18)',
                      color: 'var(--warning-dark)',
                    }}
                  >
                    Soon
                  </span>
                )}
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
