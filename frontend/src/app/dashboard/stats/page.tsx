import * as React from 'react';
import type { Metadata } from 'next';

import { config } from '@/config';
import { StatsView } from '@/components/stats/stats-view';

export const metadata = { title: `Stats | ${config.site.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <StatsView />
  );
}
