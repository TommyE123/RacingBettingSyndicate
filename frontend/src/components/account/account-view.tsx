'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import { Chip } from '@/components/common/chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { authClient } from '@/lib/auth/client';
import { useNotify } from '@/contexts/notify-context';
import { useUser } from '@/hooks/use-user';
import { initials } from '@/components/dashboard/layout/main-nav';
import { PageHeader } from '@/components/common/page-header';

export function AccountView(): React.JSX.Element {
  const { user } = useUser();
  const notify = useNotify();
  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [repeat, setRepeat] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (next.length < 8) {
      setError('The new password needs at least 8 characters');
      return;
    }
    if (next !== repeat) {
      setError('The new passwords do not match');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await authClient.changePassword(current, next);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCurrent('');
    setNext('');
    setRepeat('');
    notify('Password changed. Other devices have been signed out.');
  };

  return (
    <Stack spacing={3}>
      <PageHeader title="My account" />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5, lg: 4 }}>
          <Card>
            <CardContent>
              <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
                <Avatar sx={{ bgcolor: 'var(--mui-palette-primary-main)', fontSize: '1.5rem', height: 80, width: 80 }}>
                  {initials(user?.display_name)}
                </Avatar>
                <div>
                  <Typography variant="h5">{user?.display_name}</Typography>
                  <Typography color="text.secondary" variant="body2">
                    Signs in as @{user?.username}
                  </Typography>
                </div>
                <Chip
                  color={user?.role === 'admin' ? 'primary' : 'default'}
                  label={user?.role === 'admin' ? 'Admin' : 'Member'}
                />
                <Typography color="text.secondary" variant="caption">
                  Your name and username are set by an admin.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 7, lg: 8 }}>
          <Card>
            <CardHeader subheader="You stay signed in on this device; others are signed out." title="Change password" />
            <CardContent>
              <form
                noValidate
                onSubmit={(event) => {
                  submit(event).catch(() => {
                    // submit reports its own errors
                  });
                }}
              >
                <Stack spacing={2} sx={{ maxWidth: 420 }}>
                  <TextField
                    autoComplete="current-password"
                    label="Current password"
                    onChange={(event) => {
                      setCurrent(event.target.value);
                    }}
                    type="password"
                    value={current}
                  />
                  <TextField
                    autoComplete="new-password"
                    helperText="At least 8 characters"
                    label="New password"
                    onChange={(event) => {
                      setNext(event.target.value);
                    }}
                    type="password"
                    value={next}
                  />
                  <TextField
                    autoComplete="new-password"
                    label="New password again"
                    onChange={(event) => {
                      setRepeat(event.target.value);
                    }}
                    type="password"
                    value={repeat}
                  />
                  {error ? <Alert severity="error">{error}</Alert> : null}
                  <div>
                    <Button disabled={busy || !current || !next} type="submit" variant="contained">
                      Change password
                    </Button>
                  </div>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
