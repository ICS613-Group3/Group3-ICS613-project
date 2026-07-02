/**
 * AuthContext value holder.
 *
 * Exports the React context object. Split out of ``AuthContext.tsx`` so
 * the provider component file exports only components, which keeps
 * react-refresh HMR happy.
 */

import { createContext } from 'react';
import type { AuthContextValue } from './authContextValue';

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
