'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import type { Slip } from '@/types/api';
import { api, ApiError, errorMessage } from '@/lib/api';
import { betHeadline } from '@/lib/bets';
import { formatPence, formatProfit, parsePounds, penceToInput, profitColor } from '@/lib/money';
import { useCompetition } from '@/contexts/competition-context';
import { useNotify } from '@/contexts/notify-context';
import { MoneyField } from '@/components/common/money-field';

export function ReturnDialog({
  slip,
  onClose,
  onSaved,
}: {
  slip: Slip | null;
  onClose: () => void;
  onSaved?: (slip: Slip) => void;
}): React.JSX.Element {
  const notify = useNotify();
  const { bump } = useCompetition();
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setText(penceToInput(slip?.return_pence));
    setError(null);
  }, [slip]);

  const pence = parsePounds(text);
  const save = async (value: number | null): Promise<void> => {
    if (!slip) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await api<Slip>(`/api/slips/${slip.id}/return`, { method: 'PUT', json: { return_pence: value } });
      notify(value === null ? 'Return cleared' : `Return saved: ${formatPence(value)}`);
      bump();
      onSaved?.(saved);
      onClose();
    } catch (error_) {
      setError(errorMessage(error_));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="xs" onClose={busy ? undefined : onClose} open={slip !== null}>
      <DialogTitle>What did it return?</DialogTitle>
      <DialogContent>
        {slip ? (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2">
              {betHeadline(slip)} · staked {formatPence(slip.stake_pence)}
            </Typography>
            <Typography color="text.secondary" variant="caption">
              {slip.selections.map((selection) => selection.horse_name).join(', ')}
            </Typography>
            <MoneyField
              autoFocus
              helperText="The total your bookie paid back, including the stake. 0 if it lost."
              label="Return"
              onChange={(value) => {
                setText(value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && pence !== null && !busy) {
                  save(pence).catch(() => {
                    // save reports its own errors
                  });
                }
              }}
              value={text}
            />
            {pence === null ? null : (
              <Typography color={profitColor(pence - slip.stake_pence)} variant="body2">
                Profit on this bet: {formatProfit(pence - slip.stake_pence)}
              </Typography>
            )}
            {error ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        {slip?.return_pence === null ? null : (
          <Button
            color="inherit"
            disabled={busy}
            onClick={() => {
              save(null).catch(() => {
                // save reports its own errors
              });
            }}
          >
            Not settled yet
          </Button>
        )}
        <Button
          color="error"
          disabled={busy}
          onClick={() => {
            save(0).catch(() => {
              // save reports its own errors
            });
          }}
        >
          Lost (£0)
        </Button>
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
      </DialogActions>
    </Dialog>
  );
}

export function VoidDialog({
  slip,
  onClose,
  onSaved,
}: {
  slip: Slip | null;
  onClose: () => void;
  onSaved?: (slip: Slip) => void;
}): React.JSX.Element {
  const notify = useNotify();
  const { bump } = useCompetition();
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setReason('');
    setError(null);
  }, [slip]);

  const save = async (): Promise<void> => {
    if (!slip) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await api<Slip>(`/api/slips/${slip.id}/void`, { method: 'POST', json: { reason: reason || null } });
      notify('Bet voided. It no longer counts, but stays in the history.');
      bump();
      onSaved?.(saved);
      onClose();
    } catch (error_) {
      setError(errorMessage(error_));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="xs" onClose={busy ? undefined : onClose} open={slip !== null}>
      <DialogTitle>Void this bet?</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography color="text.secondary" variant="body2">
            {slip ? `${betHeadline(slip)} (${formatPence(slip.stake_pence)})` : ''} will stop counting towards the budget
            and the leaderboard. It is kept in the history and can be restored.
          </Typography>
          <TextField
            label="Reason (optional)"
            onChange={(event) => {
              setReason(event.target.value);
            }}
            placeholder="Entered twice, wrong horse…"
            value={reason}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          Keep it
        </Button>
        <Button
          color="error"
          disabled={busy}
          onClick={() => {
            save().catch(() => {
              // save reports its own errors
            });
          }}
          variant="contained"
        >
          Void bet
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export async function restoreSlip(slip: Slip, confirm: boolean): Promise<{ slip?: Slip; overBudget?: string }> {
  try {
    const saved = await api<Slip>(`/api/slips/${slip.id}/restore`, {
      method: 'POST',
      json: { confirm_over_budget: confirm },
    });
    return { slip: saved };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'over_budget') {
      return { overBudget: error.message };
    }
    throw error;
  }
}
