'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import { Chip } from '@/components/common/chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { UserPlusIcon } from '@phosphor-icons/react/dist/ssr/UserPlus';

import type { ApiUser, Role } from '@/types/api';
import { api, errorMessage } from '@/lib/api';
import { useCompetition } from '@/contexts/competition-context';
import { useNotify } from '@/contexts/notify-context';
import { useApi } from '@/hooks/use-api';
import { useUser } from '@/hooks/use-user';
import { PageHeader } from '@/components/common/page-header';
import { ErrorAlert, Loading } from '@/components/common/states';

import { AdminOnly } from './admin-only';

export function UsersView(): React.JSX.Element {
  return (
    <AdminOnly>
      <Users />
    </AdminOnly>
  );
}

// 64 short racing words, so each pick is 6 bits: four words plus two digits is about 31 bits
// from a secure random source, yet still easy to read out to someone. Members can change it.
const WORDS = [
  'ascot', 'bay', 'bet', 'bit', 'bolt', 'bridle', 'canter', 'cap', 'chase', 'cheek', 'clerk', 'colt',
  'course', 'dam', 'derby', 'ditch', 'draw', 'evens', 'fence', 'filly', 'flag', 'foal', 'form', 'furlong',
  'gallop', 'gate', 'going', 'gold', 'grey', 'hack', 'hands', 'heath', 'hood', 'hurdle', 'jump', 'lady',
  'lead', 'mare', 'mile', 'nag', 'nose', 'oaks', 'odds', 'pace', 'paddock', 'pony', 'post', 'rail', 'rein',
  'roan', 'saddle', 'sire', 'stable', 'stayer', 'stride', 'stud', 'tote', 'track', 'trot', 'turf', 'whip',
  'yankee', 'yard', 'yearling',
];

function suggestPassword(): string {
  const random = globalThis.crypto.getRandomValues(new Uint8Array(6));
  const words = Array.from(random.slice(0, 4), (byte) => WORDS[byte % WORDS.length]);
  const digits = String((random[4] * 256 + random[5]) % 100).padStart(2, '0');
  return `${words.join('-')}-${digits}`;
}

function Users(): React.JSX.Element {
  const users = useApi<ApiUser[]>('/api/admin/users');
  const { user: me, checkSession } = useUser();
  const { competition, refresh } = useCompetition();
  const [editing, setEditing] = React.useState<ApiUser | 'new' | null>(null);
  const notify = useNotify();

  const entered = new Set((competition?.entrants ?? []).map((entrant) => entrant.user_id));

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          <Button
            onClick={() => {
              setEditing('new');
            }}
            startIcon={<UserPlusIcon />}
            variant="contained"
          >
            Add a person
          </Button>
        }
        subtitle="Everyone who can sign in. Members bet; admins also manage people, competitions and anyone's bets."
        title="Users"
      />
      {users.error ? <ErrorAlert message={users.error} onRetry={users.reload} /> : null}
      {users.isLoading && !users.data ? (
        <Loading />
      ) : (
        <Card>
          <Box sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Username</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>{competition ? `In ${competition.name}` : 'Entered'}</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {(users.data ?? []).map((item) => (
                  <TableRow hover key={item.id} sx={{ opacity: item.is_active ? 1 : 0.6 }}>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {item.display_name}
                        {item.id === me?.id ? ' (you)' : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>@{item.username}</TableCell>
                    <TableCell>
                      <Chip
                        color={item.role === 'admin' ? 'primary' : 'default'}
                        label={item.role === 'admin' ? 'Admin' : 'Member'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {item.is_active ? (
                        <Chip color="success" label="Active" size="small" variant="outlined" />
                      ) : (
                        <Chip label="Deactivated" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>{entered.has(item.id) ? 'Yes' : '—'}</TableCell>
                    <TableCell align="right">
                      <Button
                        onClick={() => {
                          setEditing(item);
                        }}
                        size="small"
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Card>
      )}
      <UserDialog
        competitionName={competition?.name}
        onClose={() => {
          setEditing(null);
        }}
        onSaved={(saved, enter) => {
          setEditing(null);
          users.reload();
          const after = async (): Promise<void> => {
            if (enter && competition) {
              try {
                await api(`/api/admin/competitions/${competition.id}/entries/${saved.id}`, { method: 'PUT' });
              } catch (error) {
                notify(
                  `${saved.display_name} was added, but entering them in ${competition.name} failed (${errorMessage(error)}). Tick them under Competitions to try again.`,
                  'error'
                );
              }
            }
            await refresh();
            if (saved.id === me?.id) {
              await checkSession?.();
            }
          };
          after().catch(() => {
            // the user list already shows the saved person
          });
        }}
        target={editing}
      />
    </Stack>
  );
}

function UserDialog({
  target,
  competitionName,
  onClose,
  onSaved,
}: {
  target: ApiUser | 'new' | null;
  competitionName?: string;
  onClose: () => void;
  onSaved: (user: ApiUser, enter: boolean) => void;
}): React.JSX.Element {
  const notify = useNotify();
  const isNew = target === 'new';
  const existing = target && target !== 'new' ? target : null;
  const [username, setUsername] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [role, setRole] = React.useState<Role>('member');
  const [active, setActive] = React.useState(true);
  const [enter, setEnter] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setUsername(existing?.username ?? '');
    setDisplayName(existing?.display_name ?? '');
    setPassword(isNew ? suggestPassword() : '');
    setRole(existing?.role ?? 'member');
    setActive(existing?.is_active ?? true);
    setEnter(true);
    setError(null);
  }, [target, existing, isNew]);

  const save = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      let saved: ApiUser;
      if (isNew) {
        saved = await api<ApiUser>('/api/admin/users', {
          method: 'POST',
          json: { username, display_name: displayName, password, role },
        });
        notify(`${saved.display_name} added. Their password is ${password}`, 'info');
      } else if (existing) {
        const changes: Record<string, unknown> = {};
        if (displayName !== existing.display_name) {
          changes.display_name = displayName;
        }
        if (role !== existing.role) {
          changes.role = role;
        }
        if (active !== existing.is_active) {
          changes.is_active = active;
        }
        if (password) {
          changes.password = password;
        }
        saved = await api<ApiUser>(`/api/admin/users/${existing.id}`, { method: 'PATCH', json: changes });
        notify(password ? `Saved. ${saved.display_name}'s new password is ${password}` : 'Saved', password ? 'info' : 'success');
      } else {
        return;
      }
      onSaved(saved, isNew && enter);
    } catch (error_) {
      setError(errorMessage(error_));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="sm" onClose={busy ? undefined : onClose} open={target !== null}>
      <DialogTitle>{isNew ? 'Add a person' : `Edit ${existing?.display_name ?? ''}`}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            autoFocus={isNew}
            disabled={!isNew}
            helperText={isNew ? 'What they type to sign in: letters, numbers, dots or dashes' : 'Usernames cannot be changed'}
            label="Username"
            onChange={(event) => {
              setUsername(event.target.value.toLowerCase().replaceAll(/\s/g, ''));
            }}
            slotProps={{ htmlInput: { autoCapitalize: 'none', autoCorrect: 'off' } }}
            value={username}
          />
          <TextField
            helperText="Shown on the leaderboard"
            label="Name"
            onChange={(event) => {
              setDisplayName(event.target.value);
            }}
            value={displayName}
          />
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <TextField
              fullWidth
              helperText={isNew ? 'Give them this; they can change it later' : 'Leave empty to keep their password. Setting one signs them out everywhere.'}
              label={isNew ? 'Password' : 'New password'}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              value={password}
            />
            <Button
              onClick={() => {
                setPassword(suggestPassword());
              }}
              sx={{ mt: 1, whiteSpace: 'nowrap' }}
            >
              Suggest
            </Button>
          </Stack>
          <TextField
            label="Role"
            onChange={(event) => {
              setRole(event.target.value as Role);
            }}
            select
            value={role}
          >
            <MenuItem value="member">Member</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </TextField>
          {isNew && competitionName ? (
            <FormControlLabel
              control={
                <Switch
                  checked={enter}
                  onChange={(event) => {
                    setEnter(event.target.checked);
                  }}
                />
              }
              label={`Enter them in ${competitionName}`}
            />
          ) : null}
          {existing ? (
            <FormControlLabel
              control={
                <Switch
                  checked={active}
                  onChange={(event) => {
                    setActive(event.target.checked);
                  }}
                />
              }
              label={active ? 'Can sign in' : 'Deactivated: cannot sign in'}
            />
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={busy || !displayName.trim() || (isNew && (!username || password.length < 8))}
          onClick={() => {
            save().catch(() => {
              // save reports its own errors
            });
          }}
          variant="contained"
        >
          {isNew ? 'Add' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
