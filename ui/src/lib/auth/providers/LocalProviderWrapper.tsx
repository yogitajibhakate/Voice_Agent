'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import logger from '@/lib/logger';

import type { AuthUser, LocalUser } from '../types';
import { AuthContext } from './AuthProvider';

export function LocalProviderWrapper({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);
  const initPromiseRef = useRef<Promise<string | null> | null>(null);

  const fetchAuthToken = React.useCallback(async (): Promise<string | null> => {
    if (tokenRef.current) return tokenRef.current;
    if (initPromiseRef.current) return initPromiseRef.current;

    initPromiseRef.current = (async () => {
      try {
        const response = await fetch('/api/auth/oss');
        if (response.ok) {
          const data = await response.json();
          tokenRef.current = data.token;
          setUser(data.user);
          logger.info('OSS auth initialized', { user: data.user });
          return data.token as string;
        } else if (response.status === 401) {
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/')) {
            window.location.href = '/auth/login';
          }
        } else {
          logger.error('Failed to initialize OSS auth');
        }
      } catch (error) {
        logger.error('Error initializing OSS auth', error);
      } finally {
        setLoading(false);
      }
      return null;
    })();

    return initPromiseRef.current;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    void fetchAuthToken();
  }, [fetchAuthToken]);

  const getAccessToken = React.useCallback(async () => {
    if (typeof window === 'undefined') {
      return 'ssr-placeholder-token';
    }
    if (tokenRef.current) {
      return tokenRef.current;
    }
    const token = await fetchAuthToken();
    return token || '';
  }, [fetchAuthToken]);

  const redirectToLogin = React.useCallback(() => {
    window.location.href = '/auth/login';
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      logger.error('Error during logout', error);
    }
    setUser(null);
    tokenRef.current = null;
    window.location.href = '/auth/login';
  }, []);

  const contextValue = useMemo(() => ({
    user: user as AuthUser,
    isAuthenticated: !!user,
    loading,
    getAccessToken,
    redirectToLogin,
    logout,
    provider: 'local' as const,
  }), [user, loading, getAccessToken, redirectToLogin, logout]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
