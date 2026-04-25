'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const access_token = searchParams.get('access_token');
    const refresh_token = searchParams.get('refresh_token');

    console.log('[AuthCallback] Extracting tokens from URL');
    console.log('[AuthCallback] access_token:', access_token ? 'Found' : 'Not found');
    console.log('[AuthCallback] refresh_token:', refresh_token ? 'Found' : 'Not found');

    if (access_token) {
      console.log('[AuthCallback] Storing tokens in localStorage');
      localStorage.setItem('access_token', access_token);
      
      if (refresh_token) {
        localStorage.setItem('refresh_token', refresh_token);
      }

      console.log('[AuthCallback] Tokens stored, redirecting to dashboard');
      // Redirect to dashboard (without tokens in URL for security)
      router.push('/onboarding');
    } else {
      console.warn('[AuthCallback] No access_token in URL, redirecting to login');
      // Redirect to login if no token
      router.push('/login');
    }
  }, [searchParams, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm text-muted-foreground">Logging you in...</p>
      </div>
    </div>
  );
}
