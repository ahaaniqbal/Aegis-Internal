'use client';

const sizes = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
};

interface LoadingSpinnerProps {
  size?: keyof typeof sizes;
  /** Use neutral gray instead of brand orange. */
  muted?: boolean;
}

export default function LoadingSpinner({
  size = 'md',
  muted = false,
}: LoadingSpinnerProps) {
  return (
    <svg
      className={`animate-spin ${sizes[size]}`}
      style={{ color: muted ? 'var(--neutral-soft-400)' : 'var(--primary-base)' }}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
