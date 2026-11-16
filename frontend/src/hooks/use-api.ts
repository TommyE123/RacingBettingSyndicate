'use client';

import * as React from 'react';

import { api, errorMessage } from '@/lib/api';

export interface ApiState<T> {
  data: T | undefined;
  error: string | null;
  isLoading: boolean;
  reload: () => void;
}

// Loads a GET endpoint. Pass null to skip. Reloads when the path or any dependency changes.
export function useApi<T>(path: string | null, deps: React.DependencyList = []): ApiState<T> {
  const [data, setData] = React.useState<T | undefined>();
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(path !== null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (path === null) {
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    api<T>(path, { signal: controller.signal })
      .then((result) => {
        setData(result);
        setIsLoading(false);
      })
      .catch((error_: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(errorMessage(error_));
        setIsLoading(false);
      });
    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the caller's to choose
  }, [path, tick, ...deps]);

  const reload = React.useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  return { data, error, isLoading, reload };
}
