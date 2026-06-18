/**
 * Motion presets — keep timings and easings consistent across pages.
 * Sourced from Refero's motion guide: every value here serves
 * feedback / continuity / hierarchy and respects `prefers-reduced-motion`
 * via callers using `useReducedMotion()` from `motion/react`.
 */

import type { Variants } from 'motion/react';

// ── Durations (seconds) ──────────────────────────────────────────────────────
export const DUR = {
  fast: 0.12,
  default: 0.20,
  slow: 0.32,
  bar: 0.6, // one-shot bar fills only
} as const;

// ── Easings (cubic-bezier arrays for Motion) ─────────────────────────────────
export const EASE = {
  out: [0, 0, 0.2, 1] as const,
  in: [0.4, 0, 1, 1] as const,
  inOut: [0.4, 0, 0.2, 1] as const,
  // "Emphasized" — slightly more alive, good for hero entries
  emph: [0.2, 0, 0, 1] as const,
} as const;

// ── Springs (for buttons / tactile elements) ─────────────────────────────────
export const SPRING = {
  snappy: { type: 'spring', stiffness: 400, damping: 30 } as const,
  smooth: { type: 'spring', stiffness: 200, damping: 22 } as const,
};

// ── Variants — drop-in for motion components ─────────────────────────────────

/** Subtle fade + 8px rise. Default entry for blocks. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.default, ease: EASE.out },
  },
};

/** Smaller 4px rise — for list rows that shouldn't dance. */
export const fadeUpSm: Variants = {
  hidden: { opacity: 0, y: 4 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.default, ease: EASE.out },
  },
};

/** Plain fade — for reduced-motion-friendly contexts. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.default, ease: EASE.out } },
};

/** Container that staggers children. */
export function staggerContainer(staggerSeconds = 0.04, delaySeconds = 0): Variants {
  return {
    hidden: {},
    show: {
      transition: {
        staggerChildren: staggerSeconds,
        delayChildren: delaySeconds,
      },
    },
  };
}
