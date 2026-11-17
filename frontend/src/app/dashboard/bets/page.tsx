import * as React from 'react';
import type { Metadata } from 'next';

import { config } from '@/config';
import { BetsView } from '@/components/bets/bets-view';

export const metadata = { title: `All bets | ${config.site.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <React.Suspense fallback={null}>
      <BetsView />
    </React.Suspense>
  );
}
