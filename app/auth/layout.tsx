'use client';

/**
 * Auth route layout.
 *
 * v3-control-plane override: the entire branch ships as a demo-only
 * preview. Direct visits to /auth (browser bookmarks, cached redirects,
 * back-button history) get bounced to /dashboard?demo=1 so the demo
 * stays auth-free.
 *
 * The real auth flow remains intact on every other branch — the
 * DEMO_ONLY_BRANCH constant is local and explicitly flagged not to
 * cherry-pick onto main / claude/* / redesign/frontend-features-v1.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const DEMO_ONLY_BRANCH = true;

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!DEMO_ONLY_BRANCH || typeof window === 'undefined') return;
    try {
      localStorage.setItem('aegis_demo', 'true');
    } catch {
      /* private-mode browsers — `?demo=1` query param picks up the slack */
    }
    router.replace('/dashboard?demo=1');
  }, [router]);

  if (DEMO_ONLY_BRANCH) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
