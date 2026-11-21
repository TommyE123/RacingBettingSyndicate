'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ListIcon } from '@phosphor-icons/react/dist/ssr/List';
import { PlusIcon } from '@phosphor-icons/react/dist/ssr/Plus';

import { paths } from '@/paths';
import { useCompetition } from '@/contexts/competition-context';
import { usePopover } from '@/hooks/use-popover';
import { useUser } from '@/hooks/use-user';
import { InstallAppButton } from '@/components/core/pwa/install-app-button';

import { MobileNav } from './mobile-nav';
import { UserPopover } from './user-popover';

export function initials(name: string | undefined): string {
  if (!name) {
    return '?';
  }
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}` : name.slice(0, 2)).toUpperCase();
}

export function MainNav(): React.JSX.Element {
  const [openNav, setOpenNav] = React.useState<boolean>(false);
  const userPopover = usePopover<HTMLButtonElement>();
  const { user } = useUser();
  const { competition, isEntered } = useCompetition();

  return (
    <React.Fragment>
      <Box
        component="header"
        sx={{
          borderBottom: '1px solid var(--mui-palette-divider)',
          backgroundColor: 'var(--mui-palette-background-paper)',
          position: 'sticky',
          top: 0,
          zIndex: 'var(--mui-zIndex-appBar)',
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: 'center', justifyContent: 'space-between', minHeight: '64px', px: 2 }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
            <IconButton
              aria-label="Open menu"
              onClick={(): void => {
                setOpenNav(true);
              }}
              sx={{ display: { lg: 'none' } }}
            >
              <ListIcon />
            </IconButton>
            <Typography noWrap variant="subtitle1">
              {competition?.name ?? ''}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <InstallAppButton />
            {isEntered ? (
              <Button
                component={RouterLink}
                href={paths.dashboard.newBet}
                size="small"
                startIcon={<PlusIcon />}
                sx={{ whiteSpace: 'nowrap' }}
                variant="contained"
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Add a bet
                </Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                  Bet
                </Box>
              </Button>
            ) : null}
            <IconButton
              aria-label="Account menu"
              onClick={userPopover.handleOpen}
              ref={userPopover.anchorRef}
              sx={{ p: 0 }}
            >
              <Avatar sx={{ bgcolor: 'var(--mui-palette-primary-main)', fontSize: '0.9rem' }}>
                {initials(user?.display_name)}
              </Avatar>
            </IconButton>
          </Stack>
        </Stack>
      </Box>
      <UserPopover anchorEl={userPopover.anchorRef.current} onClose={userPopover.handleClose} open={userPopover.open} />
      <MobileNav
        onClose={() => {
          setOpenNav(false);
        }}
        open={openNav}
      />
    </React.Fragment>
  );
}
