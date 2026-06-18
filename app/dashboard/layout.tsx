'use client';

import { useEffect, useState } from 'react';
import { api, AuthError } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks';
import Layout from '@/components/layout/Layout';
import { AppShellSkeleton } from '@/components/ui/PageSkeletons';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { DemoWelcomeModal } from '@/components/ui/DemoWelcomeModal';
import { installPreviewApi } from '@/lib/preview-data';
import { DashboardDataProvider } from '@/lib/dashboardDataContext';

// Agentation widget is mounted once at the root layout
// (app/layout.tsx) via AgentationGate so it works on every route —
// auth, onboarding, dashboard, email previews. Don't double-mount it
// here; that was the previous bug.

// Demo mode — production-safe "sample workspace" layer.
//
// Replaces the old dev-only `aegis_preview` escape hatch. Demo is a
// real product feature: new users get a welcome modal asking whether
// to start with sample data or their empty workspace, and can switch
// between the two via the WorkspaceSwitcher in the sidebar at any
// time. Prospects can also visit /dashboard?demo=1 without auth to
// tour the product before signing up.
//
// State machine:
//   localStorage.aegis_demo === null     → no choice yet; show welcome
//                                          modal in DashboardLayout
//   localStorage.aegis_demo === 'true'   → ON  (in demo workspace)
//   localStorage.aegis_demo === 'false'  → OFF (in real workspace)
//
// The `?demo=1` query param force-enables and persists 'true'.
// The legacy `?preview=1` + `aegis_preview` are kept as dev-only aliases
// so existing screenshots / bookmarks don't break — they map onto the
// same mock layer.
function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('demo') === '1') {
    localStorage.setItem('aegis_demo', 'true');
    return true;
  }
  // ?preview=1 — legacy dev alias kept for backwards compat with
  // older screenshots/bookmarks. Dev-only.
  if (process.env.NODE_ENV !== 'production' && params.get('preview') === '1') {
    localStorage.setItem('aegis_demo', 'true');
    return true;
  }
  return localStorage.getItem('aegis_demo') === 'true';
}

/** True when the user has never made a choice — used by the
 *  DashboardLayout to decide whether to show the welcome modal. */
function isFirstVisit(): boolean {
  if (typeof window === 'undefined') return false;
  // If they came in via ?demo=1 we treat that as an implicit choice
  // (intentional URL), so don't gate them with a modal.
  const params = new URLSearchParams(window.location.search);
  if (params.get('demo') === '1') return false;
  return localStorage.getItem('aegis_demo') === null;
}

const DEMO_USER = {
  id: 'demo-user',
  username: 'demo',
  email: 'demo@runaegis.co',
  github_user_id: 0,
};

// Theme handling — reads from `?theme=` query string OR persisted
// localStorage flag (`aegis_theme`). When set to 'dark', the dashboard
// layout applies `data-theme="dark"` on the document root, which
// triggers the token-override block in globals.css.
//
// Scoping: this is set/cleared inside the dashboard layout, so /auth
// and /onboarding pages never receive `data-theme` — they always
// render in light mode by design.
//
// FOUC prevention: an inline <script> in app/layout.tsx reads the same
// localStorage flag at first paint and applies `data-theme` before
// React hydrates, so dark mode persists across reloads with no flash.
type ThemeFlag = 'dark' | null;

function readThemeFlag(): ThemeFlag {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('theme');
  if (fromQuery === 'dark') {
    localStorage.setItem('aegis_theme', 'dark');
    return 'dark';
  }
  if (fromQuery === 'light') {
    localStorage.removeItem('aegis_theme');
    return null;
  }
  return localStorage.getItem('aegis_theme') === 'dark' ? 'dark' : null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, setUser } = useUser();
  const [isReady, setIsReady] = useState(false);
  // Welcome-modal state. Determined once on mount (isFirstVisit reads
  // localStorage which is stable across renders). We deliberately
  // don't recompute on every render — the modal stays open until the
  // user picks, then closes for the rest of the session.
  const [showWelcome, setShowWelcome] = useState(false);

  // ⚠️ Run this synchronously during render (before children mount) so the
  // page's first fetchData() call already sees the patched api methods.
  // Idempotent — installPreviewApi guards itself. Same mock layer
  // powers both the legacy dev `aegis_preview` flag and the new
  // production-safe `aegis_demo` flag.
  if (typeof window !== 'undefined' && isDemoMode()) {
    installPreviewApi();
  }

  // Apply dark theme on mount when flag is set; clean up on unmount so
  // navigating away from /dashboard restores the default light theme.
  useEffect(() => {
    const theme = readThemeFlag();
    if (theme) {
      document.documentElement.dataset.theme = theme;
    } else {
      delete document.documentElement.dataset.theme;
    }
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, []);

  // Mark the document root with demo state — the WorkspaceSwitcher
  // and any other demo-aware component reads this. Cleanup on unmount
  // restores defaults for /auth + /onboarding.
  // Also gates the welcome modal: shows when the user has never made
  // a choice (localStorage.aegis_demo === null).
  useEffect(() => {
    if (isDemoMode()) {
      document.documentElement.dataset.demo = 'true';
    } else {
      delete document.documentElement.dataset.demo;
    }
    if (isFirstVisit()) {
      setShowWelcome(true);
    }
    return () => {
      delete document.documentElement.dataset.demo;
    };
  }, []);

  useEffect(() => {
    // Demo mode — skip auth entirely (lets prospects tour the dashboard
    // pre-signup) and inject a fake user record so user-scoped hooks
    // have something to bind to.
    if (isDemoMode()) {
      // if (!user?.id) setUser(DEMO_USER);
      setIsReady(true);
      return;
    }

    const verifyAndLoad = async () => {
      try {
        const userResponse = !user?.id
          ? await api.getUserDetails()
          : user;

        if (!user?.id && userResponse) {
          setUser(userResponse);
        }
        setIsReady(true);
      } catch (error) {
        if (error instanceof AuthError) {
          router.replace('/auth');
          return;
        }

        console.error(error);
        router.replace('/auth');
      }
    };

    verifyAndLoad();
  }, [router, setUser, user?.id]);

  if (!isReady) {
    return <AppShellSkeleton />;
  }

  // Welcome-modal handlers. Both write the persistence flag + drive
  // the next state. "Demo" requires a reload because installPreviewApi
  // monkey-patches the api singleton — only a fresh page load swaps
  // mocks in cleanly. "Empty" just dismisses since we don't install
  // any mocks.
  const handlePickDemo = () => {
    try {
      localStorage.setItem('aegis_demo', 'true');
    } catch {
      // ignore
    }
    window.location.reload();
  };
  const handlePickEmpty = () => {
    try {
      localStorage.setItem('aegis_demo', 'false');
    } catch {
      // ignore
    }
    setShowWelcome(false);
  };

  return (
    <DashboardDataProvider>
      <Layout>{children}</Layout>
      {/* First-visit welcome — only renders when localStorage.aegis_demo
          is null. After the user picks, the flag is persisted and the
          modal never reappears in this browser. The WorkspaceSwitcher
          in the sidebar then becomes the way to flip between modes. */}
      <DemoWelcomeModal
        open={showWelcome}
        onPickDemo={handlePickDemo}
        onPickEmpty={handlePickEmpty}
      />
      {/* ⌘K command palette — global keyboard handler inside, mounts
          once at the dashboard layout level so it's available on every
          route under /dashboard. */}
      <CommandPalette />
    </DashboardDataProvider>
  );
}