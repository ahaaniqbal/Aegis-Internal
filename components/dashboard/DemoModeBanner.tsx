'use client';

/**
 * Demo mode amber banner. Renders at the top of every dashboard page
 * (above the Topbar) when the user is in demo mode AND hasn't dismissed
 * the banner. Dismissal persists in localStorage so the banner doesn't
 * re-appear on every page.
 *
 * Visual: amber-tinted strip with a single line of copy + dismiss X.
 * Sits below the KillSwitchBanner if both are active.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';

const DISMISS_KEY = 'aegis_demo_banner_dismissed';

function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const flag = localStorage.getItem('aegis_demo');
    return flag === 'true';
  } catch {
    return false;
  }
}

function wasDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function DemoModeBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isDemoMode() && !wasDismissed());
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      className="border-b px-4 py-2 sm:px-6 lg:px-8"
      style={{
        backgroundColor: 'rgba(246, 181, 30, 0.10)',
        borderColor: 'rgba(246, 181, 30, 0.40)',
      }}
    >
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-x-3 gap-y-1 2xl:max-w-[1480px]">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: 'var(--warning-dark)' }}
            strokeWidth={2.25}
          />
          <span className="text-[12px] leading-[1.45] text-[var(--neutral-strong-950)]">
            <span
              className="mr-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{ color: 'var(--warning-dark)' }}
            >
              Demo data
            </span>
            You're viewing a workspace with sample agent activity. Connect your GitHub to start governing real agent calls.{' '}
            <Link
              href="/dashboard/settings#github"
              className="font-medium text-[var(--warning-dark)] hover:underline"
            >
              Get started →
            </Link>
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, '1');
            } catch {
              // ignore
            }
            setShow(false);
          }}
          aria-label="Dismiss demo data banner"
          className="shrink-0 rounded-md p-1 text-[var(--warning-dark)] transition-colors hover:bg-white/40"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
