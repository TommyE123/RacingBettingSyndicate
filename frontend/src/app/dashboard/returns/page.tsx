import * as React from 'react';
import type { Metadata } from 'next';

import { config } from '@/config';
import { ReturnsView } from '@/components/bets/returns-view';

export const metadata = { title: `Enter returns | ${config.site.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <ReturnsView />
  );
}
