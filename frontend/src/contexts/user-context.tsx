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
      logger.error(error);
      setState({ user: null, error, isLoading: false });
      return;
    }
    setState({ user: data ?? null, error: null, isLoading: false });
  }, []);

  React.useEffect(() => {
    checkSession().catch((error: unknown) => {
      logger.error(error);
    });
  }, [checkSession]);

  const value = React.useMemo(
    () => ({ ...state, isAdmin: state.user?.role === 'admin', checkSession }),
    [state, checkSession]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export const UserConsumer = UserContext.Consumer;
