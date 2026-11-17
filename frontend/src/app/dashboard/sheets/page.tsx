import * as React from 'react';
import type { Metadata } from 'next';

import { config } from '@/config';
import { SheetsView } from '@/components/sheets/sheets-view';

export const metadata = { title: `Bet sheets | ${config.site.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <SheetsView />
  );
}
