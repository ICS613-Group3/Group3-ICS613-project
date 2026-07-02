/**
 * Auth context value type and ``useAuth`` hook.
 *
 * Lives in its own file so the HMR (react-refresh) linter rule doesn't
 * complain about exporting non-components from the context file.
 */

import { useContext } from 'react';
import { AuthContext } from './authContextObject';
import type { UserProfile } from '../api/client';

export interface AuthContextValue {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
