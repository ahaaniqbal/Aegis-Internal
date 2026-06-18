'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AegisLogo } from '@/components/ui/AegisLogo';

/**
 * Global error boundary — rendered when an uncaught error bubbles up
 * past every nested error.tsx. Must be a Client Component (per
 * Next.js App Router). Includes a `reset()` recovery button so users
 * can retry without a full reload.
 *
 * Visually mirrors the 404 page for brand consistency. Dark-mode
 * aware via the token system; the page hits before any dashboard
 * theme attribute is set, so it renders in light mode by default
 * unless the user's data-theme is already on the document.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface unexpected errors to the console for debugging.
    // Replace with telemetry/Sentry once we wire that up.
    console.error('[Aegis] unhandled error:', error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--bg-app)] px-6">
      <div className="w-full max-w-[440px]">
        <Link
          href="/dashboard"
          aria-label="Aegis"
          className="inline-flex text-[var(--neutral-strong-950)] transition-opacity hover:opacity-80"
        >
          <AegisLogo style={{ height: 24, width: 'auto' }} />
        </Link>

        <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--error)]">
          Something went wrong
        </p>

        <h1 className="mt-2 text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]">
          We hit an unexpected error.
        </h1>

        <p className="mt-3 text-[14px] leading-[1.55] text-[var(--neutral-sub-600)]">
          Your data is safe. Try again, or head back to your dashboard. If this
          keeps happening, contact support and share the error code below.
        </p>

        {error.digest && (
          <div className="mt-5 inline-block rounded-[6px] bg-[var(--neutral-weak-50)] px-2.5 py-1 font-mono text-[11.5px] text-[var(--neutral-sub-600)]">
            Error ID: {error.digest}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center rounded-[8px] border border-[var(--btn-primary-border)] px-4 text-[13px] font-semibold text-white shadow-[var(--btn-primary-shadow)] transition-all"
            style={{ background: 'var(--btn-primary-bg)' }}
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center rounded-[8px] border border-[var(--stroke-sub-300)] bg-[var(--white-0)] px-4 text-[13px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
