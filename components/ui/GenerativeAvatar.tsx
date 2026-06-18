'use client';

/**
 * GenerativeAvatar — Bayer ordered-dither identity mark.
 *
 * Per Ahaan's reference SVG, the visual recipe is:
 *   1. Solid dark background fill (the "shadow" color)
 *   2. A 1px-stroke pixel grid path (the "highlight" color) drawn
 *      with `shape-rendering="crispEdges"` so every pixel reads as
 *      a crisp 8-bit dither dot — no anti-aliasing fuzz.
 *   3. Which pixels are ON is decided by Bayer ordered dithering
 *      against a seed-driven gradient: cells are ON when the
 *      gradient intensity at that cell exceeds the Bayer threshold
 *      for that position.
 *
 * Result: a generative two-tone dither gradient that feels retro /
 * agentic / pixel-native — exactly the reference vibe. Every user
 * gets a unique pattern (their seed picks the gradient direction)
 * and a unique color pair (their seed picks from a curated palette
 * of dark+light tone pairs).
 *
 * Demo workspace is locked to the brand-orange pair so it stays
 * recognisable across all users.
 *
 * Why Bayer ordered dithering specifically:
 *   • The 8×8 Bayer matrix gives 64 distinct threshold steps —
 *     plenty of gradient resolution at small sizes.
 *   • Bayer is deterministic (same coords → same threshold) so the
 *     pattern is stable across re-renders and theme switches.
 *   • The "checkerboard at the gradient midpoint" property gives
 *     the classic crosshatch look that the reference shows.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

/** djb2-style hash — small, deterministic, well-distributed. */
function hashSeed(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Seeded RNG (mulberry32). Same algorithm as the rest of the codebase
 *  so generated avatars stay stable across page reloads. */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Classic 8×8 Bayer threshold matrix.
 * Values are 0..63. To use, divide by 64 to get a normalized [0,1)
 * threshold and compare against the gradient intensity at each cell.
 * Repeats by `coord % 8` to tile the pattern across any grid size.
 */
const BAYER_8x8: ReadonlyArray<ReadonlyArray<number>> = [
  [ 0, 32,  8, 40,  2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44,  4, 36, 14, 46,  6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [ 3, 35, 11, 43,  1, 33,  9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47,  7, 39, 13, 45,  5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

/**
 * Curated USER color pairs. Each pair is `{ bg, fg }` with bg as the
 * dark/saturated background and fg as the light same-hue stroke.
 * Picked to match the reference's "dark base + light pixel highlight"
 * vibe — every pair has substantial lightness contrast so the dither
 * pattern reads clearly even at 28px.
 */
const USER_PALETTE_PAIRS = [
  { bg: '#1E40AF', fg: '#93C5FD' }, // cobalt
  { bg: '#5B21B6', fg: '#C4B5FD' }, // violet
  { bg: '#0F766E', fg: '#5EEAD4' }, // teal
  { bg: '#9F1239', fg: '#FDA4AF' }, // rose
  { bg: '#0E7490', fg: '#67E8F9' }, // cyan
  { bg: '#047857', fg: '#6EE7B7' }, // emerald
  { bg: '#4338CA', fg: '#A5B4FC' }, // indigo
  { bg: '#831843', fg: '#F9A8D4' }, // magenta (a la the reference!)
] as const;

/** DEMO workspace pair — locked to a brand-orange family so the
 *  demo identity is instantly recognisable across all users. */
const DEMO_PAIR = { bg: '#9A3412', fg: '#FDBA74' };

/** Build the dither path string for a given seed + grid.
 *  Walks the grid row-by-row, emits `M<x> <y>h<run>` chunks for each
 *  run of consecutive "on" cells — mirrors the reference SVG's path
 *  structure exactly, which keeps the output compact + crisp. */
function buildDitherPath(seed: string, gridSize: number): string {
  const hash = hashSeed(seed);
  const rng = mulberry32(hash);

  // Per-user gradient direction. Pick an angle from the seed so each
  // user has a uniquely-angled light-source for their dither pattern.
  const angle = rng() * Math.PI * 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  // Per-user gradient bias — shifts the midpoint of the dither so
  // some users look mostly-dark, others mostly-light, most balanced.
  // Range [0.35, 0.55] keeps every avatar legible (no all-on or
  // all-off pathologies).
  const bias = 0.35 + rng() * 0.2;

  const parts: string[] = [];

  for (let y = 0; y < gridSize; y++) {
    let runStart = -1;
    for (let x = 0; x < gridSize; x++) {
      // Position normalized to [-0.5, 0.5] then projected onto the
      // chosen gradient direction.
      const nx = x / (gridSize - 1) - 0.5;
      const ny = y / (gridSize - 1) - 0.5;
      // Max projection magnitude is sqrt(0.5) ≈ 0.707, so map to
      // [0, 1] via (proj + 0.707) / 1.414. We clamp around the
      // seeded bias for variety without ever going fully solid.
      const proj = nx * dx + ny * dy;
      let intensity = (proj + 0.707) / 1.414;
      intensity = Math.max(0.12, Math.min(0.88, intensity + (bias - 0.5)));

      const threshold = (BAYER_8x8[y % 8][x % 8] + 0.5) / 64;
      const on = intensity > threshold;

      if (on) {
        if (runStart === -1) runStart = x;
      } else if (runStart !== -1) {
        parts.push(`M${runStart} ${y}h${x - runStart}`);
        runStart = -1;
      }
    }
    if (runStart !== -1) {
      parts.push(`M${runStart} ${y}h${gridSize - runStart}`);
    }
  }

  return parts.join('');
}

interface GenerativeAvatarProps {
  /** Identity string used as the deterministic seed (username, email,
   *  etc.). Same seed → same pattern + same colors. */
  seed: string;
  /** `demo` → locked brand-orange pair. `user` → palette-picked pair. */
  variant?: 'demo' | 'user';
  /** Square size in px. Default 32. */
  size?: number;
  /** Border radius. Default 8 — matches the rest of the chrome. */
  radius?: number;
  /** Optional wrapper className. */
  className?: string;
}

export function GenerativeAvatar({
  seed,
  variant = 'user',
  size = 32,
  radius = 8,
  className,
}: GenerativeAvatarProps) {
  const { bg, fg, path, gridSize } = useMemo(() => {
    const hash = hashSeed(seed);
    const pair =
      variant === 'demo'
        ? DEMO_PAIR
        : USER_PALETTE_PAIRS[hash % USER_PALETTE_PAIRS.length];

    // Grid resolution scales with display size — every CSS pixel
    // gets one dither cell. At 32px display that's 32 cells across,
    // which gives the Bayer 8×8 matrix room to repeat ~4 times in
    // each direction (enough variation to feel dithered, dense
    // enough to read as a gradient).
    const grid = Math.max(16, size);
    const pathStr = buildDitherPath(seed, grid);
    return { bg: pair.bg, fg: pair.fg, path: pathStr, gridSize: grid };
  }, [seed, size, variant]);

  return (
    <div
      className={cn('shrink-0 overflow-hidden', className)}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        // Hairline inset border defines the square shape without
        // adding layout-affecting border-box width.
        boxShadow: 'inset 0 0 0 1px var(--stroke-soft-200)',
      }}
      aria-hidden
    >
      <svg
        viewBox={`0 0 ${gridSize} ${gridSize}`}
        width={size}
        height={size}
        // `crispEdges` is the magic: turns off anti-aliasing on the
        // stroke so every dither cell stays a clean square pixel,
        // matching the 8-bit feel of the reference.
        shapeRendering="crispEdges"
        style={{ display: 'block' }}
      >
        <rect width={gridSize} height={gridSize} fill={bg} />
        {/* translate(0,0.5) shifts the 1-unit stroke down half a unit
            so its painted band aligns to integer pixel rows — without
            this offset, a stroke at y=5 would paint y∈[4.5, 5.5] and
            straddle two rows, blurring the dither. */}
        <path
          fill="none"
          stroke={fg}
          transform="translate(0,0.5)"
          d={path}
        />
      </svg>
    </div>
  );
}
