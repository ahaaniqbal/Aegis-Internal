'use client';

/**
 * IconMark — the canonical icon container used across the dashboard.
 *
 * Visually: a concentric double-ring sticker.
 *   ┌─────────────────┐
 *   │   outer ring    │   44×44, hairline border
 *   │  ┌───────────┐  │
 *   │  │   inner   │  │   32×32 white sticker, ring + soft shadow
 *   │  │   icon    │  │   16×16 tone-coloured Lucide icon, stroke 2
 *   │  └───────────┘  │
 *   └─────────────────┘
 *
 * The pattern was extracted from the Policies-row icon (which the
 * user explicitly preferred) so every "this row carries an identity
 * or signal" mark across the product reads as one icon family.
 *
 * Tone is expressed through the inner icon colour, not by tinting
 * the sticker bg. That keeps the chrome calm and lets the icon hue
 * do the semantic work (warning, success, error, primary, feature).
 */

import type { LucideIcon } from 'lucide-react';

interface IconMarkProps {
  icon: LucideIcon;
  /** CSS color value applied to the inner Lucide icon. Defaults to
   *  the brand orange so a plain `<IconMark icon={Shield} />` reads
   *  as "an Aegis-anchored object" out of the box. */
  color?: string;
  /** Lucide stroke width. Defaults to 2 — matches the Policies-row
   *  template. Bump to 2.25 for icons that need more presence at
   *  the 16px size (e.g. Shield, ShieldCheck). */
  strokeWidth?: number;
  className?: string;
}

export function IconMark({
  icon: Icon,
  color = 'var(--primary-base)',
  strokeWidth = 2,
  className,
}: IconMarkProps) {
  return (
    <div
      aria-hidden
      className={[
        'relative flex h-11 w-11 shrink-0 items-center justify-center',
        className ?? '',
      ].join(' ')}
    >
      {/* Outer concentric ring — 44×44 hairline border, no fill.
          Sits behind the inner sticker so the two rings read as
          one composed object. */}
      <div className="absolute h-11 w-11 rounded-full border border-[var(--stroke-soft-200)]" />
      {/* Inner sticker — 32×32 white, ring + soft drop-shadow.
          Carries the icon. */}
      <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-[0_1px_2px_rgba(23,23,23,0.05)] ring-1 ring-[var(--stroke-soft-200)]">
        <Icon
          className="h-4 w-4"
          style={{ color }}
          strokeWidth={strokeWidth}
        />
      </div>
    </div>
  );
}
