'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import { Chip } from '@/components/common/chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { CoinsIcon } from '@phosphor-icons/react/dist/ssr/Coins';
import { ImageIcon } from '@phosphor-icons/react/dist/ssr/Image';
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/ssr/PencilSimple';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr/Warning';

import type { Slip } from '@/types/api';
import { paths } from '@/paths';
import { betHeadline, slipStatus, stakeBreakdown } from '@/lib/bets';
import { shortDayName } from '@/lib/days';
import { useCompetition } from '@/contexts/competition-context';
import { useUser } from '@/hooks/use-user';
import { Money, Profit } from '@/components/common/money';

import { ReturnDialog } from './slip-dialogs';

export function StatusChip({ slip }: { slip: Slip }): React.JSX.Element {
  const status = slipStatus(slip);
  if (status === 'void') {
    return <Chip label="Void" size="small" variant="outlined" />;
  }
  if (status === 'pending') {
    return <Chip color="warning" label="Return due" size="small" variant="outlined" />;
  }
  return status === 'won' ? (
    <Chip color="success" label="Returned" size="small" />
  ) : (
    <Chip color="error" label="Lost" size="small" variant="outlined" />
  );
}

export function SelectionsList({ slip, dense }: { slip: Slip; dense?: boolean }): React.JSX.Element {
  const { dayById } = useCompetition();
  return (
    <Stack component="ol" spacing={dense ? 0.25 : 0.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {slip.selections.map((selection) => (
        <Typography component="li" key={selection.position} variant="body2">
          <Box component="span" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums', mr: 1 }}>
            {selection.day_id === slip.day_id ? '' : `${shortDayName(dayById(selection.day_id))} `}
            {selection.race_time}
          </Box>
          <Box component="span" sx={{ fontWeight: 500 }}>
            {selection.horse_name}
          </Box>
          {selection.note ? (
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {' '}
              ({selection.note})
            </Box>
          ) : null}
        </Typography>
      ))}
    </Stack>
  );
}

export function canManage(slip: Slip, userId: number | undefined, isAdmin: boolean): boolean {
  return isAdmin || slip.user_id === userId;
}

function Flags({ slip }: { slip: Slip }): React.JSX.Element | null {
  const flags: React.ReactNode[] = [];
  if (slip.over_budget && !slip.voided_at) {
    flags.push(
      <Tooltip key="budget" title="This person has staked more than the budget">
        <Chip color="error" icon={<WarningIcon />} label="Over budget" size="small" />
      </Tooltip>
    );
  }
  if (slip.created_by !== slip.user_id) {
    flags.push(<Chip key="by" label={`Entered by ${slip.created_by_name}`} size="small" variant="outlined" />);
  }
  if (slip.sheet_id) {
    flags.push(
      <Chip
        clickable
        component={RouterLink}
        href={paths.dashboard.sheet(slip.sheet_id)}
        icon={<ImageIcon />}
        key="sheet"
        label="Sheet"
        size="small"
        variant="outlined"
      />
    );
  }
  return flags.length > 0 ? (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
      {flags}
    </Stack>
  ) : null;
}

export function SlipCard({
  slip,
  showOwner = true,
  onReturn,
}: {
  slip: Slip;
  showOwner?: boolean;
  onReturn?: (slip: Slip) => void;
}): React.JSX.Element {
  const { user, isAdmin } = useUser();
  const { dayById } = useCompetition();
  const manage = canManage(slip, user?.id, isAdmin);
  const isVoid = Boolean(slip.voided_at);

  return (
    <Card sx={{ height: '100%', opacity: isVoid ? 0.6 : 1 }} variant="outlined">
      <CardContent sx={{ pb: 1 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              {showOwner ? (
                <Typography color="text.secondary" variant="caption">
                  {slip.display_name} · {shortDayName(dayById(slip.day_id))}
                </Typography>
              ) : (
                <Typography color="text.secondary" variant="caption">
                  {shortDayName(dayById(slip.day_id))}
                </Typography>
              )}
              <Link
                color="text.primary"
                component={RouterLink}
                href={paths.dashboard.bet(slip.id)}
                sx={{ display: 'block', textDecoration: isVoid ? 'line-through' : undefined }}
                underline="hover"
                variant="subtitle1"
              >
                {betHeadline(slip)}
              </Link>
              <Typography color="text.secondary" variant="caption">
                {stakeBreakdown(slip)}
              </Typography>
            </div>
            <StatusChip slip={slip} />
          </Stack>
          <SelectionsList slip={slip} />
          {slip.note ? (
            <Typography color="text.secondary" sx={{ fontStyle: 'italic' }} variant="body2">
              {slip.note}
            </Typography>
          ) : null}
          <Flags slip={slip} />
        </Stack>
      </CardContent>
      <Divider />
      <CardActions sx={{ justifyContent: 'space-between', px: 2 }}>
        <Stack direction="row" spacing={2}>
          <div>
            <Typography color="text.secondary" variant="caption">
              Staked
            </Typography>
            <Typography variant="body2">
              <Money pence={slip.stake_pence} />
            </Typography>
          </div>
          <div>
            <Typography color="text.secondary" variant="caption">
              Returned
            </Typography>
            <Typography variant="body2">
              <Money pence={slip.return_pence} />
            </Typography>
          </div>
          <div>
            <Typography color="text.secondary" variant="caption">
              Profit
            </Typography>
            <Typography variant="body2">
              <Profit pence={slip.profit_pence} />
            </Typography>
          </div>
        </Stack>
        {manage && !isVoid ? (
          <Stack direction="row" spacing={0.5}>
            {onReturn ? (
              <Tooltip title="Enter the return">
                <IconButton
                  aria-label="Enter the return"
                  color={slip.return_pence === null ? 'warning' : 'default'}
                  onClick={() => {
                    onReturn(slip);
                  }}
                >
                  <CoinsIcon />
                </IconButton>
              </Tooltip>
            ) : null}
            <Tooltip title="Open or edit">
              <IconButton aria-label="Open or edit" component={RouterLink} href={paths.dashboard.bet(slip.id)}>
                <PencilSimpleIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        ) : null}
      </CardActions>
    </Card>
  );
}

// Cards on phones, a dense table on wider screens.
export function SlipList({
  slips,
  showOwner = true,
  emptyText = 'No bets yet.',
  onSlipChanged,
}: {
  slips: Slip[];
  showOwner?: boolean;
  emptyText?: string;
  // For lists held locally rather than loaded from the API, so they show saved returns.
  onSlipChanged?: (slip: Slip) => void;
}): React.JSX.Element {
  const wide = useMediaQuery('(min-width:900px)');
  const [returning, setReturning] = React.useState<Slip | null>(null);
  const { user, isAdmin } = useUser();
  const { dayById } = useCompetition();

  if (slips.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 2 }} variant="body2">
        {emptyText}
      </Typography>
    );
  }

  const dialog = (
    <ReturnDialog
      onClose={() => {
        setReturning(null);
      }}
      onSaved={onSlipChanged}
      slip={returning}
    />
  );

  if (!wide) {
    return (
      <Stack spacing={2}>
        {slips.map((slip) => (
          <SlipCard key={slip.id} onReturn={setReturning} showOwner={showOwner} slip={slip} />
        ))}
        {dialog}
      </Stack>
    );
  }

  return (
    <Card variant="outlined">
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow>
              <TableCell>Day</TableCell>
              {showOwner ? <TableCell>Who</TableCell> : null}
              <TableCell>Bet</TableCell>
              <TableCell>Horses</TableCell>
              <TableCell align="right">Staked</TableCell>
              <TableCell align="right">Returned</TableCell>
              <TableCell align="right">Profit</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {slips.map((slip) => {
              const manage = canManage(slip, user?.id, isAdmin) && !slip.voided_at;
              return (
                <TableRow hover key={slip.id} sx={{ opacity: slip.voided_at ? 0.55 : 1, verticalAlign: 'top' }}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{shortDayName(dayById(slip.day_id))}</TableCell>
                  {showOwner ? <TableCell sx={{ whiteSpace: 'nowrap' }}>{slip.display_name}</TableCell> : null}
                  <TableCell>
                    <Link
                      color="text.primary"
                      component={RouterLink}
                      href={paths.dashboard.bet(slip.id)}
                      sx={{ textDecoration: slip.voided_at ? 'line-through' : undefined, whiteSpace: 'nowrap' }}
                      underline="hover"
                      variant="subtitle2"
                    >
                      {betHeadline(slip)}
                    </Link>
                    <Typography color="text.secondary" sx={{ display: 'block' }} variant="caption">
                      {stakeBreakdown(slip)}
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Flags slip={slip} />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <SelectionsList dense slip={slip} />
                  </TableCell>
                  <TableCell align="right">
                    <Money pence={slip.stake_pence} />
                  </TableCell>
                  <TableCell align="right">
                    <Money pence={slip.return_pence} />
                  </TableCell>
                  <TableCell align="right">
                    <Profit pence={slip.profit_pence} />
                  </TableCell>
                  <TableCell>
                    <StatusChip slip={slip} />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {manage ? (
                      <Button
                        color={slip.return_pence === null ? 'warning' : 'inherit'}
                        onClick={() => {
                          setReturning(slip);
                        }}
                        size="small"
                        startIcon={<CoinsIcon />}
                      >
                        {slip.return_pence === null ? 'Return' : 'Change'}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
      {dialog}
    </Card>
  );
}
