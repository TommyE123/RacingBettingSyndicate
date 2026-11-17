import * as React from 'react';
import type { Metadata } from 'next';

import { config } from '@/config';
import { LeaderboardView } from '@/components/leaderboard/leaderboard-view';

export const metadata = { title: `Leaderboard | ${config.site.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <LeaderboardView />
  );
}
