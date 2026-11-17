'use client';

import * as React from 'react';

import type { User } from '@/types/user';
import { authClient } from '@/lib/auth/client';
import { logger } from '@/lib/default-logger';

export interface UserContextValue {
  user: User | null;
  error: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  checkSession?: () => Promise<void>;
  // Record a user the server has just confirmed, such as the response to signing in.
  setUser?: (user: User | null) => void;
}

export const UserContext = React.createContext<UserContextValue | undefined>(undefined);

export interface UserProviderProps {
  children: React.ReactNode;
}

export function UserProvider({ children }: UserProviderProps): React.JSX.Element {
  const [state, setState] = React.useState<{ user: User | null; error: string | null; isLoading: boolean }>({
    user: null,
    error: null,
    isLoading: true,
  });

  const checkSession = React.useCallback(async (): Promise<void> => {
    const { data, error } = await authClient.getUser();
    if (error) {
      // A network or server failure is not a sign-out: keep a confirmed user, and only
      // show the error (with a retry) when there is no session to fall back on.
      logger.error(error);
      setState((current) => ({
        user: current.user,
        error: current.user ? null : error,
        isLoading: false,
      }));
      return;
    }
    setState({ user: data ?? null, error: null, isLoading: false });
  }, []);

  React.useEffect(() => {
    checkSession().catch((error: unknown) => {
      logger.error(error);
    });
  }, [checkSession]);

  const setUser = React.useCallback((user: User | null) => {
    setState({ user, error: null, isLoading: false });
  }, []);

  const value = React.useMemo(
    () => ({ ...state, isAdmin: state.user?.role === 'admin', checkSession, setUser }),
    [state, checkSession, setUser]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export const UserConsumer = UserContext.Consumer;
