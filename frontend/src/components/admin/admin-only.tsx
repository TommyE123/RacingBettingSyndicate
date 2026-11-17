'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';

import { useUser } from '@/hooks/use-user';

export function AdminOnly({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { isAdmin } = useUser();
  if (!isAdmin) {
    return <Alert severity="warning">Only admins can see this page.</Alert>;
  }
  return <>{children}</>;
}
