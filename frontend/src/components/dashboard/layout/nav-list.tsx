'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { NavItemConfig } from '@/types/nav';
import { isNavItemActive } from '@/lib/is-nav-item-active';
import { useUser } from '@/hooks/use-user';

import { navItems } from './config';
import { navIcons } from './nav-icons';

export function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }): React.JSX.Element {
  const { isAdmin } = useUser();
  const main = navItems.filter((item) => !('adminOnly' in item && item.adminOnly));
  const admin = navItems.filter((item) => 'adminOnly' in item && item.adminOnly);

  return (
    <Stack spacing={2}>
      <NavGroup items={main} onNavigate={onNavigate} pathname={pathname} />
      {isAdmin ? (
        <div>
          <Typography
            sx={{ color: 'var(--mui-palette-neutral-500)', fontSize: '0.75rem', fontWeight: 600, px: 2, pb: 1 }}
          >
            ADMIN
          </Typography>
          <NavGroup items={admin} onNavigate={onNavigate} pathname={pathname} />
        </div>
      ) : null}
    </Stack>
  );
}

function NavGroup({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItemConfig[];
  pathname: string;
  onNavigate?: () => void;
}): React.JSX.Element {
  return (
    <Stack component="ul" spacing={0.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {items.map(({ key, ...item }) => (
        <NavItem key={key} onNavigate={onNavigate} pathname={pathname} {...item} />
      ))}
    </Stack>
  );
}

interface NavItemProps extends Omit<NavItemConfig, 'items' | 'key'> {
  pathname: string;
  onNavigate?: () => void;
}

function NavItem({ href, icon, matcher, pathname, title, onNavigate }: NavItemProps): React.JSX.Element {
  // "Add a bet" lives under /dashboard/bets too, so match exactly unless a matcher says otherwise.
  const active =
    isNavItemActive({ href, matcher, pathname }) && !(matcher && href !== pathname && pathname.endsWith('/new'));
  const Icon = icon ? navIcons[icon] : null;

  return (
    <li>
      <Box
        aria-current={active ? 'page' : undefined}
        component={RouterLink}
        href={href ?? '#'}
        onClick={onNavigate}
        sx={{
          alignItems: 'center',
          borderRadius: 1,
          color: 'var(--NavItem-color)',
          cursor: 'pointer',
          display: 'flex',
          gap: 1,
          p: '6px 16px',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          '&:hover': { bgcolor: 'var(--NavItem-hover-background)' },
          ...(active && { bgcolor: 'var(--NavItem-active-background)', color: 'var(--NavItem-active-color)' }),
        }}
      >
        {Icon ? (
          <Icon
            fill={active ? 'var(--NavItem-icon-active-color)' : 'var(--NavItem-icon-color)'}
            fontSize="var(--icon-fontSize-md)"
            weight={active ? 'fill' : undefined}
          />
        ) : null}
        <Typography component="span" sx={{ color: 'inherit', fontSize: '0.875rem', fontWeight: 500, lineHeight: '28px' }}>
          {title}
        </Typography>
      </Box>
    </li>
  );
}
