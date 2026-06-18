'use client';

import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
  onRetry?: () => void;
}

export default function ErrorBanner({ message, onDismiss, onRetry }: ErrorBannerProps) {
  return (
    <div
      className="flex items-center gap-3 rounded-[12px] border border-[var(--error)]/20 bg-[var(--error-lighter)] px-4 py-3"
      role="alert"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--error)]" strokeWidth={2.25} />
      <p className="flex-1 text-[13px] text-[var(--error-dark)]">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-2 py-1 text-[12px] font-medium text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)]"
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
          Retry
        </button>
      )}
      <button
        onClick={onDismiss}
        className="rounded-md p-1 text-[var(--error)] hover:bg-white/60"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
