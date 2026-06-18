'use client';

import { ExternalLink, GitPullRequest } from 'lucide-react';
import { cn, parsePullRequestUrl } from '@/lib/utils';

interface PullRequestLinkProps {
  /** Full PR URL (any host — github.com or GitHub Enterprise). */
  url: string;
  /**
   * `chip` — small inline pill for dense rows / table cells.
   * `panel` — full-width call-to-action surface for expanded views & approvals.
   */
  variant?: 'chip' | 'panel';
  className?: string;
}

/**
 * Renders a styled link to a GitHub Pull Request. Parses the URL to surface
 * `owner/repo #number`, falls back to showing the raw URL when parsing fails.
 *
 * Stops click propagation so the link works inside expandable table rows
 * without toggling the row.
 */
export function PullRequestLink({
  url,
  variant = 'chip',
  className,
}: PullRequestLinkProps) {
  const parsed = parsePullRequestUrl(url);

  if (variant === 'panel') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'group inline-flex w-full items-center justify-between gap-3 rounded-[10px] border border-[var(--primary-base)]/25 bg-[var(--primary-lighter)]/40 px-3.5 py-2.5 text-[13px] transition-colors hover:border-[var(--primary-base)]/45 hover:bg-[var(--primary-lighter)]/70',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[var(--primary-base)] ring-1 ring-[var(--primary-base)]/20"
          >
            <GitPullRequest className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
              {parsed ? `Pull request #${parsed.number}` : 'View pull request'}
            </span>
            <span className="block truncate text-[11.5px] text-[var(--neutral-sub-600)] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
              {parsed ? `${parsed.owner}/${parsed.repo}` : url}
            </span>
          </span>
        </span>
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-[var(--primary-base)]">
          Open on GitHub
          <ExternalLink
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
            strokeWidth={2}
          />
        </span>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={parsed ? `${parsed.owner}/${parsed.repo}#${parsed.number}` : url}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[6px] border border-[var(--primary-base)]/25 bg-[var(--primary-lighter)]/50 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-[var(--primary-base)] transition-colors hover:border-[var(--primary-base)]/45 hover:bg-[var(--primary-lighter)]',
        className,
      )}
    >
      <GitPullRequest className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
      <span>{parsed ? `PR #${parsed.number}` : 'PR'}</span>
      <ExternalLink className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
    </a>
  );
}
