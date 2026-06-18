'use client';

/**
 * ThemeToggle — production theme switcher.
 *
 * Two surfaces:
 *   <ThemeToggle variant="compact" />  — for the profile dropdown.
 *                                        Single row, icon + label + state pill.
 *   <ThemeToggle variant="card" />     — for the Settings page Appearance
 *                                        section. Two side-by-side cards
 *                                        with preview swatches.
 *
 * Reads/writes `localStorage.aegis_theme`. Flips
 * `document.documentElement.dataset.theme` synchronously so the change
 * is instant — no re-render flash. Source of truth = the DOM attribute,
 * with localStorage as the persistence layer. Both stay in sync.
 *
 * Scope reminder: the actual application of the theme is gated to
 * /dashboard by the FOUC-prevention script in app/layout.tsx and the
 * effect in app/dashboard/layout.tsx. Choosing dark while OUTSIDE the
 * dashboard would still persist to localStorage, but only take visible
 * effect once you're back inside the dashboard. In practice the toggle
 * is only rendered inside dashboard surfaces (profile menu, settings),
 * so this scoping is invisible to users.
 */

import { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(next: Theme) {
  if (next === 'dark') {
    document.documentElement.dataset.theme = 'dark';
    localStorage.setItem('aegis_theme', 'dark');
  } else {
    delete document.documentElement.dataset.theme;
    localStorage.removeItem('aegis_theme');
  }
}

// ─── Public hook (handy for any caller that wants raw read/write) ──────────
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    setThemeState(currentTheme());
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  return { theme, setTheme };
}

// ─── Component ─────────────────────────────────────────────────────────────

interface ThemeToggleProps {
  variant?: 'compact' | 'card';
  className?: string;
}

export default function ThemeToggle({
  variant = 'compact',
  className,
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'grid grid-cols-1 gap-3 sm:grid-cols-2',
          className,
        )}
        role="radiogroup"
        aria-label="Theme"
      >
        <ThemeCard
          theme="light"
          active={theme === 'light'}
          onSelect={() => setTheme('light')}
        />
        <ThemeCard
          theme="dark"
          active={theme === 'dark'}
          onSelect={() => setTheme('dark')}
        />
      </div>
    );
  }

  // Compact: a 2-button segmented pill, sized to fit inside the profile
  // dropdown row. Icon + label, active state filled.
  return (
    <div
      className={cn(
        'flex items-center gap-0.5 rounded-full border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-0.5',
        className,
      )}
      role="radiogroup"
      aria-label="Theme"
    >
      <CompactOption
        theme="light"
        active={theme === 'light'}
        onSelect={() => setTheme('light')}
      />
      <CompactOption
        theme="dark"
        active={theme === 'dark'}
        onSelect={() => setTheme('dark')}
      />
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function CompactOption({
  theme,
  active,
  onSelect,
}: {
  theme: Theme;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = theme === 'light' ? Sun : Moon;
  const label = theme === 'light' ? 'Light' : 'Dark';
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        'flex h-6 flex-1 items-center justify-center gap-1 rounded-full px-2.5 text-[11px] font-medium tracking-[-0.005em] transition-colors',
        active
          ? 'bg-[var(--white-0)] text-[var(--neutral-strong-950)] shadow-[0_1px_2px_rgba(23,23,23,0.08)]'
          : 'text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]',
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.2} />
      {label}
    </button>
  );
}

/**
 * Card option for the Settings page — preview swatch (gray for light,
 * near-black for dark) + label + active indicator. Tap the whole card
 * to switch.
 */
function ThemeCard({
  theme,
  active,
  onSelect,
}: {
  theme: Theme;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = theme === 'light' ? Sun : Moon;
  const label = theme === 'light' ? 'Light' : 'Dark';
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        'group flex flex-col gap-3 rounded-[12px] border bg-[var(--white-0)] p-3 text-left transition-all',
        active
          ? 'border-[var(--primary-base)] ring-2 ring-[var(--primary-alpha-16)]'
          : 'border-[var(--stroke-soft-200)] hover:border-[var(--stroke-sub-300)]',
      )}
    >
      {/* Preview swatch — mini "page" mockup so users see what they're picking */}
      <div
        className="relative aspect-[16/9] w-full overflow-hidden rounded-[8px] border border-[var(--stroke-soft-200)]"
        style={{
          backgroundColor: theme === 'light' ? '#f7f7f7' : '#08080a',
        }}
        aria-hidden
      >
        {/* Faux sidebar */}
        <div
          className="absolute left-0 top-0 h-full w-[28%] border-r"
          style={{
            backgroundColor: theme === 'light' ? '#ffffff' : '#0f0f11',
            borderColor: theme === 'light' ? '#ebebeb' : '#1d1d20',
          }}
        />
        {/* Faux topbar line */}
        <div
          className="absolute left-[28%] right-0 top-0 h-[12%] border-b"
          style={{
            backgroundColor: theme === 'light' ? '#ffffff' : '#0f0f11',
            borderColor: theme === 'light' ? '#ebebeb' : '#1d1d20',
          }}
        />
        {/* Faux card */}
        <div
          className="absolute left-[34%] top-[24%] h-[48%] w-[58%] rounded-[3px] border"
          style={{
            backgroundColor: theme === 'light' ? '#ffffff' : '#0f0f11',
            borderColor: theme === 'light' ? '#ebebeb' : '#1d1d20',
          }}
        />
        {/* Brand dot — same brand orange in both, but muted on dark */}
        <div
          className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full"
          style={{
            backgroundColor: theme === 'light' ? '#fa7319' : '#b85d1c',
          }}
        />
      </div>

      {/* Label row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--neutral-strong-950)]">
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
          {label}
        </div>
        {active && (
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--primary-base)]">
            Selected
          </span>
        )}
      </div>
    </button>
  );
}
