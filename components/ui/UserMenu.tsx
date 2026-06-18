'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Bell,
  CreditCard,
  ExternalLink,
  HelpCircle,
  KeyRound,
  LogOut,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { useUser } from '@/lib/hooks';
import { GenerativeAvatar } from '@/components/ui/GenerativeAvatar';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Badge } from '@/components/ui/Badge';
import ThemeToggle from '@/components/ui/ThemeToggle';
import {useRouter} from "next/navigation";
import { api } from "@/lib/api";

// Emphasized-decel easing — matches DateRangePicker / homepage rhythm.
const EASE_EMPH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

interface UserMenuProps {
  /** Optional unread approvals — surfaced as a small inline pill. */
  pendingApprovals?: number;
  className?: string;
}

export function UserMenu({ pendingApprovals = 0, className }: UserMenuProps) {
  const { user, clearUser } = useUser();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();

  // Track demo state so the topbar avatar reflects the current
  // workspace identity. When in demo mode, use the demo variant
  // (brand orange dithered pattern); otherwise use the user's
  // own seeded pattern. Mirrors the same source-of-truth as the
  // WorkspaceSwitcher (data-demo attribute on <html>).
  const [demoOn, setDemoOn] = useState<boolean | null>(null);
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

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSignOut = async () => {
    clearUser();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('aegis_preview');
    await api.logOut();
    router.replace('/auth');
  };

  const username = user?.username || 'Not connected';
  const email = user?.email || '—';

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-7 items-center justify-center rounded-[8px] transition-shadow hover:ring-2 hover:ring-[var(--primary-alpha-16)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-alpha-24)]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open user menu"
        title={username}
      >
        {/* Avatar reflects the active workspace identity:
            demo → GenerativeAvatar variant=demo (orange dots),
            real → UserAvatar (custom upload OR seeded generative).
            Same identity logic as the WorkspaceSwitcher so the
            topbar + sidebar avatars always agree. */}
        {demoOn === null ? (
          <span className="h-7 w-7 rounded-[7px] bg-[var(--neutral-weak-50)]" />
        ) : demoOn ? (
          <GenerativeAvatar
            seed="aegis-demo-workspace"
            variant="demo"
            size={28}
            radius={7}
          />
        ) : (
          <UserAvatar
            seed={user?.username || user?.email || 'user'}
            size={28}
            radius={7}
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={popoverRef}
            role="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: EASE_EMPH }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 z-50 mt-2 w-[280px] overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_12px_32px_rgba(23,23,23,0.10),0_2px_8px_rgba(23,23,23,0.04)]"
          >
            {/* Identity header */}
            <div className="flex items-center gap-3 border-b border-[var(--stroke-soft-200)] p-3">
              {/* 40px header avatar — larger size shows the dot
                  pattern or uploaded photo more clearly, anchoring
                  the menu with strong identity. */}
              {demoOn === null ? (
                <span className="h-10 w-10 shrink-0 rounded-[10px] bg-[var(--neutral-weak-50)]" />
              ) : demoOn ? (
                <GenerativeAvatar
                  seed="aegis-demo-workspace"
                  variant="demo"
                  size={40}
                  radius={10}
                />
              ) : (
                <UserAvatar
                  seed={user?.username || user?.email || 'user'}
                  size={40}
                  radius={10}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[var(--neutral-strong-950)]">
                  {username}
                </p>
                <p className="truncate text-[11.5px] text-[var(--neutral-soft-400)]">
                  {email}
                </p>
              </div>
              <Badge tone="primary" uppercase>
                Free
              </Badge>
            </div>

            {/* Quick stat — only when there's something to surface */}
            {pendingApprovals > 0 && (
              <Link
                href="/dashboard/approvals"
                onClick={() => setOpen(false)}
                role="menuitem"
                className="flex items-center justify-between gap-2 border-b border-[var(--stroke-soft-200)] bg-[var(--primary-lighter)] px-3 py-2.5 transition-colors hover:bg-[var(--primary-alpha-16)]"
              >
                <span className="inline-flex items-center gap-2 text-[12.5px] font-medium text-[var(--primary-dark)]">
                  <Sparkles
                    className="h-3.5 w-3.5"
                    style={{ color: 'var(--primary-base)' }}
                    strokeWidth={2}
                  />
                  {pendingApprovals} pending {pendingApprovals === 1 ? 'approval' : 'approvals'}
                </span>
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--primary-base)]">
                  Review →
                </span>
              </Link>
            )}

            {/* Menu group 1 */}
            <div className="p-1">
              <Item
                href="/dashboard/settings#profile"
                icon={UserIcon}
                label="Profile"
                shortcut="⌘P"
                onClick={() => setOpen(false)}
              />
              <Item
                href="/dashboard/settings#notifications"
                icon={Bell}
                label="Notifications"
                onClick={() => setOpen(false)}
              />
              <Item
                href="/dashboard/settings#api-keys"
                icon={KeyRound}
                label="API keys"
                onClick={() => setOpen(false)}
              />
              <Item
                href="/dashboard/settings#billing"
                icon={CreditCard}
                label="Plan & usage"
                onClick={() => setOpen(false)}
              />
            </div>

            <div className="border-t border-[var(--stroke-soft-200)]" />

            {/* Appearance — inline theme toggle. Not a navigable row;
                the segmented pill flips theme instantly without
                closing the menu, so users can A/B before committing. */}
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="text-[12.5px] font-medium text-[var(--neutral-sub-600)]">
                Appearance
              </span>
              <ThemeToggle variant="compact" />
            </div>

            <div className="border-t border-[var(--stroke-soft-200)]" />

            {/* Menu group 2 — external help */}
            <div className="p-1">
              <Item
                href="https://docs.runaegis.co"
                external
                icon={HelpCircle}
                label="Documentation"
                trailingIcon={
                  <ExternalLink
                    className="h-3 w-3"
                    style={{ color: 'var(--neutral-soft-400)' }}
                    strokeWidth={2}
                  />
                }
                onClick={() => setOpen(false)}
              />
            </div>

            <div className="border-t border-[var(--stroke-soft-200)]" />

            {/* Sign out */}
            <div className="p-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  handleSignOut();
                }}
                role="menuitem"
                className="flex h-8 w-full items-center gap-2.5 rounded-[7px] px-2 text-[13px] font-medium tracking-[-0.01em] text-[var(--error)] hover:bg-[var(--error-lighter)]"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Menu item ──────────────────────────────────────────────────────────────
function Item({
  href,
  icon: Icon,
  label,
  shortcut,
  trailingIcon,
  external,
  onClick,
}: {
  href: string;
  icon: typeof UserIcon;
  label: string;
  shortcut?: string;
  trailingIcon?: React.ReactNode;
  external?: boolean;
  onClick?: () => void;
}) {
  const className =
    'flex h-8 w-full items-center gap-2.5 rounded-[7px] px-2 text-[13px] font-medium tracking-[-0.01em] text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]';

  const body = (
    <>
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      <span className="flex-1 truncate text-left">{label}</span>
      {shortcut && (
        <kbd className="rounded-[5px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--neutral-soft-400)]">
          {shortcut}
        </kbd>
      )}
      {trailingIcon}
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        role="menuitem"
        className={className}
      >
        {body}
      </a>
    );
  }

  return (
    <Link href={href} onClick={onClick} role="menuitem" className={className}>
      {body}
    </Link>
  );
}
