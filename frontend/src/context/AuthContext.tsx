/**
 * AuthContext
 *
 * Centralized authentication state for the R1 frontend.
 *
 * The context object lives in ``authContextObject.ts`` and the value
 * type / hook in ``authContextValue.ts`` so this file only exports
 * the provider component (keeps react-refresh HMR happy).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, authApi, tokenStore, type UserProfile } from '../api/client';
import { AuthContext } from './authContextObject';
import type { AuthContextValue } from './authContextValue';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(tokenStore.hasAccess());

  const refreshProfile = useCallback(async () => {
    if (!tokenStore.hasAccess()) {
      setUser(null);
      return;
    }
    try {
      const profile = await authApi.me();
      setUser(profile);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
      } else {
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refreshProfile();
      if (!cancelled) setIsInitializing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshProfile]);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await authApi.login(email, password);
      tokenStore.set(tokens.access_token, tokens.refresh_token);
      const profile = await authApi.me();
      setUser(profile);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      // Best-effort: tell the backend. If it fails, we still clear locally.
      await authApi.logout();
    } catch {
      // ignore — keep the UX responsive on logout
    } finally {
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isInitializing,
      login,
      logout,
      refreshProfile,
    }),
    [user, isInitializing, login, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
