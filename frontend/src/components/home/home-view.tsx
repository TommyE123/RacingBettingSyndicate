'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { CoinsIcon } from '@phosphor-icons/react/dist/ssr/Coins';
import { PlusIcon } from '@phosphor-icons/react/dist/ssr/Plus';
import { TrendUpIcon } from '@phosphor-icons/react/dist/ssr/TrendUp';
import { TrophyIcon } from '@phosphor-icons/react/dist/ssr/Trophy';
import { WalletIcon } from '@phosphor-icons/react/dist/ssr/Wallet';

import type { CompetitionDetail, Slip, Standings } from '@/types/api';
import { paths } from '@/paths';
import { dayName, defaultDay } from '@/lib/days';
import { formatPence, formatProfit, profitColor } from '@/lib/money';
import { useCompetition } from '@/contexts/competition-context';
import { useApi } from '@/hooks/use-api';
import { useUser } from '@/hooks/use-user';
import { SlipList } from '@/components/bets/slip-view';
import { PageHeader } from '@/components/common/page-header';
import { RequireCompetition } from '@/components/common/require-competition';
import { StatCard } from '@/components/common/stat-card';
import { ErrorAlert, Loading } from '@/components/common/states';
import { StandingsTable, TrophyHolders } from '@/components/leaderboard/standings-table';

export function HomeView(): React.JSX.Element {
  return <RequireCompetition>{(competition) => <Home competition={competition} />}</RequireCompetition>;
}

function ordinal(value: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const remainder = value % 100;
  return `${value}${suffixes[(remainder - 20) % 10] ?? suffixes[remainder] ?? suffixes[0]}`;
}

function Home({ competition }: { competition: CompetitionDetail }): React.JSX.Element {
  const { user } = useUser();
  const { version, isEntered, dayById } = useCompetition();
  const standings = useApi<Standings>(`/api/competitions/${competition.id}/standings`, [version]);
  const today = defaultDay(competition.days);
  const mySlips = useApi<Slip[]>(
    isEntered && user ? `/api/competitions/${competition.id}/slips?user_id=${user.id}` : null,
    [version]
  );

  if (standings.isLoading && !standings.data) {
    return <Loading />;
  }
  if (standings.error || !standings.data) {
    return <ErrorAlert message={standings.error ?? 'Could not load the standings'} onRetry={standings.reload} />;
  }
  const table = standings.data;
  const me = table.rows.find((row) => row.user_id === user?.id);
  const todays = (mySlips.data ?? []).filter((slip) => slip.day_id === today?.id || slip.settle_day_id === today?.id);
  const used = me ? Math.min(100, (me.staked_pence / table.budget_pence) * 100) : 0;

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          isEntered ? (
            <>
              <Button component={RouterLink} href={paths.dashboard.newBet} startIcon={<PlusIcon />} variant="contained">
                Add a bet
              </Button>
              <Button component={RouterLink} href={paths.dashboard.returns} startIcon={<CoinsIcon />} variant="outlined">
                Enter returns
              </Button>
            </>
          ) : undefined
        }
        subtitle={today ? `${dayName(today)} · ${formatPence(competition.budget_pence)} each` : undefined}
        title={`Hello, ${user?.display_name ?? ''}`}
      />

      {isEntered ? null : (
        <Alert severity="info">
          You are not entered in {competition.name}, so you can follow along but not bet.
          {user?.role === 'admin' ? ' As an admin you can enter yourself from Competitions.' : ''}
        </Alert>
      )}

      {me ? (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard
              caption={`of ${table.rows.length} · ${me.days_won} day${me.days_won === 1 ? '' : 's'} won`}
              color="#f5a524"
              icon={<TrophyIcon fontSize="var(--icon-fontSize-lg)" />}
              label="Position"
              value={ordinal(me.rank)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard
              caption={`${formatPence(me.returned_pence)} back from ${formatPence(me.staked_pence)}`}
              color="var(--mui-palette-success-main)"
              icon={<TrendUpIcon fontSize="var(--icon-fontSize-lg)" />}
              label="Profit / loss"
              value={formatProfit(me.profit_pence)}
              valueColor={profitColor(me.profit_pence)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard
              color="var(--mui-palette-info-main)"
              icon={<WalletIcon fontSize="var(--icon-fontSize-lg)" />}
              label="Left to bet"
              value={formatPence(me.remaining_pence)}
              valueColor={me.remaining_pence < 0 ? 'error.main' : undefined}
            >
              <Stack spacing={0.5}>
                <LinearProgress
                  color={me.budget_status === 'over' ? 'error' : me.budget_status === 'complete' ? 'success' : 'primary'}
                  sx={{ borderRadius: 4, height: 8 }}
                  value={used}
                  variant="determinate"
                />
                <Typography color="text.secondary" variant="caption">
                  {me.budget_status === 'over'
                    ? `Over budget by ${formatPence(-me.remaining_pence)}: flagged`
                    : me.budget_status === 'complete'
                      ? 'Full budget staked'
                      : `${formatPence(me.staked_pence)} of ${formatPence(table.budget_pence)} staked`}
                </Typography>
              </Stack>
            </StatCard>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard
              caption={
                me.pending_returns ? (
                  <Button component={RouterLink} href={paths.dashboard.returns} size="small" sx={{ ml: -1 }}>
                    Enter them now
                  </Button>
                ) : (
                  'All returns are in'
                )
              }
              color="var(--mui-palette-warning-main)"
              icon={<CoinsIcon fontSize="var(--icon-fontSize-lg)" />}
              label="Returns due"
              value={me.pending_returns}
            />
          </Grid>
        </Grid>
      ) : null}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardHeader
              action={
                <Button component={RouterLink} href={paths.dashboard.leaderboard} size="small">
                  Full leaderboard
                </Button>
              }
              title="Leaderboard"
            />
            <StandingsTable compact standings={table} />
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={3}>
            <TrophyHolders standings={table} />
            <Card>
              <CardHeader title="Daily winners" />
              <CardContent sx={{ pt: 0 }}>
                {table.daily_winners.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    No days settled yet.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {table.daily_winners.map((winner) => (
                      <Stack direction="row" key={winner.day_id} spacing={1.5} sx={{ alignItems: 'center' }}>
                        <Avatar sx={{ bgcolor: 'var(--mui-palette-success-main)', height: 32, width: 32 }}>
                          <TrophyIcon fontSize="var(--icon-fontSize-md)" />
                        </Avatar>
                        <Box sx={{ flex: '1 1 auto' }}>
                          <Typography variant="subtitle2">
                            {winner.user_ids
                              .map((id) => table.rows.find((row) => row.user_id === id)?.display_name ?? '?')
                              .join(' & ')}
                          </Typography>
                          <Typography color="text.secondary" variant="caption">
                            {dayName(dayById(winner.day_id))}
                          </Typography>
                        </Box>
                        <Chip
                          color={winner.profit_pence >= 0 ? 'success' : 'default'}
                          label={formatProfit(winner.profit_pence)}
                          size="small"
                        />
                      </Stack>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {isEntered ? (
        <Card>
          <CardHeader
            action={
              <Button component={RouterLink} href={`${paths.dashboard.bets}?who=me`} size="small">
                All my bets
              </Button>
            }
            subheader={today ? dayName(today) : undefined}
            title="My bets today"
          />
          <CardContent sx={{ pt: 0 }}>
            {mySlips.isLoading && !mySlips.data ? (
              <Loading />
            ) : (
              <SlipList
                emptyText="Nothing entered for today yet. Post your bets before the first race."
                showOwner={false}
                slips={todays}
              />
            )}
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
