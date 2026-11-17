import * as React from 'react';
import RouterLink from 'next/link';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import { Chip } from '@/components/common/chip';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import { BookOpenIcon } from '@phosphor-icons/react/dist/ssr/BookOpen';
import { SignOutIcon } from '@phosphor-icons/react/dist/ssr/SignOut';
import { UserIcon } from '@phosphor-icons/react/dist/ssr/User';

import { paths } from '@/paths';
import { authClient } from '@/lib/auth/client';
import { logger } from '@/lib/default-logger';
import { useNotify } from '@/contexts/notify-context';
import { useUser } from '@/hooks/use-user';

export interface UserPopoverProps {
  anchorEl: Element | null;
  onClose: () => void;
  open: boolean;
}

export function UserPopover({ anchorEl, onClose, open }: UserPopoverProps): React.JSX.Element {
  const { user, checkSession } = useUser();
  const router = useRouter();
  const notify = useNotify();

  const handleSignOut = React.useCallback(async (): Promise<void> => {
    const { error } = await authClient.signOut();
    if (error) {
      logger.error('Sign out error', error);
      notify(`Could not sign out: ${error}`, 'error');
      return;
    }
    await checkSession?.();
    router.replace(paths.auth.signIn);
  }, [checkSession, notify, router]);

  return (
    <Popover
      anchorEl={anchorEl}
      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      onClose={onClose}
      open={open}
      slotProps={{ paper: { sx: { width: '240px' } } }}
      transformOrigin={{ horizontal: 'right', vertical: 'top' }}
    >
      <Box sx={{ p: '16px 20px ' }}>
        <Typography variant="subtitle1">{user?.display_name}</Typography>
        <Typography color="text.secondary" variant="body2">
          @{user?.username}
        </Typography>
        {user?.role === 'admin' ? <Chip color="primary" label="Admin" size="small" sx={{ mt: 1 }} /> : null}
      </Box>
      <Divider />
      <MenuList disablePadding sx={{ p: '8px', '& .MuiMenuItem-root': { borderRadius: 1 } }}>
        <MenuItem component={RouterLink} href={paths.dashboard.account} onClick={onClose}>
          <ListItemIcon>
            <UserIcon fontSize="var(--icon-fontSize-md)" />
          </ListItemIcon>
          My account
        </MenuItem>
        <MenuItem component={RouterLink} href={paths.dashboard.rules} onClick={onClose}>
          <ListItemIcon>
            <BookOpenIcon fontSize="var(--icon-fontSize-md)" />
          </ListItemIcon>
          Rules
        </MenuItem>
        <MenuItem onClick={handleSignOut}>
          <ListItemIcon>
            <SignOutIcon fontSize="var(--icon-fontSize-md)" />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </MenuList>
    </Popover>
  );
}
