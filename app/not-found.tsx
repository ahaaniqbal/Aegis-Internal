'use client';

/**
 * 404 page — Aegis-coded variant.
 *
 * Replaces the prior generic 404 with a dev-tool-coded page that
 * reads as a competent governance product. Three signals do the
 * work:
 *
 *   1. An `IconMark` concentric ring + GitBranch icon anchors the
 *      page in the Aegis chrome family — same sticker every other
 *      identity-bearing surface uses.
 *   2. A monospace request-trace strip echoes the URL the user
 *      actually tried, in the style of a real request log
 *      (`GET /unknown → 404 Not Found`). This is the move investors
 *      and engineers recognise: the product surfaces "what just
 *      happened" instead of waving the hand.
 *   3. Governance-coded copy: "no matching route in your governed
 *      surfaces" lands the metaphor without overstating it.
 *
 * Client component so we can read `usePathname()` and show the
 * actual attempted URL inside the trace strip. On the server, we
 * render the same chrome with an empty path placeholder; the path
 * fills in on the client after hydration. No layout shift because
 * the trace strip has a fixed min-height.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Boxes, GitBranch } from 'lucide-react';
import { AegisLogo } from '@/components/ui/AegisLogo';
import { IconMark } from '@/components/ui/IconMark';

export default function NotFound() {
  const [path, setPath] = useState<string>('');

  // Pull the attempted path from window.location.pathname on mount.
  // `usePathname()` from next/navigation returns the matched route,
  // which for a 404 is itself ambiguous; the literal window value
  // is what users actually typed / pasted, which is what we want.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPath(window.location.pathname + window.location.search);
  }, []);

  return (
    <main className="flex min-h-dvh items-start justify-center bg-[var(--bg-app)] px-6 pt-[18vh]">
      <div className="w-full max-w-[520px]">
        {/* Brand row — small AegisLogo so the page still feels
            inside the product, not outside it. */}
        <Link
          href="/dashboard"
          aria-label="Aegis"
          className="inline-flex text-[var(--neutral-strong-950)] transition-opacity hover:opacity-80"
        >
          <AegisLogo style={{ height: 22, width: 'auto' }} />
        </Link>

        {/* Mark + eyebrow row. The IconMark mirrors the Policies /
            CIL row treatment everywhere else in the product — same
            44/32 concentric sticker, brand-orange GitBranch icon.
            "404 · no route matches" sits beside it in the same
            eyebrow type used on every page header. */}
        <div className="mt-10 flex items-center gap-3">
          <IconMark icon={GitBranch} strokeWidth={2.25} />
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]">
            404 · No route matches
          </p>
        </div>

        <h1 className="mt-4 text-[28px] font-semibold leading-[1.12] tracking-[-0.03em] text-[var(--neutral-strong-950)]">
          This page isn&apos;t in any of your governed surfaces.
        </h1>

        <p className="mt-3 text-[14px] leading-[1.55] text-[var(--neutral-sub-600)]">
          The URL may have been mistyped, the page may have moved, or it
          may belong to a workspace you don&apos;t have access to.
        </p>

        {/* Request trace strip — dev-tool-coded echo of what the
            user just tried. Single monospace line with the verb,
            the path, an arrow, and the status. Mirrors the visual
            grammar of a Vercel deployment-not-found page or a
            terminal log line. */}
        <div className="mt-6 overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
          <div className="flex items-center gap-2 border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--error)]"
            />
            Request trace
          </div>
          <div className="px-3 py-2.5 font-mono text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">
            <span className="font-semibold text-[var(--neutral-strong-950)]">
              GET
            </span>{' '}
            <span className="break-all text-[var(--neutral-strong-950)]">
              {path || '/'}
            </span>
            <br />
            <span className="text-[var(--neutral-soft-400)]">↳</span>{' '}
            <span className="font-semibold text-[var(--error)]">
              404 Not Found
            </span>{' '}
            <span className="text-[var(--neutral-soft-400)]">
              · no route registered in this workspace
            </span>
          </div>
        </div>

        {/* CTA stack — primary anchors them back inside the
            product, secondary nudges them at the connectors catalog
            (the most common "I came here from outside" path). */}
        <div className="mt-7 flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center rounded-[8px] border border-[var(--btn-primary-border)] px-4 text-[13px] font-semibold text-white shadow-[var(--btn-primary-shadow)] transition-all"
            style={{ background: 'var(--btn-primary-bg)' }}
          >
            Back to dashboard
          </Link>
          <Link
            href="/dashboard/connectors"
            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[var(--stroke-sub-300)] bg-[var(--white-0)] px-4 text-[13px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
          >
            <Boxes className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Browse connectors
          </Link>
        </div>

        {/* Footer hint — quiet docs / support nudge, same family as
            the Connectors page footer line. */}
        <p className="mt-10 text-[11.5px] text-[var(--neutral-soft-400)]">
          Think this should exist?{' '}
          <a
            href="mailto:hello@runaegis.co?subject=Aegis%20-%20broken%20link"
            className="text-[var(--neutral-sub-600)] underline-offset-4 hover:text-[var(--neutral-strong-950)] hover:underline"
          >
            Let us know
          </a>
          .
        </p>
      </div>
    </main>
  );
}
