'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ArrowUpRight,
  Bell,
  BellOff,
  CheckCircle2,
  Settings as SettingsIcon,
} from 'lucide-react';

const EASE_EMPH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

interface NotificationsPanelProps {
  /** Optional unread badge count surfaced on the bell trigger. */
  unreadCount?: number;
}

/**
 * Bell button + popover panel. Empty state borrows the same concentric-ring
 * + brand-orange center motif from the dashboard EmptyState component so
 * the whole product feels cohesive.
 */
export function NotificationsPanel({ unreadCount = 0 }: NotificationsPanelProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
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

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-7 w-7 items-center justify-center rounded-[8px] border border-[var(--stroke-sub-300)] bg-white text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--primary-alpha-16)]"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="h-3.5 w-3.5" strokeWidth={2} />
        {unreadCount > 0 && (
          <span
            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--error)] ring-2 ring-white"
            aria-hidden
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: EASE_EMPH }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 z-50 mt-2 w-[360px] overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_12px_32px_rgba(23,23,23,0.10),0_2px_8px_rgba(23,23,23,0.04)]"
          >
            {/* Header — 16px horizontal, 8px vertical.
                The title text on the left hugs the 16px edge directly.
                The buttons on the right have built-in internal padding
                that pushes the visible glyph ~7px further from the panel
                edge — so without compensation, the right side LOOKS
                more padded than the left. We pull the right group
                inward with -mr-[7px] so the rightmost icon's visible
                glyph optically aligns with the title's 16px left edge. */}
            <div className="flex items-center justify-between gap-2 border-b border-[var(--stroke-soft-200)] px-[16px] py-[8px]">
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Notifications
                </h2>
                {unreadCount > 0 && (
                  <span
                    className="inline-flex h-[18px] items-center justify-center rounded-[5px] px-[6px] text-[10.5px] font-bold text-white tabular-nums"
                    style={{ backgroundColor: 'var(--error)' }}
                  >
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="-mr-[7px] flex items-center gap-1">
                <button
                  type="button"
                  disabled={unreadCount === 0}
                  className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2 text-[12px] font-medium text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                  Mark all read
                </button>
                <Link
                  href="/dashboard/settings#notifications"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--neutral-soft-400)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
                  aria-label="Notification settings"
                >
                  <SettingsIcon className="h-3.5 w-3.5" strokeWidth={2} />
                </Link>
              </div>
            </div>

            {/* Tabs (placeholders for future filter) */}
            <div className="flex items-center gap-1 border-b border-[var(--stroke-soft-200)] px-3 py-2">
              {[
                { id: 'all',     label: 'All' },
                { id: 'unread',  label: 'Unread' },
                { id: 'mentions', label: 'Mentions' },
              ].map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  className={[
                    'inline-flex h-6 items-center rounded-[6px] px-2.5 text-[12px] font-medium',
                    i === 0
                      ? 'bg-[var(--primary-alpha-10)] text-[var(--primary-base)]'
                      : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
                  ].join(' ')}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Empty state */}
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <div className="relative mb-5 flex items-center justify-center" aria-hidden>
                <div
                  className="absolute h-[88px] w-[88px] rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(250,115,25,0.08) 0%, rgba(250,115,25,0) 65%)',
                  }}
                />
                <div className="absolute h-[64px] w-[64px] rounded-full border border-[var(--stroke-soft-200)]" />
                <div className="absolute h-[48px] w-[48px] rounded-full border border-[var(--stroke-soft-200)]" />
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_1px_2px_rgba(23,23,23,0.06)] ring-1 ring-[var(--stroke-soft-200)]">
                  <BellOff
                    className="h-4 w-4"
                    style={{ color: 'var(--primary-base)' }}
                    strokeWidth={2}
                  />
                </div>
              </div>
              <h3 className="text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                You&apos;re all caught up
              </h3>
              <p className="mt-1 max-w-[260px] text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
                When agents need approval, hit a block, or trigger an alert,
                it&apos;ll show up here.
              </p>
              <Link
                href="/dashboard/settings#notifications"
                onClick={() => setOpen(false)}
                className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--neutral-sub-600)] hover:text-[var(--primary-base)]"
              >
                Manage notifications
                <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
