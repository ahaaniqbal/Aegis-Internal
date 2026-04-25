import { Suspense } from 'react';
import { AuthCallbackClient } from './AuthCallbackClient';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function AuthCallbackFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm text-muted-foreground">Logging you in...</p>
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