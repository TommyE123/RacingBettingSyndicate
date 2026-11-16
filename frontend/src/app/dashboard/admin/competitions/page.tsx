import * as React from 'react';
import type { Metadata } from 'next';

import { config } from '@/config';
import { CompetitionsView } from '@/components/admin/competitions-view';

export const metadata = { title: `Competitions | ${config.site.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <CompetitionsView />
  );
}
