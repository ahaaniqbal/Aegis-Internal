'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { apiFetch } from '@/lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const res = await apiFetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/onboarding-step`,
          {
            method: 'GET',
            credentials: 'include',
          }
        );

        // not authenticated
        if (!res.ok) {
          router.replace('/auth');
          return;
        }

        const data = await res.json();

        const onboardingStep =
          data.onboarding_step;

        // incomplete onboarding
        if (
          onboardingStep >= 0 &&
          onboardingStep < 4
        ) {
          router.replace('/onboarding');
          return;
        }

        // fully onboarded
        router.replace('/dashboard');

      } catch (err) {
        console.error(
          'BOOTSTRAP ERROR:',
          err
        );
      }
    };

    bootstrap();
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}