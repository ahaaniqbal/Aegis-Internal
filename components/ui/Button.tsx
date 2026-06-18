'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

const sizeStyles: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12px] gap-1.5',
  md: 'h-8 px-3 text-[13px] gap-1.5',
  // `lg` exists specifically to line up with the Input component
  // (h-9 / 36px) when a Button sits next to a text field in the same
  // form row. Without this size, every inline-with-input button had to
  // ride on a className override.
  lg: 'h-9 px-3.5 text-[13px] gap-1.5',
};

const variantStyles: Record<Variant, string> = {
  // Primary uses a subtle vertical gradient + 1px lighter top inset to create
  // the soft 3D feel of premium product buttons (Stripe / Linear style).
  //
  // Gradient/border/shadow are sourced from CSS vars so dark themes can
  // mute them — see [data-theme="dark"] / [data-theme="dark-pro"] in
  // globals.css. Light mode defaults reproduce the original orange.
  primary:
    'text-white [background:var(--btn-primary-bg)] [box-shadow:var(--btn-primary-shadow)] border border-[var(--btn-primary-border)] hover:[background:var(--btn-primary-bg-hover)] active:[background:var(--btn-primary-bg-active)] disabled:opacity-60',
  secondary:
    'border border-[var(--stroke-sub-300)] bg-white text-[var(--neutral-sub-600)] shadow-[0_1px_2px_rgba(23,23,23,0.04)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)] active:bg-[var(--neutral-soft-200)]',
  ghost:
    'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
  danger:
    'border border-[var(--error)]/30 bg-[var(--error-lighter)] text-[var(--error-dark)] hover:bg-[var(--error)] hover:text-white',
  success:
    'text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_1px_2px_rgba(11,70,39,0.25)] [background:linear-gradient(180deg,#2ed480_0%,#1fc16b_55%,#19a45a_100%)] border border-[#19a45a] hover:[background:linear-gradient(180deg,#27c878_0%,#19a45a_100%)]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'secondary',
    size = 'md',
    leadingIcon,
    trailingIcon,
    fullWidth,
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-[8px] font-medium tracking-[-0.01em] transition-all duration-100',
        'disabled:cursor-not-allowed',
        fullWidth ? 'w-full' : '',
        sizeStyles[size],
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {leadingIcon ? <span className="inline-flex shrink-0">{leadingIcon}</span> : null}
      {children ? <span className="truncate">{children}</span> : null}
      {trailingIcon ? <span className="inline-flex shrink-0">{trailingIcon}</span> : null}
    </button>
  );
});
