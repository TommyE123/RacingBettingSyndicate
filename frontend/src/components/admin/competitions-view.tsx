'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import { Chip } from '@/components/common/chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { PlusIcon } from '@phosphor-icons/react/dist/ssr/Plus';

import type { CompetitionSummary } from '@/types/api';
import { paths } from '@/paths';
import { api, errorMessage } from '@/lib/api';
import { formatPence, parsePounds } from '@/lib/money';
import { useCompetition } from '@/contexts/competition-context';
import { useNotify } from '@/contexts/notify-context';
import { MoneyField } from '@/components/common/money-field';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/states';

import { AdminOnly } from './admin-only';

export function CompetitionsView(): React.JSX.Element {
  return (
    <AdminOnly>
      <Competitions />
    </AdminOnly>
  );
}

function Competitions(): React.JSX.Element {
  const { competitions, competition, refresh } = useCompetition();
  const [open, setOpen] = React.useState(false);

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          <Button
            onClick={() => {
              setOpen(true);
            }}
            startIcon={<PlusIcon />}
            variant="contained"
          >
            New competition
          </Button>
        }
        subtitle="One competition per festival: its budget, its days and who is in it."
        title="Competitions"
      />
      {competitions.length === 0 ? (
        <EmptyState
          description="Create one for this year's festival, add the race days, then enter everyone."
          title="No competitions yet"
        />
      ) : (
        <Grid container spacing={3}>
          {competitions.map((item) => (
            <Grid key={item.id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardActionArea component={RouterLink} href={paths.dashboard.admin.competition(item.id)} sx={{ height: '100%' }}>
                  <CardContent>
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="h6">{item.name}</Typography>
                        {item.id === competition?.id ? <Chip color="primary" label="Showing" size="small" /> : null}
                      </Stack>
                      <Typography color="text.secondary" variant="body2">
                        {formatPence(item.budget_pence)} budget each
                      </Typography>
                      <Typography color="primary" variant="body2">
                        Manage days and entries →
                      </Typography>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      <NewCompetitionDialog
        onClose={() => {
          setOpen(false);
        }}
        onCreated={() => {
          setOpen(false);
          refresh().catch(() => {
            // refresh reports its own errors
          });
        }}
        open={open}
      />
    </Stack>
  );
}

function NewCompetitionDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (competition: CompetitionSummary) => void;
}): React.JSX.Element {
  const notify = useNotify();
  const router = useRouter();
  const { select } = useCompetition();
  const [name, setName] = React.useState('');
  const [budget, setBudget] = React.useState('500');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName(`Cheltenham ${new Date().getFullYear() + (new Date().getMonth() > 2 ? 1 : 0)}`);
      setBudget('500');
      setError(null);
    }
  }, [open]);

  const save = async (): Promise<void> => {
    const pence = parsePounds(budget);
    if (!pence) {
      setError('Enter the budget each person has, like 500');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await api<CompetitionSummary>('/api/admin/competitions', {
        method: 'POST',
        json: { name: name.trim(), budget_pence: pence },
      });
      notify(`${created.name} created. Now add its days and enter everyone.`);
      onCreated(created);
      select(created.id);
      router.push(paths.dashboard.admin.competition(created.id));
    } catch (error_) {
      setError(errorMessage(error_));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="xs" onClose={busy ? undefined : onClose} open={open}>
      <DialogTitle>New competition</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            autoFocus
            label="Name"
            onChange={(event) => {
              setName(event.target.value);
            }}
            value={name}
          />
          <MoneyField
            helperText="How much each person must bet over the festival"
            label="Budget each"
            onChange={(text) => {
              setBudget(text);
            }}
            value={budget}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={busy || !name.trim()}
          onClick={() => {
            save().catch(() => {
              // save reports its own errors
            });
          }}
          variant="contained"
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
