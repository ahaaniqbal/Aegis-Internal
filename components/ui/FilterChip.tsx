'use client';

/**
 * FilterChip — multi-select dropdown pill.
 *
 * Used in filter bars where the user picks zero or more values
 * from a known set (e.g. "Agent: claude-sonnet, gpt-4o", "Decision:
 * ALLOW, DENY"). Shows a chip with the label; when items are
 * selected, the chip displays a count badge + becomes brand-tinted
 * so the eye lands on active filters first.
 *
 * Pattern reference: Linear / Notion / Cycle's table filter bars
 * — same "label + count + dismissable" pill, brand-tinted when
 * active.
 *
 * Behavior:
 *   • Click the chip → opens a dropdown with checkboxes for each
 *     option, plus a "Clear" link at the bottom when any are
 *     selected.
 *   • Click outside / Escape → closes the dropdown.
 *   • Selections fire `onChange` immediately (no apply button).
 *   • Empty value array = "all" (no filter active).
 */

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterChipOption {
  /** Stable identifier sent back via `onChange`. */
  value: string;
  /** Human-facing label. Falls back to `value` when omitted. */
  label?: string;
  /** Optional small icon (Lucide / SVG). Renders before the label. */
  icon?: React.ReactNode;
}

interface FilterChipProps {
  /** Chip label, e.g. "Agent", "Decision". */
  label: string;
  /** All available options. */
  options: FilterChipOption[];
  /** Currently-selected values. Empty array = no filter. */
  value: string[];
  /** Fires with the new value array on every selection toggle. */
  onChange: (next: string[]) => void;
  className?: string;
}

export function FilterChip({
  label,
  options,
  value,
  onChange,
  className,
}: FilterChipProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const active = value.length > 0;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (val: string) => {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  return (
    <div ref={wrapperRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          // Same h-7 / px-2.5 / rounded-[8px] rhythm as the other
          // filter-bar controls (DateRangePicker, refresh button).
          'inline-flex h-7 items-center gap-1.5 rounded-[8px]',
          'border bg-white px-2.5',
          'text-[12px] font-medium',
          'transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
          'shadow-[var(--shadow-regular-xs)]',
          // Active filters get brand-orange treatment so the eye lands
          // on them first when scanning the filter bar.
          active
            ? 'border-[var(--primary-base)]/40 bg-[var(--primary-alpha-10)] text-[var(--primary-base)]'
            : 'border-[var(--stroke-sub-300)] text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
        )}
      >
        <span>{label}</span>
        {active && (
          <span
            className={cn(
              'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full',
              'bg-[var(--primary-base)] px-1 text-[10px] font-bold text-white',
            )}
          >
            {value.length}
          </span>
        )}
        <ChevronDown
          className={cn(
            'h-3 w-3 transition-transform',
            open && 'rotate-180',
            active ? 'text-[var(--primary-base)]' : 'text-[var(--neutral-soft-400)]',
          )}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute left-0 top-full z-30 mt-1.5 min-w-[200px] max-w-[280px] overflow-hidden',
            'rounded-[12px] border border-[var(--stroke-soft-200)] bg-white',
            'shadow-[0_12px_32px_rgba(23,23,23,0.10),0_2px_8px_rgba(23,23,23,0.04)]',
          )}
        >
          <div className="max-h-[280px] overflow-y-auto p-1.5">
            {options.length === 0 ? (
              <div className="px-3 py-2.5 text-[12px] text-[var(--neutral-soft-400)]">
                No options available.
              </div>
            ) : (
              options.map((opt) => {
                const checked = value.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={checked}
                    onClick={() => toggle(opt.value)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left',
                      'text-[12.5px] font-medium text-[var(--neutral-sub-600)]',
                      'transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
                      checked && 'text-[var(--neutral-strong-950)]',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border',
                        checked
                          ? 'border-[var(--primary-base)] bg-[var(--primary-base)] text-white'
                          : 'border-[var(--stroke-sub-300)] bg-white',
                      )}
                      aria-hidden
                    >
                      {checked && (
                        <Check className="h-3 w-3" strokeWidth={2.5} />
                      )}
                    </span>
                    {opt.icon}
                    <span className="flex-1 truncate">
                      {opt.label ?? opt.value}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {active && (
            <>
              <div className="border-t border-[var(--stroke-soft-200)]" />
              <button
                type="button"
                onClick={() => onChange([])}
                className={cn(
                  'flex w-full items-center justify-center gap-1.5 px-3 py-2',
                  'text-[11.5px] font-medium text-[var(--neutral-sub-600)]',
                  'transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--error)]',
                )}
              >
                <X className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                Clear {label.toLowerCase()}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
