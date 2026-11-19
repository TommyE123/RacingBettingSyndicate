'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { DownloadSimpleIcon } from '@phosphor-icons/react/dist/ssr/DownloadSimple';

import { usePwa } from './pwa-provider';

// Shown only where the browser offers an install prompt (Chrome and Edge on Android and desktop).
export function InstallAppButton(): React.JSX.Element | null {
  const { canInstall, install } = usePwa();
  if (!canInstall) {
    return null;
  }
  return (
    <Button
      onClick={() => {
        void install();
      }}
      size="small"
      startIcon={<DownloadSimpleIcon />}
      sx={{ whiteSpace: 'nowrap' }}
      variant="outlined"
    >
      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
        Install app
      </Box>
      <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
        Install
      </Box>
    </Button>
  );
}
