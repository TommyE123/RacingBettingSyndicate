import * as React from 'react';
import type { Metadata } from 'next';

import { config } from '@/config';
import { SheetDetailView } from '@/components/sheets/sheet-detail-view';

export const metadata = { title: `Bet sheet | ${config.site.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <SheetDetailView />
  );
}
