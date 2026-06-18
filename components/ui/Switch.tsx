'use client';

import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  /** Visual size — small (default) is 32×18; medium is 36×20. */
  size?: 'sm' | 'md';
  className?: string;
  /** Accessible label for screen readers. */
  ariaLabel?: string;
}

export function Switch({
  checked,
  onChange,
  disabled,
  size = 'sm',
  className,
  ariaLabel,
}: SwitchProps) {
  const dims =
    size === 'sm'
      ? { w: 32, h: 18, t: 14 }
      : { w: 36, h: 20, t: 16 };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full transition-colors duration-150',
        'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--primary-alpha-16)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'bg-[var(--primary-base)]'
          : 'bg-[var(--neutral-soft-200)]',
        className,
      )}
      style={{ width: dims.w, height: dims.h }}
    >
      <span
        aria-hidden
        className="absolute left-0.5 inline-block rounded-full bg-white shadow-[0_1px_2px_rgba(23,23,23,0.20)] transition-transform duration-150"
        style={{
          width: dims.t,
          height: dims.t,
          transform: `translateX(${checked ? dims.w - dims.t - 4 : 0}px)`,
        }}
      />
    </button>
  );
}
