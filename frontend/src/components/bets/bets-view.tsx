'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DownloadSimpleIcon } from '@phosphor-icons/react/dist/ssr/DownloadSimple';
import { PlusIcon } from '@phosphor-icons/react/dist/ssr/Plus';

import type { CompetitionDetail, Slip } from '@/types/api';
import { paths } from '@/paths';
import { betHeadline, slipStatus } from '@/lib/bets';
import { dayName } from '@/lib/days';
import { formatPence, formatProfit, profitColor } from '@/lib/money';
import { horseKey } from '@/lib/text';
import { useCompetition } from '@/contexts/competition-context';
import { useApi } from '@/hooks/use-api';
import { useUser } from '@/hooks/use-user';
import { PageHeader } from '@/components/common/page-header';
import { RequireCompetition } from '@/components/common/require-competition';
import { ErrorAlert, Loading } from '@/components/common/states';

import { SlipList } from './slip-view';

export function BetsView(): React.JSX.Element {
  return <RequireCompetition>{(competition) => <Bets competition={competition} />}</RequireCompetition>;
}

// Text people typed (names, horses, notes) is prefixed with ' when it starts like a formula,
// so a spreadsheet shows it as text rather than running it. Money columns stay numeric.
function csvText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? csvCell(`'${value}`) : csvCell(value);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportCsv(slips: Slip[], competition: CompetitionDetail, dayLabel: (id: number) => string): void {
  const header = ['Day', 'Who', 'Bet', 'Bets', 'Each way', 'Stake per bet', 'Staked', 'Returned', 'Profit', 'Horses', 'Status', 'Note'];
  const lines = slips.map((slip) =>
    [
      csvText(dayLabel(slip.day_id)),
      csvText(slip.display_name),
      csvText(betHeadline(slip)),
      csvCell(slip.line_count),
      csvCell(slip.each_way ? 'yes' : 'no'),
      csvCell((slip.unit_stake_pence / 100).toFixed(2)),
      csvCell((slip.stake_pence / 100).toFixed(2)),
      csvCell(slip.return_pence === null ? '' : (slip.return_pence / 100).toFixed(2)),
      csvCell(slip.profit_pence === null ? '' : (slip.profit_pence / 100).toFixed(2)),
      csvText(slip.selections.map((selection) => `${selection.race_time} ${selection.horse_name}`).join('; ')),
      csvCell(slipStatus(slip)),
      csvText(slip.note ?? ''),
    ].join(',')
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${competition.name.replaceAll(/[^\w-]+/g, '-')}-bets.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function Bets({ competition }: { competition: CompetitionDetail }): React.JSX.Element {
  const { user } = useUser();
  const { version, isEntered, dayById } = useCompetition();
  const router = useRouter();
  const search = useSearchParams();
  const whoParam = search.get('who') ?? 'all';
  const [who, setWho] = React.useState<string>(whoParam);
  const [day, setDay] = React.useState<string>(search.get('day') ?? 'all');
  const [status, setStatus] = React.useState<string>(search.get('status') ?? 'all');
  const [type, setType] = React.useState<string>('all');
  const [horse, setHorse] = React.useState<string>('');
  const [showVoid, setShowVoid] = React.useState<boolean>(false);

  const query = new URLSearchParams();
  if (showVoid || status === 'void') {
    query.set('include_void', 'true');
  }
  const slips = useApi<Slip[]>(`/api/competitions/${competition.id}/slips?${query.toString()}`, [version]);

  const update = (key: string, value: string, setter: (value: string) => void): void => {
    setter(value);
    const params = new URLSearchParams(search.toString());
    if (value === 'all') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.replace(`${paths.dashboard.bets}${params.size > 0 ? `?${params.toString()}` : ''}`, { scroll: false });
  };

  const ownerId = who === 'me' ? user?.id : who === 'all' ? null : Number(who);
  const wanted = horseKey(horse);
  const filtered = (slips.data ?? []).filter((slip) => {
    if (ownerId !== null && ownerId !== undefined && slip.user_id !== ownerId) {
      return false;
    }
    if (day !== 'all' && slip.day_id !== Number(day) && slip.settle_day_id !== Number(day)) {
      return false;
    }
    if (status !== 'all' && slipStatus(slip) !== status) {
      return false;
    }
    if (type !== 'all' && slip.bet_type !== type) {
      return false;
    }
    if (wanted && !slip.selections.some((selection) => horseKey(selection.horse_name).includes(wanted))) {
      return false;
    }
    return true;
  });
  const live = filtered.filter((slip) => !slip.voided_at);
  const staked = live.reduce((sum, slip) => sum + slip.stake_pence, 0);
  const returned = live.reduce((sum, slip) => sum + (slip.return_pence ?? 0), 0);
  const pending = live.filter((slip) => slip.return_pence === null).length;
  const types = [...new Set((slips.data ?? []).map((slip) => slip.bet_type))];

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          <>
            {isEntered ? (
              <Button component={RouterLink} href={paths.dashboard.newBet} startIcon={<PlusIcon />} variant="contained">
                Add a bet
              </Button>
            ) : null}
            <Button
              disabled={filtered.length === 0}
              onClick={() => {
                exportCsv(filtered, competition, (id) => dayName(dayById(id)));
              }}
              startIcon={<DownloadSimpleIcon />}
              variant="outlined"
            >
              Download CSV
            </Button>
          </>
        }
        subtitle="Everyone's bets, as soon as they're entered."
        title="All bets"
      />
      <Card>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <TextField
                fullWidth
                label="Who"
                onChange={(event) => {
                  update('who', event.target.value, setWho);
                }}
                select
                size="small"
                value={who}
              >
                <MenuItem value="all">Everyone</MenuItem>
                {isEntered ? <MenuItem value="me">Me</MenuItem> : null}
                {competition.entrants
                  .filter((entrant) => entrant.user_id !== user?.id)
                  .map((entrant) => (
                    <MenuItem key={entrant.user_id} value={String(entrant.user_id)}>
                      {entrant.display_name}
                    </MenuItem>
                  ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <TextField
                fullWidth
                label="Day"
                onChange={(event) => {
                  update('day', event.target.value, setDay);
                }}
                select
                size="small"
                value={day}
              >
                <MenuItem value="all">Every day</MenuItem>
                {competition.days.map((item) => (
                  <MenuItem key={item.id} value={String(item.id)}>
                    {dayName(item)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <TextField
                fullWidth
                label="Status"
                onChange={(event) => {
                  update('status', event.target.value, setStatus);
                }}
                select
                size="small"
                value={status}
              >
                <MenuItem value="all">Any</MenuItem>
                <MenuItem value="pending">Return due</MenuItem>
                <MenuItem value="won">Returned something</MenuItem>
                <MenuItem value="lost">Lost</MenuItem>
                <MenuItem value="void">Void</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, md: 2.4 }}>
              <TextField
                fullWidth
                label="Bet type"
                onChange={(event) => {
                  setType(event.target.value);
                }}
                select
                size="small"
                value={type}
              >
                <MenuItem value="all">Any</MenuItem>
                {types.map((key) => (
                  <MenuItem key={key} value={key}>
                    {(slips.data ?? []).find((slip) => slip.bet_type === key)?.bet_label ?? key}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2.4 }}>
              <TextField
                fullWidth
                label="Horse"
                onChange={(event) => {
                  setHorse(event.target.value);
                }}
                placeholder="Search horses"
                size="small"
                value={horse}
              />
            </Grid>
          </Grid>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', mt: 2 }}
          >
            <Typography color="text.secondary" variant="body2">
              {live.length} bet{live.length === 1 ? '' : 's'} · staked {formatPence(staked)} · returned{' '}
              {formatPence(returned)} ·{' '}
              <Typography color={profitColor(returned - staked)} component="span" variant="inherit">
                {formatProfit(returned - staked)}
              </Typography>
              {pending ? ` · ${pending} return${pending === 1 ? '' : 's'} due` : ''}
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={showVoid}
                  onChange={(event) => {
                    setShowVoid(event.target.checked);
                  }}
                />
              }
              label="Show void bets"
            />
          </Stack>
        </CardContent>
      </Card>
      {slips.error ? <ErrorAlert message={slips.error} onRetry={slips.reload} /> : null}
      {slips.isLoading && !slips.data ? (
        <Loading />
      ) : (
        <SlipList emptyText="No bets match these filters." slips={filtered} />
      )}
    </Stack>
  );
}
