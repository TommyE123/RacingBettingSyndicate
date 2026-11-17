import * as React from 'react';
import type { Metadata } from 'next';

import { config } from '@/config';
import { NewBetView } from '@/components/bets/new-bet-view';

export const metadata = { title: `Add a bet | ${config.site.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <React.Suspense fallback={null}>
      <NewBetView />
    </React.Suspense>
  );
}
