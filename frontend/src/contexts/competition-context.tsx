'use client';

import * as React from 'react';

import type { BetType, CompetitionDetail, CompetitionSummary, Day } from '@/types/api';
import { api, errorMessage } from '@/lib/api';
import { useUser } from '@/hooks/use-user';

const STORAGE_KEY = 'rbs-competition-id';

export interface CompetitionContextValue {
  competitions: CompetitionSummary[];
  competition: CompetitionDetail | null;
  betTypes: BetType[];
  isLoading: boolean;
  error: string | null;
  select: (id: number) => void;
  refresh: () => Promise<void>;
  // Bumped whenever bets change, so pages can reload what they show.
  version: number;
  bump: () => void;
  dayById: (id: number) => Day | undefined;
  nameOf: (userId: number) => string;
  isEntered: boolean;
}

export const CompetitionContext = React.createContext<CompetitionContextValue | undefined>(undefined);

function readStoredId(): number | null {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY);
    return value ? Number.parseInt(value, 10) : null;
  } catch {
    return null;
  }
}

function storeId(id: number): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, String(id));
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for this visit only.
  }
}

export function CompetitionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { user } = useUser();
  const [competitions, setCompetitions] = React.useState<CompetitionSummary[]>([]);
  const [competition, setCompetition] = React.useState<CompetitionDetail | null>(null);
  const [betTypes, setBetTypes] = React.useState<BetType[]>([]);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);

  const load = React.useCallback(
    async (preferredId: number | null): Promise<void> => {
      if (!user) {
        return;
      }
      setError(null);
      try {
        const [list, types] = await Promise.all([
          api<CompetitionSummary[]>('/api/competitions'),
          api<BetType[]>('/api/bet-types'),
        ]);
        setCompetitions(list);
        setBetTypes(types);
        const wanted = preferredId ?? readStoredId();
        const chosen =
          list.find((item) => item.id === wanted) ?? list.find((item) => item.entered) ?? list[0] ?? null;
        if (chosen) {
          setSelectedId(chosen.id);
          setCompetition(await api<CompetitionDetail>(`/api/competitions/${chosen.id}`));
        } else {
          setSelectedId(null);
          setCompetition(null);
        }
      } catch (error_) {
        setError(errorMessage(error_));
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  React.useEffect(() => {
    load(null).catch(() => {
      // load reports its own errors
    });
  }, [load]);

  const select = React.useCallback(
    (id: number) => {
      storeId(id);
      setIsLoading(true);
      load(id).catch(() => {
        // load reports its own errors
      });
    },
    [load]
  );

  const refresh = React.useCallback(async () => {
    await load(selectedId);
    setVersion((value) => value + 1);
  }, [load, selectedId]);

  const bump = React.useCallback(() => {
    setVersion((value) => value + 1);
  }, []);

  const value = React.useMemo<CompetitionContextValue>(() => {
    const days = new Map((competition?.days ?? []).map((day) => [day.id, day]));
    const names = new Map((competition?.entrants ?? []).map((entrant) => [entrant.user_id, entrant.display_name]));
    return {
      competitions,
      competition,
      betTypes,
      isLoading,
      error,
      select,
      refresh,
      version,
      bump,
      dayById: (id: number) => days.get(id),
      nameOf: (userId: number) => names.get(userId) ?? (userId === user?.id ? user.display_name : `#${userId}`),
      isEntered: Boolean(user && competition?.entrants.some((entrant) => entrant.user_id === user.id)),
    };
  }, [competitions, competition, betTypes, isLoading, error, select, refresh, version, bump, user]);

  return <CompetitionContext.Provider value={value}>{children}</CompetitionContext.Provider>;
}

export function useCompetition(): CompetitionContextValue {
  const context = React.useContext(CompetitionContext);
  if (!context) {
    throw new Error('useCompetition must be used within a CompetitionProvider');
  }
  return context;
}
