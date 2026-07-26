// AuthProvider — wraps app with auth state, login/logout functions.
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { authApi } from '../api/auth';
import { clearTokens, hasTokens } from '../api/client';
import type { LoginRequest, RegisterRequest } from '../types/api';
import { AuthContext } from './authContextValue';
import type { AuthState } from './authContextValue';

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
    } catch {
      clearTokens();
      setState({ user: null, isLoading: false, isAuthenticated: false, error: null });
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
