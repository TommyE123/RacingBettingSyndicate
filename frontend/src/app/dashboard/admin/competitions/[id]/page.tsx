import * as React from 'react';
import type { Metadata } from 'next';

import { config } from '@/config';
import { CompetitionDetailView } from '@/components/admin/competition-detail-view';

export const metadata = { title: `Competition | ${config.site.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <CompetitionDetailView />
  );
}
