'use client';

import { cn } from '@/lib/utils';

interface DecisionBarProps {
  allow: number;
  deny: number;
  rewrite: number;
  approval: number;
  className?: string;
}

const SEGMENTS: Array<{
  key: 'allow' | 'deny' | 'rewrite' | 'approval';
  label: string;
  color: string;
}> = [
  { key: 'allow',    label: 'Allow',    color: 'var(--success)' },
  { key: 'rewrite',  label: 'Rewrite',  color: 'var(--feature)' },
  { key: 'approval', label: 'Approval', color: 'var(--warning)' },
  { key: 'deny',     label: 'Deny',     color: 'var(--error)' },
];

/**
 * Horizontal proportional bar showing the breakdown of decisions.
 * Height 6px, 3px radius, 2px gap between segments, legend below.
 */
export function DecisionBar({
  allow,
  deny,
  rewrite,
  approval,
  className,
}: DecisionBarProps) {
  const counts: Record<'allow' | 'deny' | 'rewrite' | 'approval', number> = {
    allow,
    deny,
    rewrite,
    approval,
  };
  const total = allow + deny + rewrite + approval;
  const safeTotal = total === 0 ? 1 : total;

  return (
    <div className={cn('', className)}>
      <div className="flex h-[6px] w-full items-stretch gap-[2px] overflow-hidden">
        {SEGMENTS.map((seg) => {
          const value = counts[seg.key];
          if (total === 0) return null;
          const pct = (value / safeTotal) * 100;
          if (pct === 0) return null;
          return (
            <span
              key={seg.key}
              className="block rounded-[3px]"
              style={{ width: `${pct}%`, backgroundColor: seg.color }}
              title={`${seg.label}: ${value}`}
            />
          );
        })}
        {total === 0 && (
          <span
            className="block flex-1 rounded-[3px]"
            style={{ backgroundColor: 'var(--neutral-soft-200)' }}
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {SEGMENTS.map((seg) => {
          const value = counts[seg.key];
          const pct = total === 0 ? 0 : Math.round((value / safeTotal) * 100);
          return (
            <div key={seg.key} className="flex items-center gap-2">
              <span
                className="h-[6px] w-[6px] rounded-full"
                style={{ backgroundColor: seg.color }}
                aria-hidden
              />
              <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                {seg.label}
              </span>
              <span className="text-[12.5px] font-semibold tabular-nums text-[var(--neutral-strong-950)]">
                {value.toLocaleString()}
              </span>
              <span className="text-[11px] text-[var(--neutral-soft-400)] tabular-nums">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
