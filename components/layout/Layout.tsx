'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {/* offset for mobile top bar (h-14) and desktop sidebar (w-60) */}
      <main className="min-h-screen pt-14 lg:ml-60 lg:pt-0">{children}</main>
    </div>
  );
}
