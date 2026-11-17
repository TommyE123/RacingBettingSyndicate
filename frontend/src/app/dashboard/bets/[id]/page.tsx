import * as React from 'react';
import type { Metadata } from 'next';

import { config } from '@/config';
import { BetDetailView } from '@/components/bets/bet-detail-view';

export const metadata = { title: `Bet | ${config.site.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <BetDetailView />
  );
}
