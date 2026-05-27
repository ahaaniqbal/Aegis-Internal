'use client';

/**
 * HoverLift — the canonical hover micro-interaction used across
 * clickable cards in the dashboard.
 *
 * Wraps any child in a `motion.div` that animates `y: -2` on hover
 * and `y: -1` on tap. The easing curve `[0.32, 0.72, 0.32, 1]` is
 * an emphasized-decelerate spec; 260ms duration reads as confident
 * but not bouncy. The 2px lift matches the inline pattern that
 * Connectors + Support pages have shipped with for a while; using
 * the same value here means the refactor preserves the visual.
 *
 * Reasons for a wrapper component instead of inlining the props
 * everywhere:
 *   • Single source of truth for the curve, duration, and lift
 *     distance. Tweak once, the whole product updates together.
 *   • The motion.div sits OUTSIDE the click target (the Link or
 *     Button inside), so focus styling still lands on the actual
 *     focus target. Putting `whileHover` directly on the Link would
 *     animate the focus ring too, which reads as buggy.
 *   • Respects `prefers-reduced-motion` via `useReducedMotion` so
 *     the lift is suppressed for users who've opted out of motion.
 *
 * Pattern:
 *   <HoverLift>
 *     <Link href="/dashboard/runs" className="...">card body</Link>
 *   </HoverLift>
 *
 * The Link (not the wrapper) is the click target. The wrapper is
 * purely visual.
 *
 * `disabled` opts out of the lift without removing the wrapper —
 * useful for cards that are sometimes interactive and sometimes
 * informational (e.g. an active filter pill that shouldn't lift
 * when already selected).
 */

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/** Easing curve used by the canonical hover lift. Emphasized-decelerate
 *  spec — exported so callers that can't wrap (e.g. components that
 *  already use `<motion.X>` with variants for stagger) can spread the
 *  same values inline without forking the visual. */
export const HOVER_LIFT_EASE = [0.32, 0.72, 0.32, 1] as const;

/** Hover transform + transition, spreadable into any `motion.X`'s
 *  `whileHover` prop. Matches the wrapper component below. */
export const HOVER_LIFT_HOVER = {
  y: -2,
  transition: { duration: 0.26, ease: HOVER_LIFT_EASE },
} as const;

/** Tap transform + transition. Subtle dip-back from the hovered
 *  position so the click feels acknowledged. */
export const HOVER_LIFT_TAP = {
  y: -1,
  transition: { duration: 0.12, ease: HOVER_LIFT_EASE },
} as const;

interface HoverLiftProps {
  children: ReactNode;
  /** Suppress the hover lift. Useful when a card is in a "pressed"
   *  or "selected" state and shouldn't animate. */
  disabled?: boolean;
  /** Optional class names on the motion wrapper. Most callers won't
   *  need this — let the inner Link/Button handle layout. */
  className?: string;
}

export function HoverLift({
  children,
  disabled = false,
  className,
}: HoverLiftProps) {
  const reduce = useReducedMotion();
  const inert = disabled || reduce;

  return (
    <motion.div
      className={className}
      whileHover={inert ? undefined : HOVER_LIFT_HOVER}
      whileTap={inert ? undefined : HOVER_LIFT_TAP}
    >
      {children}
    </motion.div>
  );
}
