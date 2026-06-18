'use client';

/**
 * UserAvatar — the canonical "this is the user" mark.
 *
 * Resolves in this priority order:
 *   1. Custom uploaded image (localStorage.aegis_custom_avatar)
 *   2. GenerativeAvatar with variant="user" seeded by the user
 *
 * Used everywhere a user's identity should appear (topbar, sidebar
 * workspace switcher when in their real workspace, Settings hero,
 * etc.). The demo workspace mark intentionally does NOT go through
 * this — it's `<GenerativeAvatar variant="demo" />` directly because
 * the demo identity isn't user-customizable.
 *
 * Sized + shaped to match GenerativeAvatar so consumers can swap
 * with no layout change. The hairline border is applied to both
 * branches so the avatar shape reads identically whether the user
 * has uploaded or not.
 */

import { useCustomAvatar } from '@/lib/customAvatar';
import { GenerativeAvatar } from '@/components/ui/GenerativeAvatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  /** Identity string for the GenerativeAvatar fallback. Typically the
   *  username — stable per-user, gives a deterministic color + pattern. */
  seed: string;
  /** Square size in px. Default 32 to match the workspace mark sizing. */
  size?: number;
  /** Border radius. Default 8 — matches the rest of the chrome. */
  radius?: number;
  /** Optional wrapper className. */
  className?: string;
}

export function UserAvatar({
  seed,
  size = 32,
  radius = 8,
  className,
}: UserAvatarProps) {
  const customUrl = useCustomAvatar();

  if (customUrl) {
    return (
      <div
        className={cn('shrink-0 overflow-hidden', className)}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundImage: `url(${customUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          // Hairline inset border — matches the GenerativeAvatar branch
          // exactly so the visual footprint stays identical when the
          // user toggles between custom + generative.
          boxShadow: 'inset 0 0 0 1px var(--stroke-soft-200)',
        }}
        role="img"
        aria-label="Profile picture"
      />
    );
  }

  return (
    <GenerativeAvatar
      seed={seed}
      variant="user"
      size={size}
      radius={radius}
      className={className}
    />
  );
}
