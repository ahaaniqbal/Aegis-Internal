'use client';

/**
 * DiagnosticErrorState — full-panel error surface for data-fetch failures.
 *
 * Pattern: title + short description + a mono diagnostic strip carrying
 * the audit-grade evidence (request_id, endpoint, status code) + a retry
 * CTA. Optional secondary action (e.g. "Back to dashboard").
 *
 * Why this exists: the existing `<ErrorBanner>` is good for inline
 * notification-style errors at the top of a content area, but full-panel
 * data-fetch failures need to feel honest and instrument-coded the same
 * way the rest of the audit-grade surfaces do. The mono diagnostic strip
 * is the same typographic family as our request-trace strip on the 404
 * page and the four-context evidence panel on Approval detail; surfacing
 * the request_id + endpoint + status here keeps the visual language
 * consistent and gives the engineer something to grep server logs by.
 *
 * Per the Refero design pass on dev-tool error states (Wynde "Failed to
 * load data / Try again" + the Aegis 404 trace strip): minimal centered
 * layout, no illustration, single primary action, structured diagnostic
 * evidence below the message.
 *
 * Example:
 *   <DiagnosticErrorState
 *     title="Failed to load runs"
 *     description="The runs feed didn't respond in time. Check your network and retry."
 *     diagnostic={{ request_id: 'req_a8f3c2e1', endpoint: '/api/sessions', status: 503 }}
 *     onRetry={() => mutate()}
 *     secondary={{ label: 'Back to dashboard', href: '/dashboard' }}
 *   />
 */

import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface DiagnosticErrorStateProps {
  /** Short, surface-specific title. Examples: "Failed to load runs",
   *  "Couldn't reach the policy engine", "Approval queue is unavailable". */
  title: string;
  /** One- or two-sentence explanation. Direct, not apologetic. Tell the
   *  user what failed and what to try, not how the system feels. */
  description: string;
  /** Audit-grade evidence. Surfaced as a mono key=value strip below the
   *  message so engineers can grep logs and customers can copy/paste
   *  request_id into a support ticket. All fields optional. */
  diagnostic?: {
    request_id?: string;
    endpoint?: string;
    status?: number | string;
  };
  /** Primary action: retry the failed fetch. Renders the brand-orange
   *  primary button when present. */
  onRetry?: () => void;
  /** Optional secondary navigation. Renders as a ghost link to the right
   *  of (or below) the Retry button. */
  secondary?: {
    label: string;
    href: string;
  };
  /** Reduces vertical padding for use inside smaller panels. */
  compact?: boolean;
  className?: string;
}

export default function DiagnosticErrorState({
  title,
  description,
  diagnostic,
  onRetry,
  secondary,
  compact = false,
  className,
}: DiagnosticErrorStateProps) {
  const hasDiagnostic =
    diagnostic && (diagnostic.request_id || diagnostic.endpoint || diagnostic.status);

  return (
    <div
      role="alert"
      className={[
        'flex flex-col items-center justify-center px-6 text-center',
        compact ? 'py-10' : 'py-16',
        className ?? '',
      ].join(' ')}
    >
      {/* IconMark-family sticker. Same concentric pattern as the row-level
          IconMark, scaled to 56x56 for state weight. Error-tinted icon
          carries the tone without flooding the surface in red. */}
      <div
        aria-hidden
        className="relative mb-5 flex h-14 w-14 items-center justify-center"
      >
        <div className="absolute h-14 w-14 rounded-full border border-[var(--stroke-soft-200)]" />
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--white-0)] shadow-[0_1px_2px_rgba(23,23,23,0.05)] ring-1 ring-[var(--stroke-soft-200)]">
          <AlertTriangle
            className="h-5 w-5"
            style={{ color: 'var(--error)' }}
            strokeWidth={2.25}
          />
        </div>
      </div>

      <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
        {title}
      </h3>
      <p className="mt-1.5 max-w-[420px] text-[12.5px] leading-[1.55] text-[var(--neutral-sub-600)]">
        {description}
      </p>

      {/* Mono diagnostic strip — audit-grade evidence the engineer can use
          to grep server logs and that customers can paste into a support
          ticket. Visual cousin of the request-trace strip on the 404 page
          and the key=value rows on the four-context evidence panel. */}
      {hasDiagnostic && (
        <div
          className="mt-5 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2 font-mono text-[10.5px] leading-[1.5] text-[var(--neutral-sub-600)]"
        >
          {diagnostic?.status !== undefined && (
            <span>
              <span className="text-[var(--neutral-soft-400)]">status</span>{' '}
              <span className="text-[var(--neutral-strong-950)]">{diagnostic.status}</span>
            </span>
          )}
          {diagnostic?.endpoint && (
            <span>
              <span className="text-[var(--neutral-soft-400)]">endpoint</span>{' '}
              <span className="text-[var(--neutral-strong-950)]">{diagnostic.endpoint}</span>
            </span>
          )}
          {diagnostic?.request_id && (
            <span>
              <span className="text-[var(--neutral-soft-400)]">request_id</span>{' '}
              <span className="text-[var(--neutral-strong-950)]">{diagnostic.request_id}</span>
            </span>
          )}
        </div>
      )}

      {(onRetry || secondary) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[var(--primary-base)] px-3.5 text-[12.5px] font-semibold text-white shadow-[0_1px_0_rgba(23,23,23,0.04)] transition-colors hover:bg-[var(--primary-dark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-24)]"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.25} />
              Retry
            </button>
          )}
          {secondary && (
            <Link
              href={secondary.href}
              className="inline-flex h-9 items-center rounded-[8px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-3.5 text-[12.5px] font-semibold text-[var(--neutral-strong-950)] transition-colors hover:bg-[var(--neutral-weak-50)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-24)]"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
