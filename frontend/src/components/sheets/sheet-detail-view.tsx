'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/ssr/ArrowLeft';
import { ArrowSquareOutIcon } from '@phosphor-icons/react/dist/ssr/ArrowSquareOut';
import { PlusIcon } from '@phosphor-icons/react/dist/ssr/Plus';
import { TrashIcon } from '@phosphor-icons/react/dist/ssr/Trash';

import type { Sheet, Slip } from '@/types/api';
import { paths } from '@/paths';
import { api, errorMessage } from '@/lib/api';
import { dayName, formatDateTime } from '@/lib/days';
import { parsePounds, penceToInput } from '@/lib/money';
import { useCompetition } from '@/contexts/competition-context';
import { useNotify } from '@/contexts/notify-context';
import { useApi } from '@/hooks/use-api';
import { useUser } from '@/hooks/use-user';
import { SlipList } from '@/components/bets/slip-view';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { MoneyField } from '@/components/common/money-field';
import { ErrorAlert, Loading } from '@/components/common/states';

import { SheetTotals } from './sheet-totals';

export function SheetDetailView(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const { user, isAdmin } = useUser();
  const { competition, version, dayById, bump } = useCompetition();
  const notify = useNotify();
  const sheet = useApi<Sheet>(`/api/sheets/${id}`, [version]);
  // The sheet belongs to whichever competition holds its day. If another competition is
  // selected, nothing here may load or change data through the wrong one.
  const inThisCompetition = sheet.data ? dayById(sheet.data.day_id) !== undefined : false;
  const slips = useApi<Slip[]>(
    competition && inThisCompetition
      ? `/api/competitions/${competition.id}/slips?sheet_id=${id}&include_void=true`
      : null,
    [version]
  );
  const [editing, setEditing] = React.useState(false);
  const [dayId, setDayId] = React.useState<number | ''>('');
  const [totalText, setTotalText] = React.useState('');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Fill the edit form from the sheet as editing starts, so a background reload never
  // replaces changes that are still being typed.
  const startEditing = (): void => {
    if (sheet.data) {
      setDayId(sheet.data.day_id);
      setTotalText(penceToInput(sheet.data.stated_total_pence));
      setNote(sheet.data.note ?? '');
    }
    setEditing(true);
  };

  if (sheet.isLoading && !sheet.data) {
    return <Loading />;
  }
  if (sheet.error || !sheet.data) {
    return <ErrorAlert message={sheet.error ?? 'Sheet not found'} />;
  }
  const data = sheet.data;
  const manage = (isAdmin || data.user_id === user?.id) && inThisCompetition;

  const save = async (): Promise<void> => {
    const stated = parsePounds(totalText);
    if (totalText.trim() && stated === null) {
      notify('Enter the sheet total like 30 or 2.50, or leave it empty to clear it', 'error');
      return;
    }
    setBusy(true);
    try {
      await api(`/api/sheets/${data.id}`, {
        method: 'PATCH',
        json: {
          day_id: dayId === '' ? null : dayId,
          stated_total_pence: stated,
          clear_stated_total: totalText.trim() === '',
          note,
        },
      });
      notify('Sheet updated');
      setEditing(false);
      bump();
    } catch (error) {
      notify(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (): Promise<void> => {
    setBusy(true);
    try {
      await api(`/api/sheets/${data.id}`, { method: 'DELETE' });
      notify('Sheet deleted');
      bump();
      router.push(paths.dashboard.sheets);
    } catch (error) {
      notify(errorMessage(error), 'error');
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={3}>
      <div>
        <Button component={RouterLink} href={paths.dashboard.sheets} startIcon={<ArrowLeftIcon />}>
          Bet sheets
        </Button>
      </div>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <div>
          <Typography variant="h4">{data.display_name}&apos;s sheet</Typography>
          <Typography color="text.secondary" variant="body2">
            {dayName(dayById(data.day_id))} · uploaded by {data.uploaded_by_name}, {formatDateTime(data.created_at)}
          </Typography>
        </div>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {manage ? (
            <Button
              component={RouterLink}
              href={`${paths.dashboard.newBet}?sheet=${data.id}`}
              startIcon={<PlusIcon />}
              variant="contained"
            >
              Enter a bet from it
            </Button>
          ) : null}
          <Button
            component="a"
            endIcon={<ArrowSquareOutIcon />}
            href={`/api/sheets/${data.id}/image`}
            rel="noreferrer"
            target="_blank"
            variant="outlined"
          >
            Full size
          </Button>
        </Stack>
      </Stack>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <Box
              alt={`Bet sheet from ${data.display_name}`}
              component="img"
              src={`/api/sheets/${data.id}/image`}
              sx={{ display: 'block', maxHeight: '80vh', objectFit: 'contain', width: '100%' }}
            />
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={3}>
            <Card>
              <CardHeader
                action={
                  manage ? (
                    <Button
                      onClick={() => {
                        if (editing) {
                          setEditing(false);
                        } else {
                          startEditing();
                        }
                      }}
                      size="small"
                    >
                      {editing ? 'Cancel' : 'Edit'}
                    </Button>
                  ) : undefined
                }
                title="Check it adds up"
              />
              <CardContent sx={{ pt: 0 }}>
                {editing ? (
                  <Stack spacing={2}>
                    <TextField
                      label="Day"
                      onChange={(event) => {
                        setDayId(Number(event.target.value));
                      }}
                      select
                      value={dayId}
                    >
                      {(competition?.days ?? []).map((day) => (
                        <MenuItem key={day.id} value={day.id}>
                          {dayName(day)}
                        </MenuItem>
                      ))}
                    </TextField>
                    <MoneyField
                      helperText="Leave empty if the sheet has no total"
                      label="Total written on the sheet"
                      onChange={(text) => {
                        setTotalText(text);
                      }}
                      value={totalText}
                    />
                    <TextField
                      label="Note"
                      onChange={(event) => {
                        setNote(event.target.value);
                      }}
                      value={note}
                    />
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                      <Button
                        color="error"
                        disabled={busy}
                        onClick={() => {
                          setConfirmDelete(true);
                        }}
                        startIcon={<TrashIcon />}
                      >
                        Delete sheet
                      </Button>
                      <Button
                        disabled={busy}
                        onClick={() => {
                          save().catch(() => {
                            // save reports its own errors
                          });
                        }}
                        variant="contained"
                      >
                        Save
                      </Button>
                    </Stack>
                  </Stack>
                ) : (
                  <Stack spacing={1.5}>
                    <SheetTotals sheet={data} />
                    {data.note ? (
                      <Typography color="text.secondary" variant="body2">
                        {data.note}
                      </Typography>
                    ) : null}
                  </Stack>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Bets entered from this sheet" />
              <CardContent sx={{ pt: 0 }}>
                {inThisCompetition ? null : (
                  <Alert severity="info">
                    This sheet belongs to another competition. Switch to it in the competition picker to see
                    and enter its bets.
                  </Alert>
                )}
                {slips.error ? (
                  <ErrorAlert message={slips.error} onRetry={slips.reload} />
                ) : slips.data ? (
                  <SlipList emptyText="None yet." showOwner={false} slips={slips.data} />
                ) : slips.isLoading ? (
                  <Loading />
                ) : null}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
      <ConfirmDialog
        busy={busy}
        confirmLabel="Delete"
        danger
        message="The photo is removed for good. Sheets with live bets on them cannot be deleted; void those bets first."
        onCancel={() => {
          setConfirmDelete(false);
        }}
        onConfirm={() => {
          remove().catch(() => {
            // remove reports its own errors
          });
        }}
        open={confirmDelete}
        title="Delete this sheet?"
      />
    </Stack>
  );
}
