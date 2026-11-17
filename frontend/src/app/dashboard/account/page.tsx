import * as React from 'react';
import type { Metadata } from 'next';

import { config } from '@/config';
import { AccountView } from '@/components/account/account-view';

export const metadata = { title: `My account | ${config.site.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <AccountView />
  );
}
