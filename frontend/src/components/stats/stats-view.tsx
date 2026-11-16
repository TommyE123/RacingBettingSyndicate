'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import { Chip } from '@/components/common/chip';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { CoinsIcon } from '@phosphor-icons/react/dist/ssr/Coins';
import { FireIcon } from '@phosphor-icons/react/dist/ssr/Fire';
import { HorseIcon } from '@phosphor-icons/react/dist/ssr/Horse';
import { LightningIcon } from '@phosphor-icons/react/dist/ssr/Lightning';
import { RocketLaunchIcon } from '@phosphor-icons/react/dist/ssr/RocketLaunch';
import { SkullIcon } from '@phosphor-icons/react/dist/ssr/Skull';
import { SmileySadIcon } from '@phosphor-icons/react/dist/ssr/SmileySad';
import { TrophyIcon } from '@phosphor-icons/react/dist/ssr/Trophy';

import type { CompetitionDetail, SlipRef, Stats } from '@/types/api';
import { paths } from '@/paths';
import { dayName } from '@/lib/days';
import { formatPence, formatProfit, percent } from '@/lib/money';
import { useCompetition } from '@/contexts/competition-context';
import { useApi } from '@/hooks/use-api';
import { Money, Profit } from '@/components/common/money';
import { PageHeader } from '@/components/common/page-header';
import { RequireCompetition } from '@/components/common/require-competition';
import { EmptyState, ErrorAlert, Loading } from '@/components/common/states';

export function StatsView(): React.JSX.Element {
  return <RequireCompetition>{(competition) => <StatsPage competition={competition} />}</RequireCompetition>;
}

function Award({
  title,
  icon,
  color,
  who,
  value,
  detail,
  href,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  who: string | null;
  value?: React.ReactNode;
  detail?: React.ReactNode;
  href?: string;
}): React.JSX.Element {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Avatar sx={{ bgcolor: color, height: 44, width: 44 }}>{icon}</Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography color="text.secondary" variant="overline">
              {title}
            </Typography>
            {who ? (
              <>
                <Typography variant="h6">{who}</Typography>
                {value ? <Typography variant="subtitle1">{value}</Typography> : null}
                {detail ? (
                  <Typography color="text.secondary" variant="body2">
                    {href ? (
                      <Link component={RouterLink} href={href} underline="hover">
                        {detail}
                      </Link>
                    ) : (
                      detail
                    )}
                  </Typography>
                ) : null}
              </>
            ) : (
              <Typography color="text.secondary" variant="body2">
                Not decided yet
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function StatsPage({ competition }: { competition: CompetitionDetail }): React.JSX.Element {
  const { version, nameOf, dayById, betTypes } = useCompetition();
  const stats = useApi<Stats>(`/api/competitions/${competition.id}/stats`, [version]);

  if (stats.isLoading && !stats.data) {
    return <Loading />;
  }
  if (stats.error || !stats.data) {
    return <ErrorAlert message={stats.error ?? 'Could not load the stats'} onRetry={stats.reload} />;
  }
  const data = stats.data;
  const records = data.records;
  const label = (key: string | null): string => betTypes.find((type) => type.key === key)?.label ?? key ?? '—';
  const slipLine = (ref: SlipRef | null): string =>
    ref ? `${label(ref.bet_type)}: ${formatPence(ref.stake_pence)} staked` : '';
  const people = [...data.people].sort((a, b) => b.slip_count - a.slip_count);
  const sharp = [...data.people]
    .filter((person) => person.strike_rate !== null && person.settled_count >= 3)
    .sort((a, b) => (b.strike_rate ?? 0) - (a.strike_rate ?? 0))[0];
  const hot = [...data.people].sort((a, b) => b.longest_winning_run - a.longest_winning_run)[0];
  const cold = [...data.people].sort((a, b) => b.longest_losing_run - a.longest_losing_run)[0];
  const busiest = people[0];

  if (data.people.every((person) => person.slip_count === 0)) {
    return (
      <Stack spacing={3}>
        <PageHeader title="Stats" />
        <EmptyState
          description="Records, awards and who backed what appear here once bets are in."
          icon={<HorseIcon />}
          title="No bets yet"
        />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader subtitle="Records, awards and bragging rights, worked out from every bet." title="Stats" />

      <Typography variant="h6">Records</Typography>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <Award
            color="#f5a524"
            detail={slipLine(records.biggest_return)}
            href={records.biggest_return ? paths.dashboard.bet(records.biggest_return.slip_id) : undefined}
            icon={<TrophyIcon />}
            title="Biggest return"
            value={formatPence(records.biggest_return?.return_pence)}
            who={records.biggest_return ? nameOf(records.biggest_return.user_id) : null}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <Award
            color="var(--mui-palette-success-main)"
            detail={slipLine(records.best_multiple)}
            href={records.best_multiple ? paths.dashboard.bet(records.best_multiple.slip_id) : undefined}
            icon={<RocketLaunchIcon />}
            title="Bet of the festival (return ÷ stake)"
            value={records.best_multiple ? `${records.best_multiple.multiple}× the stake` : undefined}
            who={records.best_multiple ? nameOf(records.best_multiple.user_id) : null}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <Award
            color="var(--mui-palette-info-main)"
            detail={records.best_day ? dayName(dayById(records.best_day.day_id)) : undefined}
            icon={<LightningIcon />}
            title="Best single day"
            value={formatProfit(records.best_day?.profit_pence)}
            who={records.best_day ? nameOf(records.best_day.user_id) : null}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <Award
            color="var(--mui-palette-error-main)"
            detail={records.worst_day ? dayName(dayById(records.worst_day.day_id)) : undefined}
            icon={<SkullIcon />}
            title="Worst single day"
            value={formatProfit(records.worst_day?.profit_pence)}
            who={records.worst_day && records.worst_day.profit_pence < 0 ? nameOf(records.worst_day.user_id) : null}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <Award
            color="#7a5af8"
            detail={slipLine(records.biggest_losing_stake)}
            href={records.biggest_losing_stake ? paths.dashboard.bet(records.biggest_losing_stake.slip_id) : undefined}
            icon={<SmileySadIcon />}
            title="The donation (biggest stake that lost)"
            value={formatPence(records.biggest_losing_stake?.stake_pence)}
            who={records.biggest_losing_stake ? nameOf(records.biggest_losing_stake.user_id) : null}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <Award
            color="var(--mui-palette-warning-main)"
            detail={slipLine(records.biggest_single_stake)}
            href={records.biggest_single_stake ? paths.dashboard.bet(records.biggest_single_stake.slip_id) : undefined}
            icon={<CoinsIcon />}
            title="Biggest single stake"
            value={formatPence(records.biggest_single_stake?.stake_pence)}
            who={records.biggest_single_stake ? nameOf(records.biggest_single_stake.user_id) : null}
          />
        </Grid>
      </Grid>

      <Typography variant="h6">Awards</Typography>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Award
            color="var(--mui-palette-success-main)"
            detail={sharp ? `${sharp.winning_count} of ${sharp.settled_count} bets returned something` : undefined}
            icon={<TrophyIcon />}
            title="Sharpshooter"
            value={sharp ? percent(sharp.strike_rate) : undefined}
            who={sharp ? nameOf(sharp.user_id) : null}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Award
            color="#f04438"
            detail="winners in a row"
            icon={<FireIcon />}
            title="Hot streak"
            value={hot?.longest_winning_run}
            who={hot && hot.longest_winning_run > 0 ? nameOf(hot.user_id) : null}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Award
            color="var(--mui-palette-neutral-500)"
            detail="losers in a row"
            icon={<SmileySadIcon />}
            title="Cold streak"
            value={cold?.longest_losing_run}
            who={cold && cold.longest_losing_run > 0 ? nameOf(cold.user_id) : null}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Award
            color="#7a5af8"
            detail="bets placed"
            icon={<HorseIcon />}
            title="The Maurizio award"
            value={busiest?.slip_count}
            who={busiest && busiest.slip_count > 0 ? nameOf(busiest.user_id) : null}
          />
        </Grid>
        {data.comebacks[0] ? (
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <Award
              color="var(--mui-palette-info-main)"
              detail="places climbed from their lowest point"
              icon={<RocketLaunchIcon />}
              title="Comeback of the week"
              value={data.comebacks[0].places_climbed}
              who={nameOf(data.comebacks[0].user_id)}
            />
          </Grid>
        ) : null}
      </Grid>

      <Card>
        <CardHeader subheader="How everyone bets" title="Punter profiles" />
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 820 }}>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="right">Bets</TableCell>
                <TableCell align="right">Strike rate</TableCell>
                <TableCell>Favourite bet</TableCell>
                <TableCell align="right">Average stake</TableCell>
                <TableCell align="right">Each way</TableCell>
                <TableCell align="right">Biggest bet (of budget)</TableCell>
                <TableCell align="right">Best run</TableCell>
                <TableCell align="right">Worst run</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {people.map((person) => (
                <TableRow hover key={person.user_id}>
                  <TableCell>{nameOf(person.user_id)}</TableCell>
                  <TableCell align="right">{person.slip_count}</TableCell>
                  <TableCell align="right">
                    {person.strike_rate === null
                      ? '—'
                      : `${percent(person.strike_rate)} (${person.winning_count}/${person.settled_count})`}
                  </TableCell>
                  <TableCell>{label(person.favourite_bet_type)}</TableCell>
                  <TableCell align="right">
                    <Money pence={person.average_stake_pence} />
                  </TableCell>
                  <TableCell align="right">{percent(person.each_way_share)}</TableCell>
                  <TableCell align="right">{percent(person.biggest_stake_share_of_budget)}</TableCell>
                  <TableCell align="right">{person.longest_winning_run}</TableCell>
                  <TableCell align="right">{person.longest_losing_run}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader subheader="Settled bets only for the profit column" title="Do Lucky 15s pay?" />
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 520 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Bet type</TableCell>
                    <TableCell align="right">Bets</TableCell>
                    <TableCell align="right">Staked</TableCell>
                    <TableCell align="right">Returned</TableCell>
                    <TableCell align="right">Profit (settled)</TableCell>
                    <TableCell align="right">Won</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.bet_types.map((row) => (
                    <TableRow hover key={row.bet_type}>
                      <TableCell>{row.label}</TableCell>
                      <TableCell align="right">{row.slip_count}</TableCell>
                      <TableCell align="right">
                        <Money pence={row.staked_pence} />
                      </TableCell>
                      <TableCell align="right">
                        <Money pence={row.returned_pence} />
                      </TableCell>
                      <TableCell align="right">
                        <Profit pence={row.settled_returned_pence - row.settled_staked_pence} />
                      </TableCell>
                      <TableCell align="right">
                        {row.settled_count ? `${row.winning_count}/${row.settled_count}` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Each way or win only?" />
            <CardContent sx={{ pt: 0 }}>
              <Stack spacing={2}>
                {data.styles.map((style) => (
                  <Stack direction="row" key={String(style.each_way)} spacing={2} sx={{ justifyContent: 'space-between' }}>
                    <div>
                      <Typography variant="subtitle2">{style.each_way ? 'Each way' : 'Win only'}</Typography>
                      <Typography color="text.secondary" variant="caption">
                        {style.slip_count} bets · {formatPence(style.staked_pence)} staked
                      </Typography>
                    </div>
                    <Profit pence={style.returned_pence - style.staked_pence} />
                  </Stack>
                ))}
                <Typography color="text.secondary" variant="caption">
                  Profit here counts returns not yet entered as nothing.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardHeader subheader={`${data.horse_count} different horses backed`} title="Most backed horses" />
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Horse</TableCell>
                    <TableCell align="right">People</TableCell>
                    <TableCell align="right">Bets</TableCell>
                    <TableCell>Backed by</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.horses.slice(0, 15).map((horse) => (
                    <TableRow hover key={horse.horse_name}>
                      <TableCell>
                        <Tooltip title={horse.spellings.length > 1 ? `Also written ${horse.spellings.join(', ')}` : ''}>
                          <span>{horse.horse_name}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">{horse.backer_count}</TableCell>
                      <TableCell align="right">{horse.slip_count}</TableCell>
                      <TableCell>
                        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                          {horse.user_ids.map((id) => (
                            <Chip key={id} label={nameOf(id)} size="small" variant="outlined" />
                          ))}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Stack spacing={3}>
            <Card>
              <CardHeader subheader="Pairs who keep backing the same horses" title="Copycats" />
              <CardContent sx={{ pt: 0 }}>
                {data.copycats.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    Nobody has shared a horse yet.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {data.copycats.slice(0, 5).map((pair) => (
                      <Stack direction="row" key={pair.user_ids.join('-')} sx={{ justifyContent: 'space-between' }}>
                        <Typography variant="body2">
                          {nameOf(pair.user_ids[0])} & {nameOf(pair.user_ids[1])}
                        </Typography>
                        <Typography color="text.secondary" variant="body2">
                          {pair.shared_count} shared · {percent(pair.overlap)} overlap
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader subheader="Horses only one person backed" title="Lone wolves" />
              <CardContent sx={{ pt: 0 }}>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {data.lone_picks.slice(0, 20).map((horse) => (
                    <Chip key={horse.horse_name} label={`${horse.horse_name} · ${nameOf(horse.user_ids[0])}`} size="small" />
                  ))}
                  {data.lone_picks.length === 0 ? (
                    <Typography color="text.secondary" variant="body2">
                      None.
                    </Typography>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}
