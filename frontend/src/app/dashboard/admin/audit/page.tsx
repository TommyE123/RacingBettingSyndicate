import * as React from 'react';
import type { Metadata } from 'next';

import { config } from '@/config';
import { AuditView } from '@/components/admin/audit-view';

export const metadata = { title: `Audit log | ${config.site.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <AuditView />
  );
}
