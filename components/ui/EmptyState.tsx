'use client';

import { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  /** Reduces vertical padding for use inside smaller panels. */
  compact?: boolean;
}

/**
 * Empty state — soft concentric circles around the icon for visual depth.
 * Inspired by the Cursor/Linear pattern of an illustrative icon backdrop
 * instead of a flat boxed glyph.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 text-center ${
        compact ? 'py-10' : 'py-16'
      }`}
    >
      {/* Concentric circles backdrop */}
      <div className="relative mb-5 flex items-center justify-center" aria-hidden>
        <div
          className="absolute h-[88px] w-[88px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(250,115,25,0.08) 0%, rgba(250,115,25,0) 65%)',
          }}
        />
        <div className="absolute h-[64px] w-[64px] rounded-full border border-[var(--stroke-soft-200)]" />
        <div className="absolute h-[48px] w-[48px] rounded-full border border-[var(--stroke-soft-200)]" />
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_1px_2px_rgba(23,23,23,0.06)] ring-1 ring-[var(--stroke-soft-200)]">
          <span
            className="inline-flex h-4 w-4 items-center justify-center text-[var(--primary-base)]"
          >
            {icon}
          </span>
        </div>
      </div>

      <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
        {title}
      </h3>
      <p className="mt-1.5 max-w-[360px] text-[12.5px] leading-[1.55] text-[var(--neutral-sub-600)]">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
