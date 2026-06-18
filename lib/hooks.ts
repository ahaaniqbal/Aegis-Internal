'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from './types';

const USER_KEY = 'aegis_user';
const ONBOARDING_KEY = 'aegis_onboarding_step';
const EMAIL_KEY = 'aegis_email';

export function useUser() {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      try {
        setUserState(JSON.parse(stored));
      } catch {
        localStorage.removeItem(USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const setUser = useCallback((u: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUserState(u);
  }, []);

  const clearUser = useCallback(() => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ONBOARDING_KEY);
    setUserState(null);
  }, []);

  return {
    user,
    setUser,
    clearUser,
    isLoading,
    isOnboarded: !!user,
  };
}

export function useOnboardingStep() {
  const [step, setStepState] = useState(1);

  useEffect(() => {
    const stored = localStorage.getItem(ONBOARDING_KEY);
    if (stored) setStepState(parseInt(stored, 10));
  }, []);

  const setStep = useCallback((s: number) => {
    localStorage.setItem(ONBOARDING_KEY, String(s));
    setStepState(s);
  }, []);

  return { step, setStep };
}

export function useAutoRefresh(callback: () => void, intervalMs: number = 30000) {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    callback();
    const interval = setInterval(() => {
      callback();
      setLastUpdated(new Date());
    }, intervalMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { lastUpdated };
}

export function useEmail() {
  const [email, setEmailState] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem(EMAIL_KEY);
    if (stored) {
      setEmailState(stored);
    }
  }, []);

  const setEmail = useCallback((e: string) => {
    localStorage.setItem(EMAIL_KEY, e);
    setEmailState(e);
  }, []);

  const clearEmail = useCallback(() => {
    localStorage.removeItem(EMAIL_KEY);
    setEmailState('');
  }, []);

  return { email, setEmail, clearEmail };
}