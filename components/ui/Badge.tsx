'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone =
  | 'neutral'
  | 'success'
  | 'error'
  | 'warning'
  | 'feature'
  | 'info'
  | 'primary';

// Tinted backgrounds use the saturated semantic color at ~16% so each hue
// reads clearly — the bare AlignUI `-lighter` tokens (94% L) look too
// similar to each other at small badge sizes. Text stays in the dark
// variant for legibility.
const tones: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--neutral-soft-200)] text-[var(--neutral-sub-600)]',
  success: 'bg-[rgba(31,193,107,0.16)]  text-[var(--success-dark)]',
  error:   'bg-[rgba(251,55,72,0.14)]   text-[var(--error-dark)]',
  warning: 'bg-[rgba(246,181,30,0.20)]  text-[var(--warning-dark)]',
  feature: 'bg-[rgba(125,82,244,0.14)]  text-[var(--feature-dark)]',
  info:    'bg-[rgba(51,92,255,0.12)]   text-[var(--info-dark)]',
  primary: 'bg-[rgba(250,115,25,0.14)]  text-[var(--primary-dark)]',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  uppercase?: boolean;
  leadingDot?: boolean;
  leadingIcon?: ReactNode;
}

const dotColor: Record<BadgeTone, string> = {
  neutral: 'var(--neutral-sub-600)',
  success: 'var(--success)',
  error:   'var(--error)',
  warning: 'var(--warning)',
  feature: 'var(--feature)',
  info:    'var(--information)',
  primary: 'var(--primary-base)',
};

export function Badge({
  className,
  tone = 'neutral',
  uppercase = false,
  leadingDot = false,
  leadingIcon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[19px] items-center gap-1 rounded-[6px] px-[7px] text-[10.5px] font-bold tracking-[0.04em] tabular-nums',
        uppercase ? 'uppercase' : '',
        tones[tone],
        className,
      )}
      {...props}
    >
      {leadingDot && (
        <span
          className="inline-block h-[6px] w-[6px] rounded-full"
          style={{ backgroundColor: dotColor[tone] }}
          aria-hidden
        />
      )}
      {leadingIcon}
      {children}
    </span>
  );
}
