'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';

import { paths } from '@/paths';
import { Logo } from '@/components/core/logo';

import { CompetitionPicker } from './competition-picker';
import { NavList } from './nav-list';
import { navColors } from './side-nav';

export interface MobileNavProps {
  onClose?: () => void;
  open?: boolean;
}

export function MobileNav({ open, onClose }: MobileNavProps): React.JSX.Element {
  const pathname = usePathname();

  return (
    <Drawer
      onClose={onClose}
      open={open}
      slotProps={{
        paper: {
          sx: {
            ...navColors,
            bgcolor: 'var(--mui-palette-neutral-950)',
            color: 'var(--mui-palette-common-white)',
            maxWidth: '100%',
            width: 'var(--MobileNav-width)',
            zIndex: 'var(--MobileNav-zIndex)',
          },
        },
      }}
    >
      <Stack spacing={2} sx={{ p: 3 }}>
        <Box component={RouterLink} href={paths.home} onClick={onClose} sx={{ display: 'inline-flex' }}>
          <Logo color="light" height={36} />
        </Box>
        <CompetitionPicker />
      </Stack>
      <Divider sx={{ borderColor: 'var(--mui-palette-neutral-700)' }} />
      <Box component="nav" sx={{ flex: '1 1 auto', p: '12px' }}>
        <NavList onNavigate={onClose} pathname={pathname} />
      </Box>
    </Drawer>
  );
}
