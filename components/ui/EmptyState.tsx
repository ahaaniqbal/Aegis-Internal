'use client';

import { ReactNode } from 'react';

/**
 * EmptyState — the canonical "no data yet" surface for the dashboard.
 *
 * Visual treatment is intentionally restrained: same concentric-sticker
 * pattern as `<IconMark>` (44x44 outer ring + 32x32 inner sticker carrying
 * a 16x16 line icon), scaled up to 56x56 for the empty-state context.
 *
 * Per the Refero design pass on dev-tool state surfaces (Linear, Vercel,
 * PlanetScale, Mercury, Cursor): strong dev-tool empty states never use
 * decorative illustrations, mascots, or branded gradients. The icon is
 * muted, the copy is direct and surface-specific, and the brand accent
 * is reserved for the primary CTA only.
 *
 *   icon         — pass a Lucide icon already styled by the caller, e.g.
 *                  `<Shield className="h-5 w-5" strokeWidth={2} />`. The
 *                  EmptyState wraps it in the sticker chrome and applies
 *                  the muted neutral color.
 *   title        — direct, surface-specific copy ("No runs yet", not
 *                  "Nothing here").
 *   description  — one-line explanation of what data will appear here.
 *   action       — optional <Button> or <Link>. Use brand orange ONLY when
 *                  this is the primary forward action.
 *   compact      — tighter padding for use inside panels.
 */

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  /** Reduces vertical padding for use inside smaller panels. */
  compact?: boolean;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 text-center ${
        compact ? 'py-10' : 'py-16'
      }`}
    >
      {/* IconMark-family sticker. Same concentric pattern as the row-level
          IconMark, scaled to 56x56 for empty-state weight. Muted neutral
          icon color so the brand accent stays reserved for the CTA below. */}
      <div
        aria-hidden
        className="relative mb-5 flex h-14 w-14 items-center justify-center"
      >
        {/* Outer hairline ring */}
        <div className="absolute h-14 w-14 rounded-full border border-[var(--stroke-soft-200)]" />
        {/* Inner white sticker */}
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--white-0)] shadow-[0_1px_2px_rgba(23,23,23,0.05)] ring-1 ring-[var(--stroke-soft-200)]">
          <span
            className="inline-flex items-center justify-center text-[var(--neutral-soft-400)]"
            style={{ width: 20, height: 20 }}
          >
            {icon}
          </span>
        </div>
      </div>

      <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
        {title}
      </h3>
      <p className="mt-1.5 max-w-[360px] text-[12.5px] leading-[1.55] text-[var(--neutral-sub-600)]">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
