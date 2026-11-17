'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { CheckCircleIcon } from '@phosphor-icons/react/dist/ssr/CheckCircle';

import type { CompetitionDetail, Slip } from '@/types/api';
import { paths } from '@/paths';
import { api, errorMessage } from '@/lib/api';
import { betHeadline } from '@/lib/bets';
import { dayName } from '@/lib/days';
import { formatPence, formatProfit, parsePounds, profitColor } from '@/lib/money';
import { useCompetition } from '@/contexts/competition-context';
import { useNotify } from '@/contexts/notify-context';
import { useApi } from '@/hooks/use-api';
import { useUser } from '@/hooks/use-user';
import { MoneyField } from '@/components/common/money-field';
import { PageHeader } from '@/components/common/page-header';
import { RequireCompetition } from '@/components/common/require-competition';
import { EmptyState, ErrorAlert, Loading } from '@/components/common/states';

import { SelectionsList, SlipList } from './slip-view';

export function ReturnsView(): React.JSX.Element {
  return <RequireCompetition>{(competition) => <Returns competition={competition} />}</RequireCompetition>;
}

function Returns({ competition }: { competition: CompetitionDetail }): React.JSX.Element {
  const { user, isAdmin } = useUser();
  const { version, isEntered, dayById } = useCompetition();
  const [who, setWho] = React.useState<number | ''>(
    isEntered && user ? user.id : (competition.entrants[0]?.user_id ?? '')
  );
  const slips = useApi<Slip[]>(who === '' ? null : `/api/competitions/${competition.id}/slips?user_id=${who}`, [
    version,
  ]);
  // Returns saved on this page, applied straight away so a row never waits on a reload.
  // A fresh load replaces them.
  const [savedHere, setSavedHere] = React.useState<Map<number, Slip>>(new Map());
  React.useEffect(() => {
    setSavedHere(new Map());
  }, [slips.data]);

  if (!isEntered && !isAdmin) {
    return <Alert severity="info">You are not entered in {competition.name}.</Alert>;
  }

  const shown = (slips.data ?? []).map((slip) => savedHere.get(slip.id) ?? slip);
  const due = shown.filter((slip) => slip.return_pence === null);
  const done = shown.filter((slip) => slip.return_pence !== null);
  const byDay = new Map<number, Slip[]>();
  for (const slip of due) {
    byDay.set(slip.settle_day_id, [...(byDay.get(slip.settle_day_id) ?? []), slip]);
  }
  const dayOrder = competition.days.filter((day) => byDay.has(day.id));
  const name = competition.entrants.find((entrant) => entrant.user_id === who)?.display_name;

  return (
    <Stack spacing={3}>
      <PageHeader
        subtitle="After the last race, put in what each bet paid back. Enter 0 for a loser."
        title="Enter returns"
      />
      {isAdmin ? (
        <TextField
          label="Whose returns"
          onChange={(event) => {
            setWho(Number(event.target.value));
          }}
          select
          size="small"
          sx={{ maxWidth: 320 }}
          value={who}
        >
          {competition.entrants.map((entrant) => (
            <MenuItem key={entrant.user_id} value={entrant.user_id}>
              {entrant.display_name}
              {entrant.user_id === user?.id ? ' (me)' : ''}
            </MenuItem>
          ))}
        </TextField>
      ) : null}
      {slips.error ? <ErrorAlert message={slips.error} onRetry={slips.reload} /> : null}
      {slips.isLoading && !slips.data ? <Loading /> : null}
      {slips.data && due.length === 0 ? (
        <EmptyState
          action={
            <Button component={RouterLink} href={paths.dashboard.leaderboard} variant="contained">
              See the leaderboard
            </Button>
          }
          description={done.length > 0 ? 'Every bet has its return entered.' : 'There are no bets to settle yet.'}
          icon={<CheckCircleIcon />}
          title={`All done${name && who !== user?.id ? ` for ${name}` : ''}`}
        />
      ) : null}
      {dayOrder.map((day) => (
        <Card key={day.id}>
          <CardHeader
            subheader={`${byDay.get(day.id)?.length ?? 0} to enter · returns count on this day`}
            title={dayName(day)}
          />
          <Divider />
          <Stack divider={<Divider />}>
            {(byDay.get(day.id) ?? []).map((slip) => (
              <ReturnRow
                key={slip.id}
                onSaved={(updated) => {
                  setSavedHere((current) => new Map(current).set(updated.id, updated));
                }}
                slip={slip}
              />
            ))}
          </Stack>
        </Card>
      ))}
      {done.length > 0 ? (
        <Card>
          <CardHeader title={`Already entered (${done.length})`} />
          <CardContent sx={{ pt: 0 }}>
            <SlipList showOwner={false} slips={done} />
          </CardContent>
        </Card>
      ) : null}
      {dayOrder.length === 0 && due.length > 0 ? (
        <Typography color="text.secondary">{dayName(dayById(due[0].settle_day_id))}</Typography>
      ) : null}
    </Stack>
  );
}

function ReturnRow({ slip, onSaved }: { slip: Slip; onSaved: (slip: Slip) => void }): React.JSX.Element {
  const notify = useNotify();
  const { bump } = useCompetition();
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const pence = parsePounds(text);

  const save = async (value: number): Promise<void> => {
    setBusy(true);
    try {
      const updated = await api<Slip>(`/api/slips/${slip.id}/return`, {
        method: 'PUT',
        json: { return_pence: value },
      });
      notify(`${betHeadline(slip)}: ${value ? `${formatPence(value)} back` : 'lost'}`);
      onSaved(updated);
      bump();
    } catch (error) {
      notify(errorMessage(error), 'error');
      setBusy(false);
    }
  };

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between', p: 2 }}
    >
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1">
          {betHeadline(slip)}{' '}
          <Typography color="text.secondary" component="span" variant="body2">
            staked {formatPence(slip.stake_pence)}
          </Typography>
        </Typography>
        <SelectionsList dense slip={slip} />
      </Stack>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', flexShrink: 0 }}>
        <MoneyField
          disabled={busy}
          helperText={
            pence === null ? ' ' : (
              <Typography color={profitColor(pence - slip.stake_pence)} component="span" variant="caption">
                {formatProfit(pence - slip.stake_pence)}
              </Typography>
            )
          }
          label="Returned"
          onChange={(value) => {
            setText(value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && pence !== null) {
              save(pence).catch(() => {
                // save reports its own errors
              });
            }
          }}
          size="small"
          sx={{ width: 150 }}
          value={text}
        />
        <Button
          disabled={busy || pence === null}
          onClick={() => {
            if (pence !== null) {
              save(pence).catch(() => {
                // save reports its own errors
              });
            }
          }}
          variant="contained"
        >
          Save
        </Button>
        <Button
          color="error"
          disabled={busy}
          onClick={() => {
            save(0).catch(() => {
              // save reports its own errors
            });
          }}
          variant="outlined"
        >
          Lost
        </Button>
      </Stack>
    </Stack>
  );
}
