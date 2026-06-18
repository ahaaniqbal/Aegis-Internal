'use client';

/**
 * Client-side wrapper for the onboarding layout. Handles two things:
 *
 *  1. Installs the preview-data mock layer when demo mode is active
 *     (`?demo=1`, `?preview=1`, or `aegis_demo === 'true'` in localStorage).
 *     This lets designers click through the redesigned onboarding flow
 *     end-to-end without going through the real GitHub OAuth + cookie
 *     auth path.
 *
 *  2. Renders a small bottom-center ribbon when demo mode is on so it's
 *     obvious the form submissions are talking to mocks, not the real
 *     backend.
 *
 * Real users (no demo flag, real auth cookies) hit the unpatched API and
 * see the actual onboarding flow.
 */

import { useEffect, useState } from 'react';
import { installPreviewApi } from '@/lib/preview-data';

function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('demo') === '1') {
    localStorage.setItem('aegis_demo', 'true');
    return true;
  }
  if (process.env.NODE_ENV !== 'production' && params.get('preview') === '1') {
    localStorage.setItem('aegis_demo', 'true');
    return true;
  }
  return localStorage.getItem('aegis_demo') === 'true';
}

export default function OnboardingDemoShell({
  children,
}: {
  children: React.ReactNode;
}) {
  // Run synchronously during render so the page's first api call already
  // sees the patched methods. installPreviewApi is idempotent.
  if (typeof window !== 'undefined' && isDemoMode()) {
    installPreviewApi();
  }

  // Mark the document root with demo state — agentation and any other
  // demo-aware widget reads this. Cleanup restores defaults when the
  // user navigates away.
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    const on = isDemoMode();
    setDemo(on);
    if (on) {
      document.documentElement.dataset.demo = 'true';
    }
    return () => {
      delete document.documentElement.dataset.demo;
    };
  }, []);

  return (
    <>
      {demo && (
        <div className="fixed bottom-4 left-1/2 z-[120] -translate-x-1/2 rounded-full border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-3 py-1.5 text-[11px] font-semibold tracking-[-0.005em] text-[var(--neutral-sub-600)] shadow-[0_6px_18px_rgba(23,23,23,0.10)]">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--primary-base)]" />
          Preview mode · onboarding mocked
        </div>
      )}
      {children}
    </>
  );
}
