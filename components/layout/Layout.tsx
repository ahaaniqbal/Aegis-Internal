'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar';

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
        {children}
      </main>
    </div>
  );
}
