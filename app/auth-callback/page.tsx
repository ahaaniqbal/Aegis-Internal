import { Suspense } from 'react';
import { AuthCallbackClient } from './AuthCallbackClient';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function AuthCallbackFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--bg-app)]">
      <div className="flex flex-col items-center gap-4 text-center">
        <LoadingSpinner size="lg" />
        <p className="text-[13px] text-[var(--neutral-sub-600)]">
          Logging you in…
        </p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackFallback />}>
      <AuthCallbackClient />
    </Suspense>
  );
}