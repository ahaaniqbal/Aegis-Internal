'use client';

/**
 * CommandPaletteTrigger — search-bar-shaped button in the topbar.
 *
 * Without this, ⌘K is keyboard-only and effectively invisible to new
 * users. With it, the palette becomes a visual feature: people see
 * a search bar, click it, and the inline `⌘K` kbd hint teaches the
 * shortcut for next time.
 *
 * Visual contract — MATCH adjacent topbar elements EXACTLY so the
 * whole right cluster reads as one consistent design system:
 *   • Height: h-7 (28px) — same as DateRangePicker, refresh button
 *   • Border: --stroke-sub-300 — same medium-gray hairline
 *   • Radius: rounded-[8px] (matches `rounded-lg`)
 *   • Shadow: --shadow-regular-xs — subtle 1px depth
 *   • Text: 12px font-medium, --neutral-sub-600 (muted hover-up)
 *   • Internal padding: asymmetric pl-2 pr-1.5 — gives the icon
 *     comfortable left breathing room and lets the kbd sit ~6px
 *     from the right edge, matching the ~5px above/below the kbd
 *     inside the h-7 row. Symmetric whitespace around content.
 *   • Gap: 1.5 (6px) — same as DateRangePicker icon↔text gap
 *
 * Opening mechanism: dispatches a custom `aegis-open-command-palette`
 * event. The CommandPalette listens for it (in addition to the ⌘K
 * keystroke) and toggles open state. Decoupled from React state.
 *
 * Responsive:
 *   • Desktop (sm+): 240px wide search bar with placeholder + kbd
 *   • Mobile  (<sm): 28px icon-only square (kbd hint hides; the
 *                    keyboard shortcut isn't relevant on touch)
 */

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandPaletteTriggerProps {
  className?: string;
}

export function CommandPaletteTrigger({ className }: CommandPaletteTriggerProps) {
  // Platform-correct kbd label. Avoids showing `⌘` to a Windows user
  // who'd then wonder which key that maps to.
  const [kbdLabel, setKbdLabel] = useState<string>('⌘K');
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
    setKbdLabel(isMac ? '⌘K' : 'Ctrl K');
  }, []);

  const openPalette = () => {
    window.dispatchEvent(new Event('aegis-open-command-palette'));
  };

  return (
    <button
      type="button"
      onClick={openPalette}
      title="Search and quick actions"
      aria-label="Open command palette"
      className={cn(
        // Matches the DateRangePicker + refresh button rhythm exactly
        // (h-7 / stroke-sub-300 / rounded-[8px] / shadow-regular-xs)
        // so all three sit as one consistent topbar element family.
        'group inline-flex h-7 items-center gap-1.5 rounded-[8px]',
        'border border-[var(--stroke-sub-300)] bg-white',
        // Asymmetric horizontal padding: 2 on the left (so the icon
        // sits ~8px from the edge ≈ the 7px above/below the h-3.5
        // icon), 1.5 on the right (so the kbd's right edge sits
        // ~6px from the button's right edge ≈ the 5px above/below
        // the h-[18px] kbd). Visually equal whitespace on all 4
        // sides of every inner element.
        'pl-2 pr-1.5',
        'text-[12px] font-medium text-[var(--neutral-sub-600)]',
        // Same subtle depth as the rest of the topbar surface family.
        'shadow-[var(--shadow-regular-xs)]',
        'transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        'hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
        // Mobile: 28px icon-only square. Desktop: 240px search bar.
        'w-7 justify-center sm:w-[240px] sm:justify-start',
        className,
      )}
    >
      <Search
        className="h-3.5 w-3.5 shrink-0 text-[var(--neutral-soft-400)]"
        strokeWidth={2}
        aria-hidden
      />
      {/* Placeholder — 12px to match DateRangePicker text size.
          --neutral-soft-400 (muted) reads as a search hint, not
          actual content. */}
      <span className="hidden flex-1 truncate text-left text-[12px] tracking-[-0.005em] text-[var(--neutral-soft-400)] sm:inline">
        Search Aegis…
      </span>
      {/* Keycap — uses --kbd-bg + --kbd-shadow tokens (theme-aware)
          so it visually matches the kbds inside the command palette
          footer + sidebar shortcut hints. */}
      <kbd
        className={cn(
          'hidden h-[18px] items-center justify-center rounded-[5px]',
          'border border-[var(--stroke-soft-200)] bg-[var(--kbd-bg)]',
          'px-1.5 font-mono text-[10px] text-[var(--neutral-soft-400)]',
          'shadow-[var(--kbd-shadow)]',
          'sm:inline-flex',
        )}
        aria-hidden
      >
        {kbdLabel}
      </kbd>
    </button>
  );
}
