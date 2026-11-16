'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import Button from '@mui/material/Button';
import { FlagCheckeredIcon } from '@phosphor-icons/react/dist/ssr/FlagCheckered';

import type { CompetitionDetail } from '@/types/api';
import { paths } from '@/paths';
import { useCompetition } from '@/contexts/competition-context';
import { useUser } from '@/hooks/use-user';

import { EmptyState, ErrorAlert, Loading } from './states';

// Renders children only once a competition is loaded, with a helpful message otherwise.
export function RequireCompetition({
  children,
}: {
  children: (competition: CompetitionDetail) => React.ReactNode;
}): React.JSX.Element {
  const { competition, isLoading, error, refresh } = useCompetition();
  const { isAdmin } = useUser();

  if (isLoading && !competition) {
    return <Loading />;
  }
  if (error) {
    return (
      <ErrorAlert
        message={error}
        onRetry={() => {
          refresh().catch(() => {
            // refresh reports its own errors
          });
        }}
      />
    );
  }
  if (!competition) {
    return (
      <EmptyState
        action={
          isAdmin ? (
            <Button component={RouterLink} href={paths.dashboard.admin.competitions} variant="contained">
              Set up a competition
            </Button>
          ) : undefined
        }
        description={
          isAdmin
            ? 'Create this year’s competition, add its days and enter everyone.'
            : 'An admin needs to set up this year’s competition and enter you in it.'
        }
        icon={<FlagCheckeredIcon />}
        title="No competition yet"
      />
    );
  }
  return <>{children(competition)}</>;
}
