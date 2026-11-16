'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { SkullIcon } from '@phosphor-icons/react/dist/ssr/Skull';
import { TrophyIcon } from '@phosphor-icons/react/dist/ssr/Trophy';

import type { BudgetStatus, Standings } from '@/types/api';
import { shortDayName } from '@/lib/days';
import { formatPence } from '@/lib/money';
import { useCompetition } from '@/contexts/competition-context';
import { useUser } from '@/hooks/use-user';
import { Money, Profit } from '@/components/common/money';

export function BudgetChip({ status, remaining }: { status: BudgetStatus; remaining: number }): React.JSX.Element {
  if (status === 'over') {
    return <Chip color="error" label={`Over by ${formatPence(-remaining)}`} size="small" />;
  }
  if (status === 'complete') {
    return <Chip color="success" label="All staked" size="small" variant="outlined" />;
  }
  return <Chip label={`${formatPence(remaining)} left`} size="small" variant="outlined" />;
}

export function StandingsTable({ standings, compact }: { standings: Standings; compact?: boolean }): React.JSX.Element {
  const { user } = useUser();
  const { competition } = useCompetition();
  const days = competition?.days ?? [];
  const bob = new Set(standings.bob_addis_user_ids);
  const jfk = new Set(standings.jfk_user_ids);
  const showTrophies = standings.totals.slip_count > 0;

  if (standings.rows.length === 0) {
    return (
      <CardContent>
        <Typography color="text.secondary" variant="body2">
          Nobody is entered yet.
        </Typography>
      </CardContent>
    );
  }

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size={compact ? 'small' : 'medium'} sx={{ minWidth: compact ? 520 : 800 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 48 }}>#</TableCell>
            <TableCell>Name</TableCell>
            <TableCell align="right">Profit</TableCell>
            {compact ? null : <TableCell align="right">Staked</TableCell>}
            {compact ? null : <TableCell align="right">Returned</TableCell>}
            <TableCell>Budget</TableCell>
            {compact ? null : <TableCell align="center">Returns due</TableCell>}
            {compact ? null : <TableCell align="center">Days won</TableCell>}
            {compact
              ? null
              : days.map((day) => (
                  <TableCell align="right" key={day.id} sx={{ whiteSpace: 'nowrap' }}>
                    {shortDayName(day)}
                  </TableCell>
                ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {standings.rows.map((row) => (
            <TableRow
              hover
              key={row.user_id}
              selected={row.user_id === user?.id}
              sx={{ '&.Mui-selected': { bgcolor: 'var(--mui-palette-action-selected)' } }}
            >
              <TableCell sx={{ fontWeight: 700 }}>{row.rank}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography variant="subtitle2">{row.display_name}</Typography>
                  {showTrophies && bob.has(row.user_id) ? (
                    <Tooltip title="Heading for the Bob Addis Memorial Trophy">
                      <Box sx={{ color: '#f5a524', lineHeight: 0 }}>
                        <TrophyIcon weight="fill" />
                      </Box>
                    </Tooltip>
                  ) : null}
                  {showTrophies && jfk.has(row.user_id) && !bob.has(row.user_id) ? (
                    <Tooltip title="Heading for the JFK Blowout Trophy">
                      <Box sx={{ color: 'text.secondary', lineHeight: 0 }}>
                        <SkullIcon weight="fill" />
                      </Box>
                    </Tooltip>
                  ) : null}
                </Stack>
                {compact && row.pending_returns ? (
                  <Typography color="warning.main" variant="caption">
                    {row.pending_returns} return{row.pending_returns === 1 ? '' : 's'} due
                  </Typography>
                ) : null}
              </TableCell>
              <TableCell align="right">
                <Profit pence={row.profit_pence} />
              </TableCell>
              {compact ? null : (
                <TableCell align="right">
                  <Money pence={row.staked_pence} />
                </TableCell>
              )}
              {compact ? null : (
                <TableCell align="right">
                  <Money pence={row.returned_pence} />
                </TableCell>
              )}
              <TableCell>
                <BudgetChip remaining={row.remaining_pence} status={row.budget_status} />
              </TableCell>
              {compact ? null : (
                <TableCell align="center">
                  {row.pending_returns ? (
                    <Chip color="warning" label={row.pending_returns} size="small" variant="outlined" />
                  ) : (
                    '—'
                  )}
                </TableCell>
              )}
              {compact ? null : <TableCell align="center">{row.days_won || '—'}</TableCell>}
              {compact
                ? null
                : row.days.map((day) => (
                    <TableCell align="right" key={day.day_id}>
                      {day.staked_pence || day.returned_pence ? <Profit pence={day.profit_pence} /> : '—'}
                    </TableCell>
                  ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

export function TrophyHolders({ standings }: { standings: Standings }): React.JSX.Element {
  const name = (ids: number[]): string =>
    ids.map((id) => standings.rows.find((row) => row.user_id === id)?.display_name ?? '?').join(' & ') || '—';
  const settled = standings.totals.slip_count > 0;
  return (
    <Card>
      <CardHeader subheader={settled ? 'If it all ended now' : 'Up for grabs once the betting starts'} title="Trophies" />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Box sx={{ color: '#f5a524', lineHeight: 0 }}>
              <TrophyIcon fontSize={36} weight="fill" />
            </Box>
            <div>
              <Typography variant="subtitle2">Bob Addis Memorial Trophy</Typography>
              <Typography color="text.secondary" variant="body2">
                {settled ? name(standings.bob_addis_user_ids) : 'Most profit'}
              </Typography>
            </div>
          </Stack>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Box sx={{ color: 'text.secondary', lineHeight: 0 }}>
              <SkullIcon fontSize={36} weight="fill" />
            </Box>
            <div>
              <Typography variant="subtitle2">JFK Blowout Trophy</Typography>
              <Typography color="text.secondary" variant="body2">
                {settled ? name(standings.jfk_user_ids) : 'Biggest loss'}
              </Typography>
            </div>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
