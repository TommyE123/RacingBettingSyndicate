'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import { useParams } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/ssr/ArrowLeft';
import { TrashIcon } from '@phosphor-icons/react/dist/ssr/Trash';

import type { ApiUser, CompetitionDetail } from '@/types/api';
import { paths } from '@/paths';
import { api, errorMessage } from '@/lib/api';
import { dayName } from '@/lib/days';
import { parsePounds, penceToInput } from '@/lib/money';
import { useCompetition } from '@/contexts/competition-context';
import { useNotify } from '@/contexts/notify-context';
import { useApi } from '@/hooks/use-api';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { MoneyField } from '@/components/common/money-field';
import { ErrorAlert, Loading } from '@/components/common/states';

import { AdminOnly } from './admin-only';

export function CompetitionDetailView(): React.JSX.Element {
  return (
    <AdminOnly>
      <CompetitionDetailPage />
    </AdminOnly>
  );
}

function CompetitionDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { refresh, competition: shown, select } = useCompetition();
  const notify = useNotify();
  const detail = useApi<CompetitionDetail>(`/api/competitions/${id}`);
  const users = useApi<ApiUser[]>('/api/admin/users');
  const [name, setName] = React.useState('');
  const [budget, setBudget] = React.useState('');
  const [newDate, setNewDate] = React.useState('');
  const [newLabel, setNewLabel] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [removingDay, setRemovingDay] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (detail.data) {
      setName(detail.data.name);
      setBudget(penceToInput(detail.data.budget_pence));
    }
  }, [detail.data]);

  if (detail.isLoading && !detail.data) {
    return <Loading />;
  }
  if (detail.error || !detail.data) {
    return <ErrorAlert message={detail.error ?? 'Competition not found'} />;
  }
  const data = detail.data;
  const entered = new Set(data.entrants.map((entrant) => entrant.user_id));

  const afterChange = async (message: string): Promise<void> => {
    notify(message);
    detail.reload();
    if (shown?.id === data.id) {
      await refresh();
    }
  };

  const run = async (action: () => Promise<unknown>, message: string): Promise<void> => {
    setBusy(true);
    try {
      await action();
      await afterChange(message);
    } catch (error) {
      notify(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = (): void => {
    const pence = parsePounds(budget);
    if (!pence) {
      notify('Enter a budget like 500', 'error');
      return;
    }
    run(
      () =>
        api(`/api/admin/competitions/${data.id}`, {
          method: 'PATCH',
          json: { name: name.trim(), budget_pence: pence },
        }),
      'Competition saved'
    ).catch(() => {
      // run reports its own errors
    });
  };

  const addDay = (): void => {
    if (!newDate) {
      notify('Choose a date', 'error');
      return;
    }
    run(
      () =>
        api(`/api/admin/competitions/${data.id}/days`, {
          method: 'POST',
          json: { date: newDate, label: newLabel.trim() || null },
        }),
      'Day added'
    )
      .then(() => {
        setNewDate('');
        setNewLabel('');
      })
      .catch(() => {
        // run reports its own errors
      });
  };

  const toggleEntry = (user: ApiUser): void => {
    const isIn = entered.has(user.id);
    run(
      () =>
        api(`/api/admin/competitions/${data.id}/entries/${user.id}`, {
          method: isIn ? 'DELETE' : 'PUT',
        }),
      isIn ? `${user.display_name} removed` : `${user.display_name} entered`
    ).catch(() => {
      // run reports its own errors
    });
  };

  const activeUsers = (users.data ?? []).filter((user) => user.is_active || entered.has(user.id));

  return (
    <Stack spacing={3}>
      <div>
        <Button component={RouterLink} href={paths.dashboard.admin.competitions} startIcon={<ArrowLeftIcon />}>
          Competitions
        </Button>
      </div>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Typography variant="h4">{data.name}</Typography>
        {shown?.id === data.id ? null : (
          <Button
            onClick={() => {
              select(data.id);
            }}
            variant="outlined"
          >
            Show this competition everywhere
          </Button>
        )}
      </Stack>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={3}>
            <Card>
              <CardHeader title="Details" />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  <TextField
                    label="Name"
                    onChange={(event) => {
                      setName(event.target.value);
                    }}
                    value={name}
                  />
                  <MoneyField
                    helperText="What each person must bet over the festival"
                    label="Budget each"
                    onChange={(text) => {
                      setBudget(text);
                    }}
                    value={budget}
                  />
                  <div>
                    <Button disabled={busy} onClick={saveDetails} variant="contained">
                      Save
                    </Button>
                  </div>
                </Stack>
              </CardContent>
            </Card>
            <Card>
              <CardHeader subheader="The race days. Bets are placed on, and settle on, these days." title="Days" />
              <Divider />
              <List disablePadding>
                {data.days.map((day) => (
                  <ListItem
                    divider
                    key={day.id}
                    secondaryAction={
                      <Tooltip title="Remove this day (only if no bets use it)">
                        <IconButton
                          aria-label={`Remove ${dayName(day)}`}
                          disabled={busy}
                          edge="end"
                          onClick={() => {
                            setRemovingDay(day.id);
                          }}
                        >
                          <TrashIcon />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemText primary={dayName(day)} secondary={day.date} />
                  </ListItem>
                ))}
                {data.days.length === 0 ? (
                  <ListItem>
                    <ListItemText secondary="No days yet. Add the four festival days below." />
                  </ListItem>
                ) : null}
              </List>
              <CardContent>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Date"
                    onChange={(event) => {
                      setNewDate(event.target.value);
                    }}
                    slotProps={{ inputLabel: { shrink: true } }}
                    type="date"
                    value={newDate}
                  />
                  <TextField
                    label="Label (optional)"
                    onChange={(event) => {
                      setNewLabel(event.target.value);
                    }}
                    placeholder="Champion Day"
                    value={newLabel}
                  />
                  <Button disabled={busy} onClick={addDay} variant="outlined">
                    Add day
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              subheader={`${data.entrants.length} entered. Tick everyone who is playing.`}
              title="Who is in"
            />
            <Divider />
            {users.error ? <ErrorAlert message={users.error} /> : null}
            <List disablePadding>
              {activeUsers.map((user) => (
                <ListItem disablePadding divider key={user.id}>
                  <ListItemButton
                    disabled={busy}
                    onClick={() => {
                      toggleEntry(user);
                    }}
                  >
                    <ListItemIcon>
                      <Checkbox checked={entered.has(user.id)} disableRipple edge="start" tabIndex={-1} />
                    </ListItemIcon>
                    <ListItemText
                      primary={user.display_name}
                      secondary={`@${user.username}${user.role === 'admin' ? ' · admin' : ''}${user.is_active ? '' : ' · deactivated'}`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
            <CardContent>
              <Alert severity="info">
                Someone with bets in this competition cannot be removed from it. Add new people from{' '}
                <RouterLink href={paths.dashboard.admin.users}>Users</RouterLink>.
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <ConfirmDialog
        busy={busy}
        confirmLabel="Remove day"
        danger
        message="Days with bets on them cannot be removed."
        onCancel={() => {
          setRemovingDay(null);
        }}
        onConfirm={() => {
          const dayId = removingDay;
          setRemovingDay(null);
          if (dayId !== null) {
            run(() => api(`/api/admin/competitions/${data.id}/days/${dayId}`, { method: 'DELETE' }), 'Day removed').catch(
              () => {
                // run reports its own errors
              }
            );
          }
        }}
        open={removingDay !== null}
        title="Remove this day?"
      />
    </Stack>
  );
}
