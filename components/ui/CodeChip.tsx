'use client';

import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CodeChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** Stretches the chip to fit on its own row in a metadata grid. */
  block?: boolean;
}

/**
 * Small Geist Mono code chip with a 1px border on the muted surface.
 * Used for tool names, branches, repos, session IDs, etc.
 */
export function CodeChip({ className, block, children, ...props }: CodeChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[4px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--neutral-sub-600)]',
        '[font-family:var(--font-geist-mono),ui-monospace,monospace]',
        block ? 'w-full' : '',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
