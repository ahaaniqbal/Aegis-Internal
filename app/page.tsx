'use client';

/**
 * Root entry point — v3-control-plane variant.
 *
 * On the v3-control-plane Vercel preview, the root URL should open
 * the demo workspace directly so investors / engineers landing on
 * the link see the full pitch view without an auth or onboarding
 * detour. We do two things:
 *
 *   1. Seed `localStorage.aegis_demo = 'true'` synchronously so any
 *      subsequent navigation to a deep dashboard route (e.g. someone
 *      pastes /dashboard/insights directly) also renders demo data
 *      instead of bouncing through auth.
 *
 *   2. router.replace into `/dashboard?demo=1` — the `?demo=1` flag
 *      reinforces (1) and satisfies `isDemoMode()` on first paint so
 *      the data context immediately seeds DEMO_USER.
 *
 * This is the ONLY entry-point change for the demo branch; the real
 * auth + onboarding flow stays intact on every other branch.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('aegis_demo', 'true');
    } catch {
      // Private-mode browsers reject localStorage; the ?demo=1 query
      // param in the redirect URL still triggers isDemoMode().
    }
    router.replace('/dashboard?demo=1');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
