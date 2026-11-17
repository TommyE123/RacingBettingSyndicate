import * as React from 'react';
import type { Metadata } from 'next';

import { config } from '@/config';
import { HomeView } from '@/components/home/home-view';

export const metadata = { title: `Home | ${config.site.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <HomeView />
  );
}
