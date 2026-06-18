import type { Metadata } from 'next';
import Link from 'next/link';
import { AegisLogo } from '@/components/ui/AegisLogo';

export const metadata: Metadata = {
  title: 'Page not found',
  description: "We couldn't find what you were looking for.",
  robots: { index: false, follow: false },
};

/**
 * 404 page — rendered for any URL Next.js can't match to a route.
 * Server component, dark-mode aware via the global token system.
 * Minimal: brand mark, a clear status code, one sentence of copy,
 * and a single CTA back to the dashboard.
 */
export default function NotFound() {
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

        <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]">
          404 · Page not found
        </p>

        <h1 className="mt-2 text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]">
          We couldn&apos;t find that page.
        </h1>

        <p className="mt-3 text-[14px] leading-[1.55] text-[var(--neutral-sub-600)]">
          The URL might be mistyped, or the page may have moved. Head back to
          your dashboard to keep going.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center rounded-[8px] border border-[var(--btn-primary-border)] px-4 text-[13px] font-semibold text-white shadow-[var(--btn-primary-shadow)] transition-all"
            style={{ background: 'var(--btn-primary-bg)' }}
          >
            Back to dashboard
          </Link>
          <a
            href="https://docs.runaegis.co"
            className="inline-flex h-9 items-center rounded-[8px] border border-[var(--stroke-sub-300)] bg-[var(--white-0)] px-4 text-[13px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
          >
            Documentation
          </a>
        </div>
      </div>
    </main>
  );
}
