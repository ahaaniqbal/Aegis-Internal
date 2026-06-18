'use client';

/**
 * Workspace switcher — bottom of sidebar.
 *
 * Single point of identity + workspace switching + account actions.
 * Two workspaces always exist for any signed-in user:
 *   • Demo workspace  — pre-populated tour data
 *   • [Their] workspace — their real account (may be empty)
 *
 * Visual language (v3 — letter-based monograms instead of icons):
 *   The marks are 32px rounded squares with a single letter inside,
 *   matching the Linear/Notion/Vercel workspace-avatar pattern.
 *   Quiet, identifying, premium — not screaming for attention like
 *   the previous gradient + Sparkles treatment.
 *
 *   Demo mark   : subtle primary tint, primary-base "D" glyph
 *   User mark   : neutral square, neutral-strong-950 initials
 *
 * Switching workspaces triggers `window.location.reload()` because
 * the mock layer in lib/preview-data.ts monkey-patches the api
 * singleton — only a fresh page load swaps mocks ↔ real client.
 * Picking the same workspace is a no-op (just closes the menu).
 *
 * Drop-up positioning (`bottom: 100%`) so the menu pops above the
 * trigger — anchored at the bottom of the sidebar, opening up into
 * the visible area instead of off-screen.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronsUpDown,
  LogOut,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useUser } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { GenerativeAvatar } from '@/components/ui/GenerativeAvatar';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { api } from '@/lib/api';

export function WorkspaceSwitcher() {
  const router = useRouter();
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [demoOn, setDemoOn] = useState<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mirror data-demo attribute on <html> so we render the right
  // active state and react to flips from any source (URL param,
  // another tab, programmatic).
  useEffect(() => {
    const update = () => {
      setDemoOn(document.documentElement.dataset.demo === 'true');
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-demo'],
    });
    return () => observer.disconnect();
  }, []);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const switchTo = (target: 'demo' | 'real') => {
    setOpen(false);
    if (target === 'demo' && demoOn) return; // no-op
    if (target === 'real' && !demoOn) return; // no-op
    try {
      localStorage.setItem('aegis_demo', target === 'demo' ? 'true' : 'false');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  const handleSignOut = () => {
    setOpen(false);
    try {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('aegis_preview');
      api.logOut();
      router.replace('/auth');
    } catch{

    }
  };

  const handleSettings = () => {
    setOpen(false);
    router.push('/dashboard/settings');
  };

  // Loading shimmer slot — avoids hydration flash + keeps the bottom
  // row's footprint stable on mount.
  if (demoOn === null) {
    return (
      <div className="flex h-[44px] items-center gap-2.5 px-2">
        <div className="h-8 w-8 shrink-0 rounded-[8px] bg-[var(--neutral-weak-50)]" />
        <div className="min-w-0 flex-1" data-sidebar-hide>
          <div className="h-[10px] w-3/5 rounded bg-[var(--neutral-weak-50)]" />
          <div className="mt-1 h-[8px] w-4/5 rounded bg-[var(--neutral-weak-50)]" />
        </div>
      </div>
    );
  }

  // The seed string drives both color + dot pattern in the
  // GenerativeAvatar. Using `username` (stable per-user) means the
  // avatar is consistent across sessions, devices, and re-renders.
  const userSeed = user?.username || user?.email || 'user';
  const userTitle = user?.username ?? 'My workspace';
  const userSubtitle = user?.email ?? 'Personal';

  // "Demo + no real account" detection. Real GitHub user IDs start at 1+,
  // so a 0/undefined id means the user is exploring the demo without
  // having signed up yet (entered via `/dashboard?demo=1`, marketing URL,
  // or the welcome modal pre-auth). For those users, the "Switch to my
  // workspace" row would just bounce them to /auth without explanation —
  // we relabel it to make the sign-up requirement honest.
  const hasRealAccount = (user?.github_user_id ?? 0) > 0;
  const showUnauthLabel = !!demoOn && !hasRealAccount;

  const handleSignUpFromDemo = () => {
    setOpen(false);
    // Don't flip `aegis_demo` here — if the user bails on the auth page,
    // they should return to the demo workspace they were exploring.
    // The flip happens at the end of onboarding (onboarding/page.tsx)
    // once the user actually commits to a real account.
    router.push('/auth');
  };

  // Active workspace state for the trigger button.
  const activeTitle = demoOn ? 'Demo workspace' : userTitle;
  const activeSubtitle = demoOn ? 'Sample data' : userSubtitle;

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={activeTitle}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left',
          'transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
          open
            ? 'bg-[var(--neutral-weak-50)]'
            : 'hover:bg-[var(--neutral-weak-50)]',
        )}
      >
        {demoOn ? (
          <GenerativeAvatar seed="aegis-demo-workspace" variant="demo" size={32} />
        ) : (
          // Goes through UserAvatar so a custom-uploaded photo (set
          // in Settings → Profile) overrides the generative mark.
          // Demo workspace is intentionally NOT user-customizable.
          <UserAvatar seed={userSeed} size={32} />
        )}
        <div className="min-w-0 flex-1" data-sidebar-hide>
          <p className="truncate text-[12.5px] font-semibold leading-tight text-[var(--neutral-strong-950)]">
            {activeTitle}
          </p>
          <p className="truncate text-[11px] leading-tight text-[var(--neutral-soft-400)]">
            {activeSubtitle}
          </p>
        </div>
        <ChevronsUpDown
          className="h-3.5 w-3.5 shrink-0 text-[var(--neutral-soft-400)]"
          strokeWidth={2}
          data-sidebar-hide
          aria-hidden
        />
      </button>

      {/* Drop-up menu — anchored above the trigger. Sized at min 260px
          so the row content has room to breathe even when the sidebar
          is in its narrow 56px collapsed state (the menu pops out
          past the rail edge). */}
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden',
            'min-w-[260px] rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)]',
            'shadow-[0_12px_32px_rgba(23,23,23,0.10),0_2px_6px_rgba(23,23,23,0.04)]',
          )}
        >
          {/* Workspaces — no section header. Two rows with a hairline
              gap so the hover state on an inactive row reads as
              clearly separate from the active (tinted) row above —
              otherwise the two backgrounds touch + look fused. Same
              gap pattern applied to the Account section below. */}
          <div className="space-y-0.5 p-1.5">
            <WorkspaceRow
              mark={
                <GenerativeAvatar
                  seed="aegis-demo-workspace"
                  variant="demo"
                  size={32}
                />
              }
              title="Demo workspace"
              subtitle="Sample · always available"
              active={!!demoOn}
              onClick={() => switchTo('demo')}
            />
            <WorkspaceRow
              mark={<UserAvatar seed={userSeed} size={32} />}
              title={showUnauthLabel ? 'Sign up to use your workspace' : userTitle}
              subtitle={showUnauthLabel ? 'Real data · GitHub required' : userSubtitle}
              active={!demoOn}
              onClick={showUnauthLabel ? handleSignUpFromDemo : () => switchTo('real')}
            />
          </div>

          <div className="mx-2 border-t border-[var(--stroke-soft-200)]" />

          <div className="space-y-0.5 p-1.5">
            <ActionRow
              icon={<SettingsIcon className="h-3.5 w-3.5" strokeWidth={2} />}
              label="Settings"
              onClick={handleSettings}
            />
            <ActionRow
              icon={<LogOut className="h-3.5 w-3.5" strokeWidth={2} />}
              label="Sign out"
              destructive
              onClick={handleSignOut}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** A workspace row in the drop-up menu — mark + title + subtitle.
 *  Active state: subtle brand-orange tint bg (--primary-alpha-10) +
 *  small filled dot on the right. The chunky Check icon previous
 *  versions used felt like a confirmation indicator, not a "this is
 *  where you are" indicator — the small filled dot reads more like
 *  a live presence marker, which is what we want. */
function WorkspaceRow({
  mark,
  title,
  subtitle,
  active,
  onClick,
}: {
  mark: React.ReactNode;
  title: string;
  subtitle: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left',
        'transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        // Active: subtle brand-orange tint (--primary-alpha-10 is
        // rgba(250,115,25,0.10)) — reads as "you are here" without
        // screaming. Inactive rows hover to neutral-weak-50 so the
        // tinted-vs-neutral contrast does the heavy lifting at idle.
        active
          ? 'bg-[var(--primary-alpha-10)] hover:bg-[var(--primary-alpha-16)]'
          : 'hover:bg-[var(--neutral-weak-50)]',
      )}
    >
      {mark}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold leading-tight text-[var(--neutral-strong-950)]">
          {title}
        </p>
        <p className="truncate text-[11px] leading-tight text-[var(--neutral-soft-400)]">
          {subtitle}
        </p>
      </div>
      {/* Active indicator — a small filled dot. Smaller than the
          previous Check icon, sits in the same right-edge slot, but
          reads as "live/active" rather than "approved/checked". */}
      {active && (
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary-base)]"
          aria-hidden
        />
      )}
    </button>
  );
}

/** A flat action row (Settings, Sign out). Smaller footprint than a
 *  workspace row — no subtitle line — so the visual rhythm signals
 *  "these are quick actions, not identity choices."
 *
 *  Destructive variant matches the UserMenu's Sign-out treatment:
 *  text + icon are ALWAYS red (--error), hover lifts the bg to
 *  --error-lighter. Both menus now share the same destructive
 *  pattern → same red on hover. */
function ActionRow({
  icon,
  label,
  destructive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[7px] px-2 py-1.5 text-left',
        'text-[12.5px] font-medium',
        'transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        destructive
          ? 'text-[var(--error)] hover:bg-[var(--error-lighter)]'
          : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
      )}
    >
      {/* Icon inherits its parent's text color via `text-current`,
          so destructive rows have a red icon at rest + red icon on
          hover (matches UserMenu). Non-destructive rows get the
          subtle --neutral-soft-400 tone applied at the wrapper. */}
      <span
        className={destructive ? undefined : 'text-[var(--neutral-soft-400)]'}
      >
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}
