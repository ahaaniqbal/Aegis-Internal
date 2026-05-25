'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Activity,
  Layers,
  Users,
  Bell,
  BookOpen,
  FileText,
  Clock,
  Coins,
  Boxes,
  Bot,
  Copy,
  MoreHorizontal,
  Eye,
  Sparkles,
  LifeBuoy,
  Settings,
  Menu,
  Wrench,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  BarChart3,
  ShieldCheck,
  Store,
  Server,
  type LucideIcon,
} from 'lucide-react';
import { useUser } from '@/lib/hooks';
import { api } from '@/lib/api';
import type { RoomSummary } from '@/lib/types';
import { AegisLogo } from '@/components/ui/AegisLogo';
import { GenerativeAvatar } from '@/components/ui/GenerativeAvatar';
import { useToast } from '@/components/ui/Toast';
import { WorkspaceSwitcher } from '@/components/ui/WorkspaceSwitcher';

/**
 * Sidebar collapse state.
 *
 * State lives on `document.documentElement.dataset.sidebarCollapsed` —
 * NOT in React state. This pattern (mirrored from dark mode) gives us:
 *   • Pure-CSS animation driven by `--sidebar-w` var
 *   • Zero re-renders when toggling
 *   • FOUC-prevention via inline <head> script (app/layout.tsx)
 *   • Single source of truth visible in DevTools
 *
 * The hook below just syncs a local `useState` for icon rotation /
 * conditional rendering; the actual collapse state is the DOM attribute.
 */
function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(document.documentElement.dataset.sidebarCollapsed === 'true');
  }, []);

  const toggle = useCallback(() => {
    const next = document.documentElement.dataset.sidebarCollapsed !== 'true';
    if (next) {
      document.documentElement.dataset.sidebarCollapsed = 'true';
      localStorage.setItem('aegis_sidebar_collapsed', 'true');
    } else {
      delete document.documentElement.dataset.sidebarCollapsed;
      localStorage.removeItem('aegis_sidebar_collapsed');
    }
    setCollapsed(next);
  }, []);

  // Cmd+\ (Ctrl+\ on Windows/Linux) — standard sidebar-toggle shortcut
  // in Linear, Cursor, Notion, VS Code. Listening on window keeps it
  // global; no preventDefault needed since browsers don't bind \.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return { collapsed, toggle };
}

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: { value: number | string; tone: 'urgent' | 'neutral' };
  /** External link (mailto:, https://). Renders an <a> instead of
   *  next/link, can't be the active route, and shows no active state. */
  external?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Runs', href: '/dashboard/runs', icon: Activity },
      { name: 'Sessions', href: '/dashboard/sessions', icon: Layers },
      { name: 'MCP Servers', href: '/dashboard/mcp-servers', icon: Server },
      { name: 'Agents', href: '/dashboard/agents', icon: Bot },
      { name: 'Rooms', href: '/dashboard/rooms', icon: Users },
    ],
  },
  {
    label: 'Governance',
    items: [
      { name: 'Approvals', href: '/dashboard/approvals', icon: Bell },
      { name: 'Policies', href: '/dashboard/policies', icon: BookOpen },
      { name: 'Audit Trail', href: '/dashboard/audit', icon: FileText },
      { name: 'Compliance', href: '/dashboard/compliance', icon: ShieldCheck },
      { name: 'Marketplace', href: '/dashboard/marketplace', icon: Store, badge: { value: 'NEW', tone: 'neutral' } },
      { name: 'Freeze Windows', href: '/dashboard/freeze-window', icon: Clock },
      { name: 'Connectors', href: '/dashboard/connectors', icon: Boxes },
    ],
  },
  {
    label: 'Insights',
    items: [
      // CIL Insights sits at the top of Insights because it's the
      // moat surface. Token Expenditure (cost story) is secondary.
      { name: 'CIL Insights', href: '/dashboard/insights', icon: Sparkles },
      { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
      // Simulation Mode (Shadow Mode) — the GTM wedge surface. New
      // teams land here first: install observe-only, see a Risk
      // Report after 7 days, then escalate to enforce.
      { name: 'Simulation Mode', href: '/dashboard/simulation', icon: Eye },
      { name: 'Token Expenditure', href: '/dashboard/token-spenditure', icon: Coins },
    ],
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  // Support sits above Settings — when a pilot customer needs help,
  // they look at the bottom of the sidebar (same pattern as Linear,
  // Vercel, Stripe Dashboard). Opens the user's mail client to
  // hello@runaegis.co with a pre-filled subject so the team can route
  // it without back-and-forth on context.
  // NOTE: subject copy uses only hyphens / spaces, no em or en dashes —
  // matches the rest of the product's hard rule against em dashes.
  {
    name: 'Support',
    href: 'mailto:hello@runaegis.co?subject=Aegis%20support%20request',
    icon: LifeBuoy,
    external: true,
  },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { collapsed, toggle } = useSidebarCollapsed();
  const { user } = useUser();

  // Rooms sub-list under the Workspace › Rooms nav row. We fetch the
  // user's rooms once on mount (preview-data ships 3, real backend
  // returns whatever the user has membership to) and render up to 4
  // as nested rows with a small dither avatar + repo name. The list
  // is hidden in rail-mode via the standard `data-sidebar-hide`
  // attribute — when collapsed, only the parent Rooms nav icon shows.
  //
  // Per-Room visual identity reuses the same `GenerativeAvatar`
  // component the Rooms index uses (the 40px tile). At 18px each
  // avatar still reads as a recognisable Bayer-dither pattern, so
  // users learn to spot each room by its color signature.
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    api
      .getMyRooms()
      .then((data) => {
        if (mounted) setRooms(data);
      })
      .catch(() => {
        // Sidebar is non-critical for room-fetch failures — keep
        // the rest of the nav working without surfacing the error.
      });
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  // Per-Room quick-actions menu. Only one Room's menu is open at a
  // time — we store the room_id of the open menu (or null) plus the
  // viewport coordinates the popover should anchor to. We render the
  // popover via `createPortal` into <body> because the sidebar `<nav>`
  // has `overflow-y-auto`, which clips any absolute-positioned child.
  // The portal escapes that clip — coordinates come from the trigger
  // wrapper's getBoundingClientRect at click time.
  const [openRoomMenu, setOpenRoomMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(
    null,
  );
  // Two refs because the menu now lives outside the trigger row in
  // the DOM (portal). Outside-click logic must accept either as a
  // valid "still-inside-the-menu" target. The trigger ref is set
  // dynamically when the menu opens; the portal ref is set on the
  // rendered popover.
  const triggerWrapperRef = useRef<HTMLDivElement | null>(null);
  const portalMenuRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!openRoomMenu) return;
    // Pointer-down listener (not click) so dismissal lands before
    // any descendant button's onClick runs — keeps the menu from
    // feeling sticky.
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (triggerWrapperRef.current?.contains(t)) return;
      if (portalMenuRef.current?.contains(t)) return;
      setOpenRoomMenu(null);
      setMenuPos(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenRoomMenu(null);
        setMenuPos(null);
      }
    };
    // If the user scrolls the sidebar OR the page, the trigger
    // moves but the portal does not. Close on scroll rather than
    // re-computing position — matches Notion / Linear behavior.
    const onScroll = () => {
      setOpenRoomMenu(null);
      setMenuPos(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [openRoomMenu]);

  // Copy MCP endpoint to clipboard. We fetch the URL on click rather
  // than pre-loading it for every Room — keeps the sidebar boot
  // skinny. `api.getRoomIntegrationConfig` is patched by the
  // preview-data layer in demo mode and hits the real backend
  // otherwise; both return `{ url }`.
  const copyMcpEndpoint = useCallback(
    async (roomId: string, repoName: string) => {
      try {
        const { url } = await api.getRoomIntegrationConfig(roomId);
        await navigator.clipboard.writeText(url);
        toast.success('MCP endpoint copied', {
          description: `Paste into your agent config to connect ${repoName}.`,
        });
      } catch {
        toast.error('Could not copy MCP endpoint', {
          description: 'Open the Room and copy from the Connect tab.',
        });
      }
      setOpenRoomMenu(null);
    },
    [toast],
  );

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Nav-row link. `data-sidebar-center` is consumed by globals.css
  // to center the icon when the rail collapses. The label span is
  // marked `data-sidebar-hide` so it disappears with the rail. Badge
  // follows the same pattern; numeric value collapses to a small dot
  // indicator when minimized so urgent state remains visible at a
  // glance.
  const renderNavLink = (item: NavItem) => {
    // External items (mailto:, https://) can't match the current
    // route — never show an active state. The renderer composes the
    // common content once and swaps the wrapper element based on
    // `external`.
    const active = !item.external && isActive(item.href);
    const Icon = item.icon;

    const inner = (
      <>
        <Icon
          className="h-3.5 w-3.5 shrink-0"
          strokeWidth={active ? 2.25 : 2}
        />
        <span className="flex-1 truncate" data-sidebar-hide>{item.name}</span>
        {item.badge && (
          <span
            data-sidebar-hide
            className={[
              'inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[5px] px-[5px] text-[10.5px] font-bold tabular-nums',
              item.badge.tone === 'urgent'
                ? 'bg-[var(--error)] text-white'
                : 'bg-[var(--neutral-soft-200)] text-[var(--neutral-sub-600)]',
            ].join(' ')}
          >
            {item.badge.value}
          </span>
        )}
        {/* Tiny dot indicator that surfaces only when the rail is
            collapsed AND a badge exists — keeps "something needs your
            attention" visible without the full pill. Positioned at the
            icon's top-right corner. */}
        {item.badge && collapsed && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 h-[6px] w-[6px] rounded-full"
            style={{
              backgroundColor:
                item.badge.tone === 'urgent'
                  ? 'var(--error)'
                  : 'var(--neutral-sub-600)',
            }}
          />
        )}
      </>
    );

    const className = [
      'group relative flex h-8 items-center gap-2 rounded-[7px] px-2 text-[13px] font-medium tracking-[-0.01em]',
      // Hover motion — 200ms emphasized-decel curve, the same
      // family Linear/Cursor/Raycast use for sidebar nav. Explicit
      // `transition-colors` instead of `transition-all` so only
      // bg + text fade (no transform animation, which can feel
      // jittery on rapid mouse-over). On hover, text also shifts
      // from neutral-sub-600 → neutral-strong-950 for a subtle
      // brightness lift that signals interactivity.
      'transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
      active
        ? 'bg-[var(--primary-alpha-10)] text-[var(--primary-base)]'
        : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
    ].join(' ');
    const style = active ? { backgroundColor: 'rgba(250, 115, 25, 0.10)' } : undefined;

    // mailto: opens the user's local mail client; https://... uses
    // _blank + noopener noreferrer. No need for rel on mailto links.
    if (item.external) {
      const isHttp = item.href.startsWith('http');
      return (
        <a
          key={item.href}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          data-sidebar-center
          className={className}
          style={style}
          target={isHttp ? '_blank' : undefined}
          rel={isHttp ? 'noopener noreferrer' : undefined}
        >
          {inner}
        </a>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        data-sidebar-center
        className={className}
        style={style}
      >
        {inner}
      </Link>
    );
  };

  // Per-Room nav row — renders below the parent "Rooms" entry as an
  // indented child. The 16px GenerativeAvatar takes the icon column
  // slot so the row's text-x baseline lines up with the parent's
  // label-x baseline. We tighten height to h-7 (28px) and font to
  // 12px so the child rows read as a smaller secondary tier without
  // looking cramped next to the 32px-tall top-level nav rows above.
  //
  // The row is a `group` wrapper hosting two children:
  //   1. The Link — fills the row, navigates to /rooms/[id]
  //   2. A "..." quick-actions button + popover — appears on hover
  //      and on focus, offers Copy MCP endpoint / Activity / Tools
  //      shortcuts so power users (especially the Security Engineer
  //      iterating across multiple Rooms) skip a click. Hidden at
  //      rest so the sidebar stays calm; surfaces on `group-hover`
  //      or when the menu is open.
  const renderRoomLink = (room: RoomSummary) => {
    const roomId = room.room_id || room.id || '';
    const href = `/dashboard/rooms/${roomId}`;
    const active = pathname === href || pathname.startsWith(`${href}/`);
    const menuOpen = openRoomMenu === roomId;
    const repoName = room.repo_name || roomId;
    return (
      <div
        key={roomId}
        className="group relative"
        ref={menuOpen ? triggerWrapperRef : undefined}
      >
        <Link
          href={href}
          onClick={() => setMobileOpen(false)}
          className={[
            // `pr-8` reserves space for the absolute-positioned `...`
            // button so the label truncates before it overlaps.
            'relative flex h-7 items-center gap-2 rounded-[6px] pl-3 pr-8 text-[12px] font-medium tracking-[-0.005em]',
            'transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
            active
              ? 'text-[var(--primary-base)]'
              : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
          ].join(' ')}
          style={
            active ? { backgroundColor: 'rgba(250, 115, 25, 0.10)' } : undefined
          }
        >
          <GenerativeAvatar
            seed={repoName}
            variant="user"
            size={16}
            radius={4}
          />
          <span className="flex-1 truncate font-mono text-[11.5px]">
            {repoName}
          </span>
        </Link>

        {/* Quick-actions trigger. Absolute over the Link so a click
            on `...` doesn't navigate; opacity-controlled by
            group-hover and the open-state so it stays calm at rest.
            On click we capture the WRAPPER's viewport rect so the
            portal-rendered popover knows where to anchor. */}
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`${repoName} quick actions`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (menuOpen) {
              setOpenRoomMenu(null);
              setMenuPos(null);
              return;
            }
            const wrapper = e.currentTarget.parentElement;
            if (wrapper) {
              const rect = wrapper.getBoundingClientRect();
              setMenuPos({ left: rect.right + 6, top: rect.top });
            }
            setOpenRoomMenu(roomId);
          }}
          className={[
            'absolute right-1 top-1/2 -translate-y-1/2',
            'flex h-5 w-5 items-center justify-center rounded-[4px]',
            'text-[var(--neutral-soft-400)] transition-all duration-150',
            'hover:bg-[var(--neutral-soft-200)] hover:text-[var(--neutral-strong-950)] focus:opacity-100 focus:outline-none',
            menuOpen
              ? 'opacity-100 bg-[var(--neutral-soft-200)] text-[var(--neutral-strong-950)]'
              : 'opacity-0 group-hover:opacity-100',
          ].join(' ')}
        >
          <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>

        {/* Portal rendering lives at the Sidebar root (below the
            mobile drawer and desktop aside) so we don't double-mount
            it across the two NavContent instances. See the
            `roomMenuPortal` block at the bottom of the return. */}
      </div>
    );
  };

  // Render the per-Room quick-actions popover once at the Sidebar
  // root, regardless of how many NavContent instances exist (mobile
  // drawer + desktop aside both render NavContent; we don't want two
  // portals). Closed when openRoomMenu === null.
  const openRoom = openRoomMenu
    ? rooms.find((r) => (r.room_id || r.id) === openRoomMenu)
    : null;
  const openRoomName = openRoom?.repo_name || openRoomMenu || '';

  const roomMenuPortal =
    openRoomMenu && menuPos && typeof window !== 'undefined'
      ? createPortal(
          <div
            ref={portalMenuRef}
            role="menu"
            style={{
              position: 'fixed',
              left: menuPos.left,
              top: menuPos.top,
              zIndex: 100,
            }}
            className="w-[212px] overflow-hidden rounded-[8px] border border-[var(--stroke-soft-200)] bg-white py-1 shadow-[0_8px_24px_rgba(23,23,23,0.12)]"
          >
            {/* Header — Room identity so the user knows which Room
                they're acting on without checking the underlying row. */}
            <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-1">
              <GenerativeAvatar
                seed={openRoomName}
                variant="user"
                size={14}
                radius={3}
              />
              <span className="truncate font-mono text-[10.5px] font-medium text-[var(--neutral-sub-600)]">
                {openRoomName}
              </span>
            </div>
            <div className="my-1 h-px bg-[var(--stroke-soft-200)]" />
            <RoomMenuItem
              icon={Copy}
              label="Copy MCP endpoint"
              onClick={() => {
                void copyMcpEndpoint(openRoomMenu, openRoomName);
                setMenuPos(null);
              }}
            />
            <RoomMenuItem
              icon={Activity}
              label="Activity"
              href={`/dashboard/rooms/${openRoomMenu}/activity`}
              onClick={() => {
                setOpenRoomMenu(null);
                setMenuPos(null);
                setMobileOpen(false);
              }}
            />
            <RoomMenuItem
              icon={Wrench}
              label="Tools"
              href={`/dashboard/rooms/${openRoomMenu}/tools`}
              onClick={() => {
                setOpenRoomMenu(null);
                setMenuPos(null);
                setMobileOpen(false);
              }}
            />
          </div>,
          document.body,
        )
      : null;

  // The `desktop` flag tells NavContent which surface it's rendering
  // into. The mobile drawer always shows the expanded layout (no
  // need to collapse on a phone — the drawer is already off-canvas).
  // Desktop applies all the collapse-aware data attributes.
  const NavContent = ({ desktop = false }: { desktop?: boolean }) => (
    <>
      {/* Logo + collapse toggle row. When collapsed (desktop only):
          the logo is display:none via data-sidebar-hide, and the row
          itself switches to justify-center via data-sidebar-center
          so the lone toggle button lands centered in the rail instead
          of flying to the start edge under justify-between. */}
      <div
        data-sidebar-center={desktop ? '' : undefined}
        className="flex h-[56px] items-center justify-between border-b border-[var(--stroke-soft-200)] px-4"
      >
        <Link
          href="/dashboard"
          className="inline-flex items-center text-[var(--neutral-strong-950)] transition-opacity hover:opacity-80"
          aria-label="Aegis — Home"
          data-sidebar-hide={desktop ? '' : undefined}
        >
          <AegisLogo style={{ height: 22, width: 'auto' }} />
        </Link>
        {desktop ? (
          <button
            onClick={toggle}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[var(--neutral-sub-600)] transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar (⌘\\)' : 'Collapse sidebar (⌘\\)'}
          >
            {/* Lucide's panel-left toggle icons. Chevron direction
                already baked into the asset:
                  PanelLeftClose  — chevron points LEFT  ("close it")
                  PanelLeftOpen   — chevron points RIGHT ("open it")
                Switch based on current state so the icon visually
                represents the ACTION the click will perform. */}
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" strokeWidth={2} />
            ) : (
              <PanelLeftClose className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
        ) : (
          <button
            className="text-[var(--neutral-soft-400)] hover:text-[var(--neutral-strong-950)] lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav groups. Group LABELS fade out via data-sidebar-hide; in
          collapsed state, explicit margin-top between group divs
          (see globals.css) maintains the visual rhythm. All group
          labels share `pt-3` (12px) — uniform breathing room from
          brand row above + between groups.

          `overflow-x-visible` is explicit so hover affordances on
          collapsed nav rows can render past the rail's right edge. */}
      <nav className="flex-1 overflow-x-visible overflow-y-auto px-2 pb-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div
              data-sidebar-hide={desktop ? '' : undefined}
              className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]"
            >
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const nav = renderNavLink(item);
                // After the Workspace › Rooms row, inline the user's
                // rooms as a small sub-list. Hidden when sidebar is
                // collapsed (data-sidebar-hide removes it from layout
                // so the rail stays tight). When the active route is
                // already a /dashboard/rooms/[id] page, the matching
                // sub-item gets the primary tint so the user always
                // knows where they are in the room hierarchy.
                if (item.href === '/dashboard/rooms' && rooms.length > 0) {
                  return (
                    <div key={item.href}>
                      {nav}
                      <div
                        data-sidebar-hide={desktop ? '' : undefined}
                        className="mt-0.5 space-y-0.5"
                      >
                        {rooms.slice(0, 4).map((room) => renderRoomLink(room))}
                        {rooms.length > 4 && (
                          <Link
                            href="/dashboard/rooms"
                            onClick={() => setMobileOpen(false)}
                            className="flex h-7 items-center gap-2 rounded-[6px] pl-3 pr-2 text-[11.5px] font-medium text-[var(--neutral-soft-400)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-sub-600)]"
                          >
                            <span className="inline-flex h-4 w-4 items-center justify-center text-[10px]">
                              +
                            </span>
                            <span className="truncate">
                              {rooms.length - 4} more
                            </span>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                }
                return nav;
              })}
            </div>
          </div>
        ))}

        <div>
          <div
            data-sidebar-hide={desktop ? '' : undefined}
            className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]"
          >
            Admin
          </div>
          <div className="space-y-0.5">
            {BOTTOM_ITEMS.map((item) => renderNavLink(item))}
          </div>
        </div>
      </nav>

      {/* Workspace + account row.
          The WorkspaceSwitcher consolidates what was previously two
          separate concerns (workspace switching + user identity +
          sign-out) into one bottom-anchored control. Click → drop-up
          menu with workspace options + Settings + Sign out.
          Collapsed sidebar shows only the 32px workspace mark
          centered; the menu pops out rightward when clicked. */}
      <div className="border-t border-[var(--stroke-soft-200)] px-2 py-[10px]">
        <div
          data-sidebar-center={desktop ? '' : undefined}
          className="w-full"
        >
          <WorkspaceSwitcher />
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-12 items-center justify-between border-b border-[var(--stroke-soft-200)] bg-white px-4 lg:hidden">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-[var(--neutral-strong-950)]"
          aria-label="Aegis — Home"
        >
          <AegisLogo style={{ height: 22, width: 'auto' }} />
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-[var(--neutral-soft-400)] hover:text-[var(--neutral-strong-950)]"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer — always full 220px wide (no collapse on mobile,
          the drawer slides off-canvas instead). */}
      <aside
        className={[
          'fixed left-0 top-0 z-50 flex h-dvh w-[220px] flex-col bg-white transition-transform duration-200 lg:hidden',
          'border-r border-[var(--stroke-soft-200)]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <NavContent />
      </aside>

      {/* Desktop sidebar — width driven by --sidebar-w (220px / 56px).
          The width itself is the animated property; everything inside
          (labels, group headers, user identity) responds via the
          data-sidebar-hide / data-sidebar-center attributes. */}
      <aside
        className="fixed left-0 top-0 z-30 hidden h-dvh flex-col border-r border-[var(--stroke-soft-200)] bg-white lg:flex"
        style={{
          width: 'var(--sidebar-w)',
          transition: 'width var(--sidebar-transition)',
        }}
      >
        <NavContent desktop />
      </aside>

      {/* Per-Room quick-actions popover — portaled to <body> so it
          escapes the sidebar's overflow-clip and floats freely at
          fixed viewport coordinates. */}
      {roomMenuPortal}
    </>
  );
}

// ─── Room actions menu item ─────────────────────────────────────────
/**
 * One item inside the per-Room quick-actions popover. Renders either
 * a navigational <Link> (when `href` is provided) or a <button> (for
 * actions like Copy MCP endpoint that don't navigate). Visual rhythm
 * matches the WorkspaceSwitcher menu items — same h-7, same gap,
 * same hover treatment — so the two sidebar popovers read as one
 * design family.
 */
function RoomMenuItem({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const className =
    'flex h-7 w-full items-center gap-2 px-2.5 text-left text-[12px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)] focus:bg-[var(--neutral-weak-50)] focus:text-[var(--neutral-strong-950)] focus:outline-none';
  const inner = (
    <>
      <Icon
        className="h-3.5 w-3.5 shrink-0 text-[var(--neutral-soft-400)]"
        strokeWidth={2}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </>
  );
  if (href) {
    return (
      <Link role="menuitem" href={href} onClick={onClick} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      className={className}
    >
      {inner}
    </button>
  );
}
