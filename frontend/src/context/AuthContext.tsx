// AuthProvider — wraps app with auth state, login/logout functions.
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { authApi } from '../api/auth';
import { ApiRequestError, clearTokens, hasTokens } from '../api/client';
import type { LoginRequest, RegisterRequest } from '../types/api';
import { AuthContext } from './authContextValue';
import type { AuthState } from './authContextValue';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  const refreshUser = useCallback(async () => {
    if (!hasTokens()) {
      setState({ user: null, isLoading: false, isAuthenticated: false, error: null });
      return;
    }
    try {
      const user = await authApi.me();
      setState({ user, isLoading: false, isAuthenticated: true, error: null });
    } catch (err) {
      // A confirmed 401 (api/client.ts already tried a token refresh and
      // that failed too) means the session really is invalid.
      if (err instanceof ApiRequestError && err.status === 401) {
        clearTokens();
        setState({ user: null, isLoading: false, isAuthenticated: false, error: null });
        return;
      }

      // Any other failure (network hiccup, timeout, 5xx) is not proof the
      // session is invalid -- clearing valid tokens on a guess would force
      // a real logout over a transient blip. Retry once before giving up;
      // this alone resolves the overwhelming majority of these failures.
      await delay(300);
      try {
        const user = await authApi.me();
        setState({ user, isLoading: false, isAuthenticated: true, error: null });
      } catch (retryErr) {
        if (retryErr instanceof ApiRequestError && retryErr.status === 401) {
          clearTokens();
          setState({ user: null, isLoading: false, isAuthenticated: false, error: null });
          return;
        }
        // Still failing and still not a confirmed-invalid session -- leave
        // the tokens in place (a reload or retry can recover) instead of
        // forcing a logout the user never actually triggered.
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: 'Unable to reach the server. Please try again.',
        });
      }
    }
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      await authApi.login(data);
      const user = await authApi.me();
      setState({ user, isLoading: false, isAuthenticated: true, error: null });
      window.dispatchEvent(new Event('auth-change'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setState((s) => ({ ...s, isLoading: false, error: message }));
      throw err;
    }
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      await authApi.register(data);
      setState((s) => ({ ...s, isLoading: false }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setState((s) => ({ ...s, isLoading: false, error: message }));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if the server call fails, clear local state.
    }
    clearTokens();
    setState({ user: null, isLoading: false, isAuthenticated: false, error: null });
    window.dispatchEvent(new Event('auth-change'));
  }, []);

  // On mount, check for existing tokens and load user.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshUser();
  }, [refreshUser]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
