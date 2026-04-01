'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield,
  Activity,
  Layers,
  Bell,
  BookOpen,
  FileText,
  Settings,
  Menu,
  X,
  Plug,
  ChevronDown,
} from 'lucide-react';
import { useUser } from '@/lib/hooks';
import { getInitials } from '@/lib/utils';

const nav = [
  { name: 'Runs', href: '/dashboard', icon: Activity },
  { name: 'Sessions', href: '/dashboard/sessions', icon: Layers },
  { name: 'Approvals', href: '/dashboard/approvals', icon: Bell },
  { name: 'Policies', href: '/dashboard/policies', icon: BookOpen },
  { name: 'Audit Trail', href: '/dashboard/audit', icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const NavContent = () => (
    <>
      {/* Logo / Team Selector */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-foreground">
            <Shield className="h-3.5 w-3.5 text-background" />
          </div>
          <span className="text-sm font-medium text-foreground">Aegis</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button
          className="lg:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-transparent px-3 text-sm text-muted-foreground">
          <span className="text-xs">Find...</span>
          <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">F</kbd>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2">
        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <item.icon className="h-4 w-4" strokeWidth={1.5} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border p-2">
        <Link
          href="/dashboard/integrations"
          className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
            pathname === '/dashboard/integrations'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <Plug className="h-4 w-4" strokeWidth={1.5} />
          Integrations
        </Link>

        <Link
          href="/dashboard/settings"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
            pathname === '/dashboard/settings'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <Settings className="h-4 w-4" strokeWidth={1.5} />
          Settings
        </Link>

        {/* User */}
        <div className="mt-2 flex items-center gap-2.5 rounded-md px-3 py-2 hover:bg-muted/50 transition-colors cursor-pointer">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-pink-500 text-[10px] font-medium text-white">
            {user ? getInitials(user.username) : '?'}
          </div>
          <span className="truncate text-sm text-muted-foreground">
            {user?.username || 'Not connected'}
          </span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-foreground">
            <Shield className="h-3.5 w-3.5 text-background" />
          </div>
          <span className="text-sm font-medium text-foreground">Aegis</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-60 flex-col border-r border-border bg-background transition-transform duration-200 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <NavContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-60 flex-col border-r border-border bg-background lg:flex">
        <NavContent />
      </aside>
    </>
  );
}
