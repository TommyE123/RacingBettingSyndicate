'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import type { ApexOptions } from 'apexcharts';

import type { CompetitionDetail, Standings } from '@/types/api';
import { dayName, shortDayName } from '@/lib/days';
import { formatPence, formatProfit } from '@/lib/money';
import { escapeHtml } from '@/lib/text';
import { useCompetition } from '@/contexts/competition-context';
import { useApi } from '@/hooks/use-api';
import { Chart } from '@/components/core/chart';
import { PageHeader } from '@/components/common/page-header';
import { RequireCompetition } from '@/components/common/require-competition';
import { StatCard } from '@/components/common/stat-card';
import { ErrorAlert, Loading } from '@/components/common/states';

import { StandingsTable, TrophyHolders } from './standings-table';

export function LeaderboardView(): React.JSX.Element {
  return <RequireCompetition>{(competition) => <Leaderboard competition={competition} />}</RequireCompetition>;
}

function Leaderboard({ competition }: { competition: CompetitionDetail }): React.JSX.Element {
  const { version } = useCompetition();
  const standings = useApi<Standings>(`/api/competitions/${competition.id}/standings`, [version]);

  if (standings.isLoading && !standings.data) {
    return <Loading />;
  }
  if (standings.error || !standings.data) {
    return <ErrorAlert message={standings.error ?? 'Could not load the leaderboard'} onRetry={standings.reload} />;
  }
  const table = standings.data;
  const totals = table.totals;

  return (
    <Stack spacing={3}>
      <PageHeader
        subtitle="Ranked on profit: returns entered so far, minus everything staked. Returns not yet entered count as nothing."
        title="Leaderboard"
      />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Staked by everyone" value={formatPence(totals.staked_pence)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Returned" value={formatPence(totals.returned_pence)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Syndicate profit"
            value={formatProfit(totals.returned_pence - totals.staked_pence)}
            valueColor={totals.returned_pence >= totals.staked_pence ? 'success.main' : 'error.main'}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard caption={`${totals.slip_count} bets in all`} label="Returns still due" value={totals.pending_returns} />
        </Grid>
      </Grid>
      <Card>
        <StandingsTable standings={table} />
      </Card>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <PositionChart standings={table} />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={3}>
            <TrophyHolders standings={table} />
            <DailyWinners standings={table} />
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}

function DailyWinners({ standings }: { standings: Standings }): React.JSX.Element {
  const { dayById } = useCompetition();
  const nameOf = (id: number): string => standings.rows.find((row) => row.user_id === id)?.display_name ?? '?';
  return (
    <Card>
      <CardHeader title="Winner each day" />
      <CardContent sx={{ pt: 0 }}>
        {standings.daily_winners.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            Nothing settled yet.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {standings.daily_winners.map((winner) => (
              <Stack direction="row" key={winner.day_id} spacing={2} sx={{ justifyContent: 'space-between' }}>
                <div>
                  <Typography variant="subtitle2">{winner.user_ids.map((id) => nameOf(id)).join(' & ')}</Typography>
                  <Typography color="text.secondary" variant="caption">
                    {dayName(dayById(winner.day_id))}
                  </Typography>
                </div>
                <Typography color={winner.profit_pence >= 0 ? 'success.main' : 'text.secondary'} variant="subtitle2">
                  {formatProfit(winner.profit_pence)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function PositionChart({ standings }: { standings: Standings }): React.JSX.Element {
  const { competition } = useCompetition();
  const [mode, setMode] = React.useState<'profit' | 'rank' | 'staked'>('profit');
  const days = competition?.days ?? [];
  const series = standings.rows.map((row) => ({
    // ApexCharts writes series names into its legend and tooltip as HTML.
    name: escapeHtml(row.display_name),
    data: row.days.map((day) =>
      mode === 'rank'
        ? day.rank
        : mode === 'staked'
          ? day.cumulative_staked_pence / 100
          : day.cumulative_profit_pence / 100
    ),
  }));
  const options: ApexOptions = {
    chart: { background: 'transparent', toolbar: { show: false }, zoom: { enabled: false } },
    stroke: { curve: 'smooth', width: 3 },
    markers: { size: 4 },
    legend: { position: 'bottom' },
    xaxis: { categories: days.map((day) => shortDayName(day)) },
    yaxis: {
      reversed: mode === 'rank',
      min: mode === 'rank' ? 1 : undefined,
      forceNiceScale: mode !== 'rank',
      labels: {
        formatter: (value: number) =>
          mode === 'rank' ? String(Math.round(value)) : `£${Math.round(value).toLocaleString('en-GB')}`,
      },
    },
    tooltip: {
      y: {
        formatter: (value: number) =>
          mode === 'rank' ? `${value}` : mode === 'staked' ? formatPence(value * 100) : formatProfit(Math.round(value * 100)),
      },
    },
    theme: { mode: 'light' },
  };
  return (
    <Card>
      <CardHeader
        action={
          <ToggleButtonGroup
            exclusive
            onChange={(_, value: 'profit' | 'rank' | 'staked' | null) => {
              if (value) {
                setMode(value);
              }
            }}
            size="small"
            value={mode}
          >
            <ToggleButton value="profit">Profit</ToggleButton>
            <ToggleButton value="rank">Position</ToggleButton>
            <ToggleButton value="staked">Staked</ToggleButton>
          </ToggleButtonGroup>
        }
        title="Through the week"
      />
      <CardContent sx={{ pt: 0 }}>
        {days.length === 0 || standings.rows.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            The chart appears once there are days and entrants.
          </Typography>
        ) : (
          <Box sx={{ minHeight: 320 }}>
            <Chart height={320} options={options} series={series} type="line" width="100%" />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
