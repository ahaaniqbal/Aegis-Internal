'use client';

/**
 * Skeleton primitive — Aegis loading-state system.
 *
 * Pattern (researched from Mercury, Nextdoor, Threads — see refero-design
 * session for full Steal List):
 *   - Base fill: var(--neutral-weak-50)  (#f5f7fa)
 *   - Shimmer overlay: a moving linear-gradient that sweeps L→R every 1.6s,
 *     peaking at var(--stroke-soft-200) (#e1e4ea) in the middle.
 *   - The pair gives a "premium" feel without crossing into anxiety —
 *     long-enough cycle that the loop reads as calm.
 *
 * Respects prefers-reduced-motion: when set, the shimmer is skipped and
 * the placeholder is a flat #f5f7fa rectangle (still distinguishable
 * from content, still readable as "loading").
 *
 * Composition philosophy: skeletons should mirror the EXACT geometry of
 * the loaded layout — same row heights, same column widths, same card
 * proportions. The eye should never register a "loading screen" — only
 * a layout that fills in.
 *
 *   <Skeleton className="h-4 w-32" />        // plain block
 *   <Skeleton variant="circle" className="h-9 w-9" />  // avatar / icon
 *
 * Composed primitives in this file:
 *   - SkeletonText     — single line of text (with optional `width` variant)
 *   - SkeletonAvatar   — circular avatar
 *   - SkeletonBadge    — small pill
 *   - SkeletonButton   — button-shaped block
 *   - SkeletonStatCell — eyebrow label + big number
 *   - SkeletonRow      — utility row used by tables / list items
 *
 * One global keyframe (aegis-skeleton-shimmer) lives in globals.css.
 */

import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** `block` (default) = rounded rectangle. `circle` = perfect round. */
  variant?: 'block' | 'circle';
}

export function Skeleton({
  className,
  variant = 'block',
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        // Base fill + shimmer in one element. The shimmer is a
        // background-image gradient that animates via background-position;
        // the base fill is the solid-color fallback underneath.
        'relative isolate overflow-hidden',
        // Solid base fill — visible when motion is reduced or the shimmer
        // is mid-cycle past the element edge.
        'bg-[var(--neutral-weak-50)]',
        // Shimmer: animated moving gradient. Defined as a pseudo-element
        // so we can run a transform animation without re-layout.
        'after:absolute after:inset-0 after:[background-image:linear-gradient(90deg,transparent_0%,var(--stroke-soft-200)_50%,transparent_100%)]',
        'after:translate-x-[-100%] after:animate-[aegis-skeleton-shimmer_1.6s_linear_infinite]',
        // Honor reduced-motion: kill the animation so it's a static fill.
        'motion-reduce:after:hidden',
        variant === 'circle' ? 'rounded-full' : 'rounded-[6px]',
        className,
      )}
      {...props}
    />
  );
}

// ─── Composed shape helpers ─────────────────────────────────────────────────
// Thin wrappers around <Skeleton> with semantic defaults. Most callers use
// these instead of touching <Skeleton> directly — keeps page-level
// skeletons easy to scan and consistent in proportion.

/** Single line of placeholder text. */
export function SkeletonText({
  width = 'full',
  className,
}: {
  /** Percentage-of-parent width. Sane defaults for title/body/caption rhythms. */
  width?: 'full' | '5/6' | '4/6' | '3/6' | '2/6' | '1/6';
  className?: string;
}) {
  const widths: Record<string, string> = {
    full: 'w-full',
    '5/6': 'w-5/6',
    '4/6': 'w-4/6',
    '3/6': 'w-3/6',
    '2/6': 'w-2/6',
    '1/6': 'w-1/6',
  };
  return <Skeleton className={cn('h-[13px]', widths[width], className)} />;
}

/** Circular avatar / icon placeholder. */
export function SkeletonAvatar({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Skeleton
      variant="circle"
      className={cn('shrink-0', className)}
      style={{ height: size, width: size }}
    />
  );
}

/** Pill / badge placeholder (e.g. status chips). */
export function SkeletonBadge({ className }: { className?: string }) {
  return <Skeleton className={cn('h-[19px] w-14 rounded-[6px]', className)} />;
}

/** Button-shaped block (h-9 by default to match AlignUI medium button). */
export function SkeletonButton({
  className,
  width = 80,
}: {
  className?: string;
  width?: number;
}) {
  return (
    <Skeleton
      className={cn('h-9 rounded-[8px]', className)}
      style={{ width }}
    />
  );
}

/** Stat-cell skeleton: small label + big tabular number, matches
 *  the rhythm of <StatCell> in the dashboard hero / stat strips. */
export function SkeletonStatCell({ className }: { className?: string }) {
  return (
    <div className={cn('px-6 py-4', className)}>
      {/* eyebrow */}
      <SkeletonText width="3/6" className="h-[11px]" />
      {/* big number */}
      <Skeleton className="mt-2 h-[28px] w-20 rounded-[6px]" />
    </div>
  );
}

/** Generic table row — used by Runs/Audit/Sessions skeletons. */
export function SkeletonTableRow({
  cells,
}: {
  /** Array of `flex-N` widths or px widths describing each cell's bar. */
  cells: Array<{ width: string; height?: string }>;
}) {
  return (
    <div className="flex items-center gap-3 px-[18px] py-[12px]">
      {cells.map((c, i) => (
        <div key={i} className={c.width}>
          <Skeleton className={cn('h-[13px]', c.height)} />
        </div>
      ))}
    </div>
  );
}
