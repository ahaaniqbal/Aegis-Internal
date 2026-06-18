'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'allow' | 'deny' | 'rewrite' | 'approval';

const variantColor: Record<Variant, string | undefined> = {
  default:  undefined,
  allow:    'var(--success)',
  deny:     'var(--error)',
  rewrite:  'var(--feature)',
  approval: 'var(--primary-base)',
};

interface MetricCardProps {
  label: string;
  value: number | string;
  variant?: Variant;
  /** Optional meta line under the value (e.g. trend or supplemental). */
  meta?: ReactNode;
  className?: string;
}

/**
 * Premium metric card — white surface, subtle shadow, big number.
 * Decision color is encoded as a 6px dot next to the label, NOT a side stripe
 * (the side-stripe pattern reads as AI-default; see Refero anti-slop guide).
 */
export default function MetricCard({
  label,
  value,
  variant = 'default',
  meta,
  className,
}: MetricCardProps) {
  const dot = variantColor[variant];
  return (
    <div
      data-card-hover
      className={cn(
        'group rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-5',
        'shadow-[0_1px_2px_rgba(23,23,23,0.04)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.06)] hover:-translate-y-px',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {dot && (
          <span
            className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ backgroundColor: dot }}
            aria-hidden
          />
        )}
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
          {label}
        </p>
      </div>
      <p className="mt-3 text-[30px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--neutral-strong-950)]">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {meta && (
        <p className="mt-2 text-[11.5px] text-[var(--neutral-soft-400)]">{meta}</p>
      )}
    </div>
  );
}
