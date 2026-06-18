'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Custom select-menu — popover, keyboard-aware, motion-driven. Drop-in for
 * the native <select>. Same shell as DateRangePicker / UserMenu — small
 * fade + scale-in with the Fingerprint emphasized-decel easing.
 */

const EASE_EMPH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

export interface SelectOption {
  value: string;
  label: string;
  /** Optional leading visual — color swatch, lucide icon, anything. */
  leading?: React.ReactNode;
  /** Optional supporting text shown below the label. */
  description?: string;
}

interface SelectMenuProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
  /** Minimum popover width (defaults to trigger width). */
  minWidth?: number;
  /** Which edge of the trigger the popover anchors to. */
  align?: 'start' | 'end';
}

export function SelectMenu({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  size = 'md',
  className,
  ariaLabel,
  minWidth,
  align = 'start',
}: SelectMenuProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

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

  const active = options.find((o) => o.value === value);
  const triggerW = triggerRef.current?.offsetWidth ?? 0;

  return (
    <div className={cn('relative inline-block', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          'inline-flex items-center justify-between gap-2 rounded-[8px] border bg-white pl-3 pr-2.5 font-medium tracking-[-0.01em]',
          'border-[var(--stroke-sub-300)] text-[var(--neutral-strong-950)]',
          'hover:border-[var(--neutral-soft-400)]',
          'focus:border-[var(--primary-base)] focus:outline-none focus:ring-[3px] focus:ring-[var(--primary-alpha-16)]',
          size === 'sm' ? 'h-7 text-[12px]' : 'h-9 text-[13px]',
        )}
      >
        <span className="inline-flex min-w-0 items-center gap-2 truncate">
          {active?.leading}
          <span className="truncate">{active?.label ?? placeholder}</span>
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-[var(--neutral-soft-400)] transition-transform',
            open && 'rotate-180',
          )}
          strokeWidth={2}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={popoverRef}
            role="listbox"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -3, scale: 0.98 }}
            transition={{ duration: 0.16, ease: EASE_EMPH }}
            style={{
              transformOrigin: align === 'end' ? 'top right' : 'top left',
              minWidth: minWidth ?? triggerW,
            }}
            className={cn(
              'absolute z-40 mt-1.5 overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)] bg-white p-1 shadow-[0_12px_32px_rgba(23,23,23,0.10),0_2px_8px_rgba(23,23,23,0.04)]',
              align === 'end' ? 'right-0' : 'left-0',
            )}
          >
            <ul className="space-y-0.5">
              {options.map((opt) => {
                const selected = opt.value === value;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-[7px] px-2 py-1.5 text-left text-[13px] tracking-[-0.01em]',
                        selected
                          ? 'bg-[var(--primary-alpha-10)] text-[var(--primary-base)]'
                          : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
                      )}
                    >
                      {opt.leading}
                      <span className="flex-1 truncate">
                        <span className={cn('block', selected ? 'font-semibold' : 'font-medium')}>
                          {opt.label}
                        </span>
                        {opt.description && (
                          <span className="block truncate text-[11.5px] text-[var(--neutral-soft-400)]">
                            {opt.description}
                          </span>
                        )}
                      </span>
                      {selected && (
                        <Check
                          className="h-3.5 w-3.5 shrink-0"
                          style={{ color: 'var(--primary-base)' }}
                          strokeWidth={2.25}
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
