'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import { KillSwitchBanner } from '@/components/dashboard/KillSwitches';
import { DemoModeBanner } from '@/components/dashboard/DemoModeBanner';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--bg-app)]">
      <Sidebar />
      {/* mobile top bar = 48px; desktop sidebar width = --sidebar-w
          (220px expanded / 56px collapsed — see globals.css).
          Margin animates with the sidebar transition so content
          slides intentionally as the rail collapses/expands. */}
      <main
        className="min-h-dvh pt-12 lg:pt-0 lg:ml-[var(--sidebar-w)]"
        style={{ transition: 'margin-left var(--sidebar-transition)' }}
      >
        {/* Kill switch banner — renders only when one or more
            switches are active (read from localStorage). Sits above
            the Topbar so it's visible on every dashboard route. */}
        <KillSwitchBanner />
        {/* Demo mode banner — renders when aegis_demo=true AND the user
            hasn't dismissed it. Renders below KillSwitchBanner so urgent
            kill-switch state stays at the very top. */}
        <DemoModeBanner />
        {children}
      </main>
    </div>
  );
}
