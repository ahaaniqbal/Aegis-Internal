'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Date range picker — modeled on Vercel Geist Calendar + Fingerprint's
 * range filter (Refero #56ff8cc2). Two months on the left, quick presets
 * on the right rail, range readout + Apply at the footer. Light surface,
 * brand-orange selection, AlignUI tokens throughout.
 */

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'last90'
  | 'mtd'
  | 'ytd';

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'today',     label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7',     label: 'Last 7 days' },
  { id: 'last30',    label: 'Last 30 days' },
  { id: 'last90',    label: 'Last 90 days' },
  { id: 'mtd',       label: 'Month to date' },
  { id: 'ytd',       label: 'Year to date' },
];

function applyPreset(p: DatePreset): DateRange {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  switch (p) {
    case 'today':     return { from: today, to: today };
    case 'yesterday': start.setDate(start.getDate() - 1); return { from: start, to: start };
    case 'last7':     start.setDate(start.getDate() - 6);  return { from: start, to: today };
    case 'last30':    start.setDate(start.getDate() - 29); return { from: start, to: today };
    case 'last90':    start.setDate(start.getDate() - 89); return { from: start, to: today };
    case 'mtd':       return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today };
    case 'ytd':       return { from: new Date(today.getFullYear(), 0, 1), to: today };
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function rangeLabel(range: DateRange | undefined, presetLabel?: string): string {
  if (presetLabel) return presetLabel;
  if (!range?.from) return 'Pick a range';
  if (!range.to || range.to.getTime() === range.from.getTime()) {
    return formatDate(range.from);
  }
  return `${formatDate(range.from)} → ${formatDate(range.to)}`;
}

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  defaultPreset?: DatePreset;
  size?: 'sm' | 'md';
  className?: string;
}

// Emphasized-decel easing — Material spec / Fingerprint pattern.
// Slightly more deceleration at the tail than plain ease-out;
// feels "alive" without bouncing.
const EASE_EMPH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

export function DateRangePicker({
  value,
  onChange,
  defaultPreset,
  size = 'sm',
  className,
}: DateRangePickerProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(value);
  const [activePreset, setActivePreset] = useState<DatePreset | null>(
    defaultPreset ?? null,
  );
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const sizeClass =
    size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]';

  const presetLabel = activePreset
    ? PRESETS.find((p) => p.id === activePreset)?.label
    : undefined;

  const handlePreset = (p: DatePreset) => {
    const r = applyPreset(p);
    setDraft(r);
    setActivePreset(p);
  };

  const handleApply = () => {
    onChange(draft);
    setOpen(false);
  };

  const handleClear = () => {
    setDraft(undefined);
    setActivePreset(null);
  };

  return (
    <div className={`relative inline-block ${className ?? ''}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setDraft(value);
          setOpen((o) => !o);
        }}
        className={[
          'inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--stroke-sub-300)] bg-white font-medium text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
          sizeClass,
        ].join(' ')}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="truncate">{rangeLabel(value, presetLabel)}</span>
        <ChevronDown className="h-3 w-3" strokeWidth={2} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={popoverRef}
            role="dialog"
            aria-label="Pick a date range"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: EASE_EMPH }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 z-40 mt-2 w-fit overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_12px_32px_rgba(23,23,23,0.10),0_2px_8px_rgba(23,23,23,0.04)]"
          >
            <div className="flex">
              {/* Month — primary panel */}
              <div className="p-3">
                <DayPicker
                  mode="range"
                  numberOfMonths={1}
                  pagedNavigation
                  selected={draft}
                  onSelect={(r) => {
                    setDraft(r);
                    setActivePreset(null);
                  }}
                  showOutsideDays
                  className="aegis-daypicker"
                  components={{
                    Chevron: ({ orientation }) => {
                      const Icon =
                        orientation === 'left' ? ChevronLeft : ChevronRight;
                      return <Icon className="h-3.5 w-3.5" strokeWidth={2} />;
                    },
                  }}
                />
              </div>

              {/* Presets — right rail */}
              <div className="w-[164px] shrink-0 border-l border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-2">
                <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  Quick ranges
                </p>
                <ul className="space-y-0.5">
                  {PRESETS.map((p) => {
                    const isActive = activePreset === p.id;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => handlePreset(p.id)}
                          className={[
                            'flex h-7 w-full items-center rounded-[7px] px-2 text-[12.5px] font-medium tracking-[-0.01em]',
                            isActive
                              ? 'bg-[var(--primary-alpha-10)] text-[var(--primary-base)]'
                              : 'text-[var(--neutral-sub-600)] hover:bg-white hover:text-[var(--neutral-strong-950)]',
                          ].join(' ')}
                        >
                          {p.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-[var(--stroke-soft-200)] bg-white px-4 py-2.5">
              <div className="text-[12px] text-[var(--neutral-sub-600)]">
                <span className="font-medium text-[var(--neutral-strong-950)]">
                  {draft?.from ? formatDate(draft.from) : '—'}
                </span>
                <span className="mx-1.5 text-[var(--neutral-soft-400)]">→</span>
                <span className="font-medium text-[var(--neutral-strong-950)]">
                  {draft?.to
                    ? formatDate(draft.to)
                    : draft?.from
                    ? formatDate(draft.from)
                    : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex h-7 items-center rounded-[7px] px-2.5 text-[12px] font-medium text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-7 items-center rounded-[7px] border border-[var(--stroke-sub-300)] bg-white px-2.5 text-[12px] font-medium text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!draft?.from}
                  className="inline-flex h-7 items-center rounded-[7px] px-3 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: 'var(--btn-primary-bg)',
                    boxShadow: 'var(--btn-primary-shadow)',
                    border: '1px solid var(--btn-primary-border)',
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
