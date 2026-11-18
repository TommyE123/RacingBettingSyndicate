'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { ClipboardTextIcon } from '@phosphor-icons/react/dist/ssr/ClipboardText';
import { PlusIcon } from '@phosphor-icons/react/dist/ssr/Plus';
import { ScanIcon } from '@phosphor-icons/react/dist/ssr/Scan';
import { TrashIcon } from '@phosphor-icons/react/dist/ssr/Trash';

import type { SheetRead, SheetReader, Slip, SlipInput, Standings } from '@/types/api';
import { api, ApiError, errorMessage } from '@/lib/api';
import { foldName, linesFor, parsePastedHorses } from '@/lib/bets';
import { dayName, defaultDay } from '@/lib/days';
import { formatPence, formatStake, parsePounds, penceToInput } from '@/lib/money';
import { useCompetition } from '@/contexts/competition-context';
import { useApi } from '@/hooks/use-api';
import { useUser } from '@/hooks/use-user';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { MoneyField } from '@/components/common/money-field';

interface Row {
  key: number;
  day_id: number | '';
  race_time: string;
  horse_name: string;
  note: string;
}

let rowKey = 0;
function newRow(dayId: number | '', values: Partial<Row> = {}): Row {
  rowKey += 1;
  return { key: rowKey, day_id: dayId, race_time: '', horse_name: '', note: '', ...values };
}

const POPULAR = new Set(['single', 'double', 'treble', 'accumulator', 'yankee', 'lucky15', 'canadian', 'perm']);

const TIME_PATTERN = /^\s*\d{1,2}\s*[:.]\s*\d{2}\s*$/;

export interface SlipFormProps {
  slip?: Slip;
  sheetId?: number | null;
  ownerId?: number | null;
  // The day to start on: the sheet's day, or the day of the bet entered just before.
  defaultDayId?: number | null;
  onSaved: (slip: Slip) => void;
  onCancel?: () => void;
}

export function SlipForm({ slip, sheetId, ownerId, defaultDayId, onSaved, onCancel }: SlipFormProps): React.JSX.Element {
  const { user, isAdmin } = useUser();
  const { competition, betTypes, version, bump, isLoading } = useCompetition();
  const days = React.useMemo(() => competition?.days ?? [], [competition]);
  const entrants = competition?.entrants ?? [];
  const editing = Boolean(slip);
  const startDay =
    slip?.day_id ?? (days.some((day) => day.id === defaultDayId) ? defaultDayId : null) ?? defaultDay(days)?.id ?? '';

  const defaultOwner =
    slip?.user_id ??
    ownerId ??
    (entrants.some((entrant) => entrant.user_id === user?.id) ? user?.id : entrants[0]?.user_id) ??
    '';
  const [owner, setOwner] = React.useState<number | ''>(defaultOwner);
  const [dayId, setDayId] = React.useState<number | ''>(startDay);
  const [betTypeKey, setBetTypeKey] = React.useState<string>(slip?.bet_type ?? 'single');
  const [foldSize, setFoldSize] = React.useState<number | null>(slip?.fold_size ?? null);
  const [eachWay, setEachWay] = React.useState<boolean>(slip?.each_way ?? false);
  const [stakeMode, setStakeMode] = React.useState<'unit' | 'total'>('unit');
  const [stakeText, setStakeText] = React.useState<string>(penceToInput(slip?.unit_stake_pence));
  const [note, setNote] = React.useState<string>(slip?.note ?? '');
  const [rows, setRows] = React.useState<Row[]>(() =>
    slip
      ? slip.selections.map((selection) =>
          newRow(selection.day_id, {
            race_time: selection.race_time,
            horse_name: selection.horse_name,
            note: selection.note ?? '',
          })
        )
      : [newRow(startDay)]
  );
  const [touched, setTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [overBudget, setOverBudget] = React.useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = React.useState(false);
  // Text read from the sheet photo, offered as a draft in the paste box. The key starts it afresh.
  const [photoDraft, setPhotoDraft] = React.useState<{ key: number; text: string } | null>(null);
  const [reading, setReading] = React.useState(false);
  const [readError, setReadError] = React.useState<string | null>(null);
  const canRead = Boolean(sheetId) && !editing && (isAdmin || ownerId === user?.id);
  const reader = useApi<SheetReader>(canRead ? '/api/sheet-reader' : null);

  async function readPhoto(): Promise<void> {
    setReading(true);
    setReadError(null);
    try {
      const result = await api<SheetRead>(`/api/sheets/${sheetId}/read`, { method: 'POST' });
      if (result.lines.length === 0) {
        setReadError('No writing was found on the photo. Type the bets in instead.');
        return;
      }
      setPhotoDraft((current) => ({ key: (current?.key ?? 0) + 1, text: result.lines.join('\n') }));
      setPasteOpen(true);
    } catch (error_) {
      setReadError(errorMessage(error_));
    } finally {
      setReading(false);
    }
  }

  const standings = useApi<Standings>(competition ? `/api/competitions/${competition.id}/standings` : null, [version]);

  const betType = betTypes.find((type) => type.key === betTypeKey);
  const { lines, problem } = linesFor(betType, rows.length, foldSize);
  const stakePence = parsePounds(stakeText);
  const parts = lines === null ? null : lines * (eachWay ? 2 : 1);
  let unitPence: number | null = null;
  let totalPence: number | null = null;
  let stakeProblem: string | null = null;
  if (stakePence !== null && stakePence > 0 && parts !== null) {
    if (stakeMode === 'unit') {
      unitPence = stakePence;
      totalPence = stakePence * parts;
    } else if (stakePence % parts === 0) {
      unitPence = stakePence / parts;
      totalPence = stakePence;
    } else {
      stakeProblem = `${formatPence(stakePence)} does not split evenly into ${parts} bets`;
    }
  } else if (stakeText.trim() && (stakePence === null || stakePence <= 0)) {
    stakeProblem = 'Enter a stake like 2.50';
  }

  const ownerRow = standings.data?.rows.find((row) => row.user_id === owner);
  const currentStake = slip && !slip.voided_at ? slip.stake_pence : 0;
  const remainingBefore = ownerRow ? ownerRow.remaining_pence + currentStake : null;
  const remainingAfter = remainingBefore !== null && totalPence !== null ? remainingBefore - totalPence : null;

  const rowProblems = rows.map((row) => {
    if (row.day_id === '') {
      return 'Choose the day';
    }
    if (!row.race_time.trim()) {
      return 'Enter the race time';
    }
    if (!TIME_PATTERN.test(row.race_time)) {
      return 'Write the time like 2:10';
    }
    if (!row.horse_name.trim()) {
      return 'Enter the horse';
    }
    return null;
  });

  const setTypeAndRows = (key: string): void => {
    setBetTypeKey(key);
    const type = betTypes.find((item) => item.key === key);
    if (!type) {
      return;
    }
    if (key !== 'perm') {
      setFoldSize(null);
    } else if (foldSize === null) {
      setFoldSize(Math.min(2, Math.max(1, rows.length)));
    }
    if (rows.length < type.min_selections) {
      const fill = rows.at(-1)?.day_id ?? dayId;
      setRows((current) => [
        ...current,
        ...Array.from({ length: type.min_selections - current.length }, () => newRow(fill)),
      ]);
    }
  };

  const updateRow = (key: number, change: Partial<Row>): void => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));
  };

  const removeRow = (key: number): void => {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  };

  const addRow = (): void => {
    setRows((current) => [...current, newRow(current.at(-1)?.day_id ?? dayId)]);
  };

  const canSubmit =
    !isLoading &&
    owner !== '' &&
    dayId !== '' &&
    !problem &&
    !stakeProblem &&
    unitPence !== null &&
    rowProblems.every((item) => item === null);

  const submit = async (confirm: boolean): Promise<void> => {
    setTouched(true);
    if (!canSubmit || unitPence === null) {
      setError('Check the highlighted boxes');
      return;
    }
    setBusy(true);
    setError(null);
    const body: SlipInput = {
      day_id: dayId,
      bet_type: betTypeKey,
      fold_size: betTypeKey === 'perm' ? foldSize : null,
      each_way: eachWay,
      unit_stake_pence: unitPence,
      selections: rows.map((row) => ({
        day_id: Number(row.day_id),
        race_time: row.race_time.trim(),
        horse_name: row.horse_name.trim(),
        note: row.note.trim() || null,
      })),
      note: note.trim() || null,
      sheet_id: slip ? slip.sheet_id : (sheetId ?? null),
      user_id: editing ? null : owner === user?.id ? null : owner,
      confirm_over_budget: confirm,
    };
    try {
      const saved = slip
        ? await api<Slip>(`/api/slips/${slip.id}`, { method: 'PUT', json: body })
        : await api<Slip>(`/api/competitions/${competition?.id}/slips`, { method: 'POST', json: body });
      setOverBudget(null);
      bump();
      onSaved(saved);
    } catch (error_) {
      if (error_ instanceof ApiError && error_.code === 'over_budget') {
        setOverBudget(error_.message);
      } else {
        setError(errorMessage(error_));
        setOverBudget(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const showErrors = touched;
  const ownerName = entrants.find((entrant) => entrant.user_id === owner)?.display_name;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit(false).catch(() => {
          // submit reports its own errors
        });
      }}
    >
      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Typography variant="h6">The bet</Typography>
              <Grid container spacing={2}>
                {isAdmin && !editing ? (
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      disabled={busy}
                      fullWidth
                      helperText={owner !== user?.id && ownerName ? `Entering for ${ownerName}` : 'Admins can enter for anyone'}
                      label="Whose bet"
                      onChange={(event) => {
                        setOwner(Number(event.target.value));
                      }}
                      select
                      value={owner}
                    >
                      {entrants.map((entrant) => (
                        <MenuItem key={entrant.user_id} value={entrant.user_id}>
                          {entrant.display_name}
                          {entrant.user_id === user?.id ? ' (me)' : ''}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                ) : null}
                <Grid size={{ xs: 12, md: isAdmin && !editing ? 4 : 6 }}>
                  <TextField
                    disabled={busy}
                    error={showErrors && dayId === ''}
                    fullWidth
                    helperText="The day you placed it; the stake comes off your budget here"
                    label="Day placed"
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      setRows((current) =>
                        current.map((row) => (row.day_id === dayId || row.day_id === '' ? { ...row, day_id: next } : row))
                      );
                      setDayId(next);
                    }}
                    select
                    value={dayId}
                  >
                    {days.map((day) => (
                      <MenuItem key={day.id} value={day.id}>
                        {dayName(day)}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: isAdmin && !editing ? 4 : 6 }}>
                  <TextField
                    disabled={busy}
                    fullWidth
                    helperText={betType?.description}
                    label="Bet type"
                    onChange={(event) => {
                      setTypeAndRows(event.target.value);
                    }}
                    select
                    value={betTypeKey}
                  >
                    <ListSubheader>Most used</ListSubheader>
                    {betTypes
                      .filter((type) => POPULAR.has(type.key))
                      .map((type) => (
                        <MenuItem key={type.key} value={type.key}>
                          {type.label}
                          {type.fixed_lines && type.fixed_lines > 1 ? ` · ${type.fixed_lines} bets` : ''}
                        </MenuItem>
                      ))}
                    <ListSubheader>Full cover</ListSubheader>
                    {betTypes
                      .filter((type) => !POPULAR.has(type.key))
                      .map((type) => (
                        <MenuItem key={type.key} value={type.key}>
                          {type.label}
                          {type.fixed_lines ? ` · ${type.fixed_lines} bets` : ''}
                        </MenuItem>
                      ))}
                  </TextField>
                </Grid>
                {betTypeKey === 'perm' ? (
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      disabled={busy}
                      error={showErrors && !foldSize}
                      fullWidth
                      helperText="Every combination of this size"
                      label="Perm size"
                      onChange={(event) => {
                        setFoldSize(Number(event.target.value));
                      }}
                      select
                      value={foldSize ?? ''}
                    >
                      {Array.from({ length: Math.max(rows.length, 1) }, (_, index) => index + 1).map((size) => (
                        <MenuItem key={size} value={size}>
                          {foldName(size)} from {rows.length} ({size <= rows.length ? linesFor(betType, rows.length, size).lines : 0}{' '}
                          bets)
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                ) : null}
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        disabled={busy}
                        checked={eachWay}
                        onChange={(event) => {
                          setEachWay(event.target.checked);
                        }}
                      />
                    }
                    label={eachWay ? 'Each way (doubles the stake)' : 'Win only'}
                    sx={{ mt: 1 }}
                  />
                </Grid>
              </Grid>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6">
                  Horses{' '}
                  <Typography color="text.secondary" component="span" variant="body2">
                    ({rows.length})
                  </Typography>
                </Typography>
                <Stack direction="row" spacing={1}>
                  {canRead && reader.data?.enabled ? (
                    <Button
                      disabled={busy || reading}
                      onClick={() => {
                        readPhoto().catch(() => {
                          // readPhoto reports its own errors
                        });
                      }}
                      size="small"
                      startIcon={<ScanIcon />}
                    >
                      {reading ? 'Reading the photo...' : 'Read from photo'}
                    </Button>
                  ) : null}
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setPhotoDraft(null);
                      setPasteOpen(true);
                    }}
                    size="small"
                    startIcon={<ClipboardTextIcon />}
                  >
                    Paste a list
                  </Button>
                </Stack>
              </Stack>
              {readError ? (
                <Alert
                  onClose={() => {
                    setReadError(null);
                  }}
                  severity="warning"
                >
                  {readError}
                </Alert>
              ) : null}
              {rows.map((row, index) => {
                const rowProblem = showErrors ? rowProblems[index] : null;
                return (
                  <Box key={row.key}>
                    <Grid container spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                      <Grid size={{ xs: 12, sm: 3, md: 2.5 }}>
                        <TextField
                          disabled={busy}
                          error={rowProblem === 'Choose the day'}
                          fullWidth
                          label={`Day (horse ${index + 1})`}
                          onChange={(event) => {
                            updateRow(row.key, { day_id: Number(event.target.value) });
                          }}
                          select
                          size="small"
                          value={row.day_id}
                        >
                          {days.map((day) => (
                            <MenuItem key={day.id} value={day.id}>
                              {dayName(day)}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 4, sm: 2, md: 1.5 }}>
                        <TextField
                          disabled={busy}
                          error={rowProblem === 'Enter the race time' || rowProblem === 'Write the time like 2:10'}
                          fullWidth
                          label="Time"
                          onChange={(event) => {
                            updateRow(row.key, { race_time: event.target.value });
                          }}
                          placeholder="2:10"
                          size="small"
                          slotProps={{ htmlInput: { inputMode: 'decimal', autoComplete: 'off' } }}
                          value={row.race_time}
                        />
                      </Grid>
                      <Grid size={{ xs: 8, sm: 4, md: 4.5 }}>
                        <TextField
                          disabled={busy}
                          error={rowProblem === 'Enter the horse'}
                          fullWidth
                          label="Horse"
                          onChange={(event) => {
                            updateRow(row.key, { horse_name: event.target.value });
                          }}
                          size="small"
                          slotProps={{ htmlInput: { autoComplete: 'off', autoCapitalize: 'words' } }}
                          value={row.horse_name}
                        />
                      </Grid>
                      <Grid size={{ xs: 10, sm: 2.5, md: 3 }}>
                        <TextField
                          disabled={busy}
                          fullWidth
                          label="Note"
                          onChange={(event) => {
                            updateRow(row.key, { note: event.target.value });
                          }}
                          placeholder="top 4, w/out fav"
                          size="small"
                          value={row.note}
                        />
                      </Grid>
                      <Grid size={{ xs: 2, sm: 0.5 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Tooltip title="Remove this horse">
                          <span>
                            <IconButton
                              aria-label={`Remove horse ${index + 1}`}
                              disabled={busy || rows.length === 1}
                              onClick={() => {
                                removeRow(row.key);
                              }}
                            >
                              <TrashIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Grid>
                    </Grid>
                    {rowProblem ? (
                      <Typography color="error" sx={{ mt: 0.5 }} variant="caption">
                        Horse {index + 1}: {rowProblem}
                      </Typography>
                    ) : null}
                  </Box>
                );
              })}
              <div>
                <Button disabled={busy} onClick={addRow} startIcon={<PlusIcon />} variant="outlined">
                  Add a horse
                </Button>
              </div>
              {problem && rows.length > 0 ? <Alert severity="warning">{problem}</Alert> : null}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Typography variant="h6">Stake</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' } }}>
                <ToggleButtonGroup
                  disabled={busy}
                  exclusive
                  onChange={(_, value: 'unit' | 'total' | null) => {
                    if (value && value !== stakeMode) {
                      if (stakePence !== null && parts) {
                        // A total that does not split into whole pence is cleared, not rounded
                        // into a different stake.
                        const converted = value === 'total' ? stakePence * parts : stakePence / parts;
                        setStakeText(Number.isInteger(converted) ? penceToInput(converted) : '');
                      }
                      setStakeMode(value);
                    }
                  }}
                  size="small"
                  value={stakeMode}
                >
                  <ToggleButton value="unit">Per bet</ToggleButton>
                  <ToggleButton value="total">Total</ToggleButton>
                </ToggleButtonGroup>
                <MoneyField
                  disabled={busy}
                  error={showErrors && (unitPence === null || Boolean(stakeProblem))}
                  helperText={stakeMode === 'unit' ? 'As written: £1 e/w Lucky 15 is 1' : 'The total circled on the sheet'}
                  label={stakeMode === 'unit' ? 'Stake per bet' : 'Total stake'}
                  onChange={(text) => {
                    setStakeText(text);
                  }}
                  sx={{ maxWidth: 240 }}
                  value={stakeText}
                />
              </Stack>
              {stakeProblem ? <Alert severity="warning">{stakeProblem}</Alert> : null}
              <Box
                sx={{
                  bgcolor: 'var(--mui-palette-background-level1)',
                  borderRadius: 2,
                  p: 2,
                }}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ justifyContent: 'space-between' }}>
                  <div>
                    <Typography color="text.secondary" variant="overline">
                      This bet costs
                    </Typography>
                    <Typography variant="h4">{totalPence === null ? '—' : formatPence(totalPence)}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      {lines === null
                        ? 'Add the horses to work out the bets'
                        : `${lines} bet${lines === 1 ? '' : 's'}${unitPence === null ? '' : ` × ${formatStake(unitPence)}`}${eachWay ? ' × 2 each way' : ''}`}
                    </Typography>
                  </div>
                  <div>
                    <Typography color="text.secondary" variant="overline">
                      {ownerName && owner !== user?.id ? `${ownerName} has left` : 'Left to bet afterwards'}
                    </Typography>
                    <Typography
                      color={remainingAfter !== null && remainingAfter < 0 ? 'error.main' : undefined}
                      variant="h4"
                    >
                      {remainingAfter === null ? (remainingBefore === null ? '—' : formatPence(remainingBefore)) : formatPence(remainingAfter)}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      {remainingBefore === null ? ' ' : `${formatPence(remainingBefore)} before this bet`}
                    </Typography>
                  </div>
                </Stack>
              </Box>
              {remainingAfter !== null && remainingAfter < 0 ? (
                <Alert severity="warning">
                  This goes {formatPence(-remainingAfter)} over the {formatPence(competition?.budget_pence)} budget.
                  You can still save it, but it will be flagged on the leaderboard.
                </Alert>
              ) : null}
              <TextField
                disabled={busy}
                fullWidth
                label="Note (optional)"
                multiline
                onChange={(event) => {
                  setNote(event.target.value);
                }}
                placeholder="Bookie, best odds, anything else on the sheet"
                value={note}
              />
            </Stack>
          </CardContent>
        </Card>

        {slip && slip.return_pence !== null ? (
          <Alert severity="info">
            This bet&apos;s return of {formatPence(slip.return_pence)} is already entered. Changing the stake, bet
            type, each way or a horse&apos;s day clears it so it can be entered again; correcting a name, race time
            or note keeps it.
          </Alert>
        ) : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Divider />
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
          {onCancel ? (
            <Button disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button disabled={busy || isLoading} size="large" type="submit" variant="contained">
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Save bet'}
          </Button>
        </Stack>
      </Stack>

      <ConfirmDialog
        busy={busy}
        confirmLabel="Save and flag it"
        message={overBudget ?? ''}
        onCancel={() => {
          setOverBudget(null);
        }}
        onConfirm={() => {
          submit(true).catch(() => {
            // submit reports its own errors
          });
        }}
        open={overBudget !== null}
        title="Over the budget"
      />
      <PasteDialog
        fromPhoto={photoDraft !== null}
        initialText={photoDraft?.text ?? ''}
        key={photoDraft?.key ?? 0}
        onClose={() => {
          setPasteOpen(false);
        }}
        onPaste={(parsed) => {
          const fill = rows.at(-1)?.day_id ?? dayId;
          const kept = rows.filter((row) => row.horse_name.trim() || row.race_time.trim());
          setRows([...kept, ...parsed.map((item) => newRow(fill, item))]);
          setPasteOpen(false);
        }}
        open={pasteOpen}
      />
    </form>
  );
}

function PasteDialog({
  open,
  initialText,
  fromPhoto,
  onClose,
  onPaste,
}: {
  open: boolean;
  initialText: string;
  fromPhoto: boolean;
  onClose: () => void;
  onPaste: (rows: { race_time: string; horse_name: string; note: string }[]) => void;
}): React.JSX.Element {
  const [text, setText] = React.useState(initialText);
  const parsed = parsePastedHorses(text);
  return (
    <Dialog fullWidth maxWidth="sm" onClose={onClose} open={open}>
      <DialogTitle>{fromPhoto ? 'Check what was read from the photo' : 'Paste a list of horses'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {fromPhoto ? (
            <Alert severity="warning">
              Handwriting is often misread. Compare every line with the sheet, fix any mistakes and delete lines that
              are not horses. Nothing is saved until you save the bet.
            </Alert>
          ) : null}
          <Typography color="text.secondary" variant="body2">
            One horse per line with its race time first, as on a WhatsApp message. Anything in brackets becomes a
            note.
          </Typography>
          <TextField
            autoFocus
            minRows={6}
            multiline
            onChange={(event) => {
              setText(event.target.value);
            }}
            placeholder={'1:30 - Mystical Power\n2:10 - Gaelic Warrior\n3:30 State Man (top 4)'}
            value={text}
          />
          <Typography variant="body2">
            {parsed.length === 0
              ? 'No horses recognised yet.'
              : `Recognised ${parsed.length}: ${parsed.map((row) => `${row.race_time} ${row.horse_name}`).join(', ')}`}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          disabled={parsed.length === 0}
          onClick={() => {
            onPaste(parsed);
            setText('');
          }}
          variant="contained"
        >
          Add {parsed.length > 0 ? parsed.length : ''} horses
        </Button>
      </DialogActions>
    </Dialog>
  );
}
