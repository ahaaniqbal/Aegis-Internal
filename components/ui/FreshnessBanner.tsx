'use client';

/**
 * FreshnessBanner — "N new items available" pill for auto-refreshing
 * pages.
 *
 * The problem this solves: pages like /dashboard/approvals poll the
 * server every 30s and silently mutate the list. A reviewer who's
 * mid-task has no signal that their queue just grew, and the page
 * can shift under them as new items insert at the top.
 *
 * The fix (Twitter "X new tweets" pattern): show a centered pill at
 * the top of the page when the polled count exceeds what the user
 * last acknowledged. Click → caller decides what to reveal + scroll.
 * No click → pill stays until the user takes action.
 *
 * Why a pill, not a banner: full-width banners cost vertical space
 * permanently. A floating pill respects the page layout, can't be
 * confused for permanent chrome, and disappears as soon as it's
 * acted on. Twitter, Mastodon, Linear all use this exact pattern.
 *
 * Sticky positioning: pinned just below the topbar (`top-[64px]`
 * on lg+ to clear the 56px topbar + 8px breathing room) so it
 * stays visible as the user scrolls through their queue. Mobile
 * pins below the mobile-bar + topbar stack.
 */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FreshnessBannerProps {
  /** Number of new items detected since the user last acknowledged.
   *  When 0 (or negative), nothing renders. */
  count: number;
  /** Singular label, e.g. "new approval". Pluralized automatically. */
  label?: string;
  /** Fired when the user clicks the pill — caller should mark items
   *  as seen, scroll to top, etc. */
  onReveal: () => void;
  /** Optional wrapper class for positioning overrides. */
  className?: string;
}

export function FreshnessBanner({
  count,
  label = 'new item',
  onReveal,
  className,
}: FreshnessBannerProps) {
  const reduce = useReducedMotion();
  const plural = count === 1 ? label : `${label}s`;

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          // pointer-events-none on the wrapper lets the page content
          // underneath stay clickable; the button itself opts back in.
          className={cn(
            'pointer-events-none sticky top-[64px] z-20 flex justify-center px-4',
            className,
          )}
        >
          <button
            type="button"
            onClick={onReveal}
            className={cn(
              'pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-full',
              'border border-[var(--primary-base)]/25 bg-[var(--white-0)] px-3.5',
              'text-[12.5px] font-semibold text-[var(--primary-base)]',
              // Soft drop shadow so the pill reads as a floating overlay
              // rather than inline content. Matches the elevation of
              // popover surfaces elsewhere in the product.
              'shadow-[0_8px_24px_rgba(23,23,23,0.08),0_2px_4px_rgba(23,23,23,0.04)]',
              'transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
              'hover:border-[var(--primary-base)]/50 hover:bg-[var(--primary-alpha-10)]',
            )}
            aria-live="polite"
          >
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            <span>
              {count.toLocaleString()} {plural}
            </span>
            <span className="text-[11.5px] font-normal text-[var(--primary-base)]/70">
              · view
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
