'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  /** Validation-error state — flips border + ring to error tones. */
  invalid?: boolean;
}

// 36px height (AlignUI default), 8px radius, 12px horizontal padding,
// 13px text, explicit states for hover / focus / disabled / error.
const baseShell =
  'h-9 w-full rounded-[8px] border bg-white px-3 text-[13px] text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)]';

const valid =
  'border-[var(--stroke-sub-300)] hover:border-[var(--neutral-soft-400)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-[3px] focus:ring-[var(--primary-alpha-16)] disabled:cursor-not-allowed disabled:bg-[var(--neutral-weak-50)] disabled:text-[var(--neutral-soft-400)]';

const invalidStyles =
  'border-[var(--error)] focus:border-[var(--error)] focus:outline-none focus:ring-[3px] focus:ring-[var(--error-lighter)] disabled:cursor-not-allowed disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leadingIcon, trailingIcon, invalid, disabled, ...props },
  ref,
) {
  if (!leadingIcon && !trailingIcon) {
    return (
      <input
        ref={ref}
        disabled={disabled}
        className={cn(baseShell, invalid ? invalidStyles : valid, className)}
        {...props}
      />
    );
  }

  return (
    <div
      data-input-shell
      className={cn(
        'flex h-9 items-center gap-2 rounded-[8px] border bg-white px-3 transition-colors',
        invalid
          ? 'border-[var(--error)] focus-within:border-[var(--error)] focus-within:ring-[3px] focus-within:ring-[var(--error-lighter)]'
          : 'border-[var(--stroke-sub-300)] hover:border-[var(--neutral-soft-400)] focus-within:border-[var(--primary-base)] focus-within:ring-[3px] focus-within:ring-[var(--primary-alpha-16)]',
        disabled && 'cursor-not-allowed bg-[var(--neutral-weak-50)] opacity-60',
        className,
      )}
    >
      {leadingIcon && (
        <span className="inline-flex shrink-0 text-[var(--neutral-soft-400)]">{leadingIcon}</span>
      )}
      <input
        ref={ref}
        disabled={disabled}
        // Force the inner input to be completely chromeless so only the
        // wrapper paints visible border/background. Some browsers (notably
        // Chrome/Edge on `type="password"`) paint a default border on the
        // input even when our globals.css rule says otherwise — `!important`
        // utilities + appearance:none + inline border:none belt-and-suspender
        // it so the inner rectangle never shows up.
        className="flex-1 !border-0 !bg-transparent p-0 text-[13px] text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)] focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-transparent [appearance:none] [-webkit-appearance:none]"
        style={{ border: 'none', boxShadow: 'none', background: 'transparent' }}
        {...props}
      />
      {trailingIcon && (
        <span className="inline-flex shrink-0 text-[var(--neutral-soft-400)]">{trailingIcon}</span>
      )}
    </div>
  );
});

// 36px Select — same shell as Input for consistency.
export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-3 text-[13px] font-medium text-[var(--neutral-sub-600)]',
        'hover:border-[var(--neutral-soft-400)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-[3px] focus:ring-[var(--primary-alpha-16)]',
        'disabled:cursor-not-allowed disabled:bg-[var(--neutral-weak-50)] disabled:text-[var(--neutral-soft-400)]',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
