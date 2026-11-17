import * as React from 'react';
import type { Metadata } from 'next';

import { config } from '@/config';
import { RulesView } from '@/components/rules/rules-view';

export const metadata = { title: `Rules | ${config.site.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <RulesView />
  );
}
