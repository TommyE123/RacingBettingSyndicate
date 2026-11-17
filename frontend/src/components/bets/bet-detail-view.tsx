'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import { useParams } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react/dist/ssr/ArrowCounterClockwise';
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/ssr/ArrowLeft';
import { CoinsIcon } from '@phosphor-icons/react/dist/ssr/Coins';
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/ssr/PencilSimple';
import { ProhibitIcon } from '@phosphor-icons/react/dist/ssr/Prohibit';

import type { AuditEntry, Slip } from '@/types/api';
import { paths } from '@/paths';
import { errorMessage } from '@/lib/api';
import { betHeadline, stakeBreakdown } from '@/lib/bets';
import { dayName, formatDateTime } from '@/lib/days';
import { useCompetition } from '@/contexts/competition-context';
import { useNotify } from '@/contexts/notify-context';
import { useApi } from '@/hooks/use-api';
import { useUser } from '@/hooks/use-user';
import { AuditDetail, describeAction } from '@/components/admin/audit-detail';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Money, Profit } from '@/components/common/money';
import { ErrorAlert, Loading } from '@/components/common/states';

import { SlipForm } from './slip-form';
import { ReturnDialog, restoreSlip, VoidDialog } from './slip-dialogs';
import { canManage, SelectionsList, StatusChip } from './slip-view';

export function BetDetailView(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { version, dayById, bump } = useCompetition();
  const { user, isAdmin } = useUser();
  const notify = useNotify();
  const slip = useApi<Slip>(Number.isFinite(id) ? `/api/slips/${id}` : null, [version]);
  const history = useApi<AuditEntry[]>(Number.isFinite(id) ? `/api/slips/${id}/history` : null, [version]);
  const [editing, setEditing] = React.useState(false);
  const [returning, setReturning] = React.useState<Slip | null>(null);
  const [voiding, setVoiding] = React.useState<Slip | null>(null);
  const [restoreWarning, setRestoreWarning] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  if (slip.isLoading && !slip.data) {
    return <Loading />;
  }
  if (slip.error || !slip.data) {
    return <ErrorAlert message={slip.error ?? 'Bet not found'} />;
  }
  const bet = slip.data;
  // A bet from another competition can be viewed but not changed until that competition is
  // selected, so edits never mix one competition's days with another's bet.
  const inThisCompetition = dayById(bet.day_id) !== undefined;
  const manage = canManage(bet, user?.id, isAdmin) && inThisCompetition;
  const isVoid = Boolean(bet.voided_at);

  const restore = async (confirm: boolean): Promise<void> => {
    setBusy(true);
    try {
      const result = await restoreSlip(bet, confirm);
      if (result.overBudget) {
        setRestoreWarning(result.overBudget);
      } else {
        setRestoreWarning(null);
        notify('Bet restored');
        bump();
      }
    } catch (error) {
      notify(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={3}>
      <div>
        <Button component={RouterLink} href={paths.dashboard.bets} startIcon={<ArrowLeftIcon />}>
          All bets
        </Button>
      </div>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <div>
          <Typography color="text.secondary" variant="body2">
            {bet.display_name} · {dayName(dayById(bet.day_id))}
          </Typography>
          <Typography sx={{ textDecoration: isVoid ? 'line-through' : undefined }} variant="h4">
            {betHeadline(bet)}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {stakeBreakdown(bet)}
          </Typography>
        </div>
        {manage ? (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {isVoid ? (
              <Button
                disabled={busy}
                onClick={() => {
                  restore(false).catch(() => {
                    // restore reports its own errors
                  });
                }}
                startIcon={<ArrowCounterClockwiseIcon />}
                variant="contained"
              >
                Restore
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => {
                    setReturning(bet);
                  }}
                  startIcon={<CoinsIcon />}
                  variant="contained"
                >
                  {bet.return_pence === null ? 'Enter return' : 'Change return'}
                </Button>
                <Button
                  onClick={() => {
                    setEditing((value) => !value);
                  }}
                  startIcon={<PencilSimpleIcon />}
                  variant="outlined"
                >
                  {editing ? 'Stop editing' : 'Edit'}
                </Button>
                <Button
                  color="error"
                  onClick={() => {
                    setVoiding(bet);
                  }}
                  startIcon={<ProhibitIcon />}
                  variant="outlined"
                >
                  Void
                </Button>
              </>
            )}
          </Stack>
        ) : null}
      </Stack>

      {inThisCompetition ? null : (
        <Alert severity="info">
          This bet belongs to another competition. Switch to it in the competition picker to change it.
        </Alert>
      )}
      {isVoid ? (
        <Alert severity="warning">
          Voided {bet.voided_at ? formatDateTime(bet.voided_at) : ''}
          {bet.void_reason ? `: ${bet.void_reason}` : ''}. It does not count towards the budget or the leaderboard.
        </Alert>
      ) : null}
      {bet.over_budget && !isVoid ? (
        <Alert severity="error">{bet.display_name} has staked more than the budget, so this is flagged.</Alert>
      ) : null}

      {editing && !isVoid ? (
        <SlipForm
          onCancel={() => {
            setEditing(false);
          }}
          onSaved={() => {
            setEditing(false);
            notify('Bet updated');
          }}
          slip={bet}
        />
      ) : (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Card>
              <CardHeader action={<StatusChip slip={bet} />} title="Horses" />
              <CardContent sx={{ pt: 0 }}>
                <SelectionsList slip={bet} />
                {bet.note ? (
                  <Typography color="text.secondary" sx={{ fontStyle: 'italic', mt: 2 }} variant="body2">
                    {bet.note}
                  </Typography>
                ) : null}
                {bet.sheet_id ? (
                  <Button component={RouterLink} href={paths.dashboard.sheet(bet.sheet_id)} size="small" sx={{ mt: 2 }}>
                    View the sheet it came from
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Card>
              <CardHeader title="Money" />
              <CardContent sx={{ pt: 0 }}>
                <Stack spacing={1.5}>
                  <Row label="Staked" value={<Money pence={bet.stake_pence} />} />
                  <Row
                    label="Returned"
                    value={bet.return_pence === null ? <Typography color="warning.main">Not entered yet</Typography> : <Money pence={bet.return_pence} />}
                  />
                  <Row label="Profit" value={<Profit pence={bet.profit_pence} />} />
                  <Row label="Return counts on" value={dayName(dayById(bet.settle_day_id))} />
                  <Row label="Entered by" value={`${bet.created_by_name}, ${formatDateTime(bet.created_at)}`} />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Card>
        <CardHeader subheader="Every change to this bet, who made it and when." title="History" />
        <CardContent sx={{ pt: 0 }}>
          {history.data && history.data.length > 0 ? (
            <Stack spacing={2}>
              {history.data.map((entry) => (
                <Box key={entry.id} sx={{ borderLeft: '3px solid var(--mui-palette-divider)', pl: 2 }}>
                  <Typography variant="subtitle2">
                    {describeAction(entry.action)} by {entry.actor_name ?? 'the system'}
                  </Typography>
                  <Typography color="text.secondary" variant="caption">
                    {formatDateTime(entry.at)}
                  </Typography>
                  <AuditDetail entry={entry} />
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography color="text.secondary" variant="body2">
              {history.isLoading ? 'Loading…' : 'No history.'}
            </Typography>
          )}
        </CardContent>
      </Card>

      <ReturnDialog
        onClose={() => {
          setReturning(null);
        }}
        slip={returning}
      />
      <VoidDialog
        onClose={() => {
          setVoiding(null);
        }}
        slip={voiding}
      />
      <ConfirmDialog
        busy={busy}
        confirmLabel="Restore and flag it"
        message={restoreWarning ?? ''}
        onCancel={() => {
          setRestoreWarning(null);
        }}
        onConfirm={() => {
          restore(true).catch(() => {
            // restore reports its own errors
          });
        }}
        open={restoreWarning !== null}
        title="Over the budget"
      />
    </Stack>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
      <Typography color="text.secondary" variant="body2">
        {label}
      </Typography>
      <Typography component="div" sx={{ textAlign: 'right' }} variant="body2">
        {value}
      </Typography>
    </Stack>
  );
}
