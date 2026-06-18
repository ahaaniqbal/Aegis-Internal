'use client';

/**
 * RoomTabs — Vercel/Linear-style sub-navigation for the room scope.
 *
 * Sticky horizontal tab strip rendered by [id]/layout.tsx, below the
 * Topbar but above the active tab's content. Active tab gets a
 * brand-orange underline + bolder text; inactive tabs are muted.
 *
 * Active state is computed against the current `pathname` rather than
 * tracking a `selected` prop — that way deep links and back/forward
 * navigation just work, and any sub-segment of a tab's URL space
 * still highlights the correct tab.
 *
 * Tabs scroll horizontally on narrow viewports (overflow-x-auto with
 * scrollbar hidden via the global `data-scrollable` attribute style).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  History,
  Plug,
  Settings as SettingsIcon,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoomTabsProps {
  roomId: string;
  className?: string;
}

interface TabDef {
  segment: string; // '' for the index/overview page
  label: string;
  icon: LucideIcon;
}

// Order is the visual order in the strip. Overview is first because
// it's the landing tab; Activity is second because it's the
// highest-traffic surface (what's the team doing right now?); Settings
// is last because it's rarely-used config.
const TABS: TabDef[] = [
  { segment: '',          label: 'Overview', icon: Activity },
  { segment: 'activity',  label: 'Activity', icon: History },
  { segment: 'tools',     label: 'Tools',    icon: Shield },
  { segment: 'members',   label: 'Members',  icon: Users },
  { segment: 'connect',   label: 'Connect',  icon: Plug },
  { segment: 'settings',  label: 'Settings', icon: SettingsIcon },
];

export function RoomTabs({ roomId, className }: RoomTabsProps) {
  const pathname = usePathname();
  const base = `/dashboard/rooms/${roomId}`;

  return (
    <div
      className={cn(
        'sticky z-10 border-b border-[var(--stroke-soft-200)] bg-[var(--white-0)]',
        // Topbar is sticky at top-12 on mobile / top-0 on lg+ and is
        // 56px tall — anchor this strip just below it on each.
        'top-[calc(48px+56px)] lg:top-[56px]',
        className,
      )}
      data-scrollable
    >
      <nav
        className="mx-auto flex max-w-[1320px] 2xl:max-w-[1480px] items-center gap-3 overflow-x-auto px-4 sm:px-6 lg:px-8"
        aria-label="Room sections"
      >
        {TABS.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base;
          // The Overview tab (`''`) is active only on the exact path;
          // every other tab matches if the current path starts with
          // its href (handles future nested routes like
          // /members/[memberId] keeping the Members tab active).
          const isActive = tab.segment
            ? pathname.startsWith(href)
            : pathname === base;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.segment || 'overview'}
              href={href}
              className={cn(
                'group/tab relative inline-flex h-10 items-center gap-1.5 whitespace-nowrap px-2',
                'text-[12.5px] font-medium tracking-[-0.005em]',
                'transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                isActive
                  ? 'text-[var(--neutral-strong-950)]'
                  : 'text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={cn(
                  'h-3.5 w-3.5',
                  isActive
                    ? 'text-[var(--primary-base)]'
                    : 'text-[var(--neutral-soft-400)] group-hover/tab:text-[var(--neutral-sub-600)]',
                )}
                strokeWidth={2}
                aria-hidden
              />
              {tab.label}
              {/* Active-state underline. 2px brand-orange bar that
                  bleeds to the bottom edge of the strip so it
                  visually "joins" the border below. */}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[var(--primary-base)]"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
