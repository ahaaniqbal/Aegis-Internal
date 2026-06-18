'use client';

/**
 * BulkActionBar — floating toolbar that appears when rows in a list
 * are selected for bulk operations.
 *
 * Pattern reference: Mercury Bank's transactions page (Refero screen
 * 8e3fddc7-534c-4663-b321-5d90e83a8d90). Floating bar docked near
 * the bottom-center of the content area, slides up + fades in over
 * 180–240ms, contains a selection count, primary actions, and a
 * clear/dismiss control.
 *
 * Why bottom-center (not top-of-list): doesn't push content down,
 * stays visible while the user scrolls long lists, keyboard focus
 * for the bar's buttons doesn't fight with focus inside individual
 * rows. Linear / Mercury / Stripe Dashboard all use this placement
 * for the same reason.
 *
 * Generic by design — takes a slot for `actions` so each consumer
 * page wires its own buttons (Approve all / Deny all on Approvals,
 * Categorize / Mark reconciled on a finance page, etc.).
 */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkActionBarProps {
  /** Number of items currently selected. Bar hides when 0. */
  count: number;
  /** Singular noun for the selected items, e.g. "approval". Auto-pluralized. */
  itemLabel?: string;
  /** Action buttons rendered after the divider — typically Approve all,
   *  Deny all, etc. Caller provides these so each page can style its
   *  destructive vs primary buttons appropriately. */
  actions: React.ReactNode;
  /** Clear-selection handler. Wires to the X icon on the right. */
  onClear: () => void;
  className?: string;
}

export function BulkActionBar({
  count,
  itemLabel = 'item',
  actions,
  onClear,
  className,
}: BulkActionBarProps) {
  const reduce = useReducedMotion();
  const plural = count === 1 ? itemLabel : `${itemLabel}s`;

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          // Fixed-position floating bar, centered horizontally. Sits
          // above page content via z-30 — high enough to clear cards
          // + sticky chrome, low enough to not fight modals/dialogs.
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          className={cn(
            'fixed bottom-6 left-1/2 z-30 -translate-x-1/2',
            'pointer-events-none',
            className,
          )}
          role="toolbar"
          aria-label={`${count} ${plural} selected`}
        >
          <div
            className={cn(
              // Container radius matches the rest of the chrome
              // family (cards, popovers, palette modal at 12px) —
              // slightly larger than the 8px buttons it contains so
              // visual nesting reads cleanly. Was rounded-full,
              // which felt inconsistent with everything else in the
              // product.
              'pointer-events-auto flex items-center gap-2 rounded-[12px]',
              'border border-[var(--stroke-soft-200)] bg-[var(--white-0)]',
              'px-3 py-2',
              'shadow-[0_12px_32px_rgba(23,23,23,0.12),0_2px_8px_rgba(23,23,23,0.04)]',
            )}
          >
            {/* Count chip — radius 6px so it nests cleanly inside
                the 8px buttons next to it (smaller children, larger
                parents — same visual hierarchy logic everywhere else
                in the product). */}
            <span
              className={cn(
                'inline-flex h-6 items-center rounded-[6px]',
                'bg-[var(--primary-alpha-10)] px-2',
                'text-[11.5px] font-semibold text-[var(--primary-base)]',
              )}
            >
              {count.toLocaleString()} selected
            </span>

            <span
              className="h-5 w-px shrink-0 bg-[var(--stroke-soft-200)]"
              aria-hidden
            />

            {/* Caller-provided action buttons */}
            <div className="flex items-center gap-1.5">{actions}</div>

            <span
              className="h-5 w-px shrink-0 bg-[var(--stroke-soft-200)]"
              aria-hidden
            />

            {/* Clear-selection — tertiary affordance, ghost styling.
                Radius matches the count chip (6px) so the bar's
                inner elements share one rhythm. */}
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear selection"
              title="Clear selection"
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-[6px]',
                'text-[var(--neutral-soft-400)]',
                'transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
              )}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
