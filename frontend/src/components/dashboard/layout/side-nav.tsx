'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';

import { paths } from '@/paths';
import { Logo } from '@/components/core/logo';

import { CompetitionPicker } from './competition-picker';
import { NavList } from './nav-list';

export const navColors = {
  '--NavItem-color': 'var(--mui-palette-neutral-300)',
  '--NavItem-hover-background': 'rgba(255, 255, 255, 0.04)',
  '--NavItem-active-background': 'var(--mui-palette-primary-main)',
  '--NavItem-active-color': 'var(--mui-palette-primary-contrastText)',
  '--NavItem-icon-color': 'var(--mui-palette-neutral-400)',
  '--NavItem-icon-active-color': 'var(--mui-palette-primary-contrastText)',
} as const;

export function SideNav(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <Box
      sx={{
        ...navColors,
        bgcolor: 'var(--mui-palette-neutral-950)',
        color: 'var(--mui-palette-common-white)',
        display: { xs: 'none', lg: 'flex' },
        flexDirection: 'column',
        height: '100%',
        left: 0,
        maxWidth: '100%',
        overflowY: 'auto',
        position: 'fixed',
        scrollbarWidth: 'none',
        top: 0,
        width: 'var(--SideNav-width)',
        zIndex: 'var(--SideNav-zIndex)',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      <Stack spacing={2} sx={{ p: 3 }}>
        <Box component={RouterLink} href={paths.home} sx={{ display: 'inline-flex', textDecoration: 'none' }}>
          <Logo color="light" height={36} />
        </Box>
        <CompetitionPicker />
      </Stack>
      <Divider sx={{ borderColor: 'var(--mui-palette-neutral-700)' }} />
      <Box component="nav" sx={{ flex: '1 1 auto', p: '12px' }}>
        <NavList pathname={pathname} />
      </Box>
    </Box>
  );
}
