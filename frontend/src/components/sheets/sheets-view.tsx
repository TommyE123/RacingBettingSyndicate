'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import { Chip } from '@/components/common/chip';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { CameraIcon } from '@phosphor-icons/react/dist/ssr/Camera';
import { ImageIcon } from '@phosphor-icons/react/dist/ssr/Image';

import type { CompetitionDetail, Sheet } from '@/types/api';
import { paths } from '@/paths';
import { api, errorMessage, withQuery } from '@/lib/api';
import { dayName, defaultDay, formatTime } from '@/lib/days';
import { formatPence, parsePounds } from '@/lib/money';
import { useCompetition } from '@/contexts/competition-context';
import { useNotify } from '@/contexts/notify-context';
import { useApi } from '@/hooks/use-api';
import { useUser } from '@/hooks/use-user';
import { MoneyField } from '@/components/common/money-field';
import { PageHeader } from '@/components/common/page-header';
import { RequireCompetition } from '@/components/common/require-competition';
import { EmptyState, ErrorAlert, Loading } from '@/components/common/states';

const MAX_BYTES = 15 * 1024 * 1024;

export function SheetsView(): React.JSX.Element {
  return <RequireCompetition>{(competition) => <Sheets competition={competition} />}</RequireCompetition>;
}

export function TotalsChip({ sheet }: { sheet: Sheet }): React.JSX.Element {
  if (sheet.stated_total_pence === null) {
    return <Chip label={`${sheet.slip_count} bets · ${formatPence(sheet.entered_total_pence)}`} size="small" variant="outlined" />;
  }
  const matches = sheet.stated_total_pence === sheet.entered_total_pence;
  return (
    <Chip
      color={matches ? 'success' : sheet.slip_count === 0 ? 'default' : 'warning'}
      label={
        matches
          ? `All ${formatPence(sheet.stated_total_pence)} entered`
          : `${formatPence(sheet.entered_total_pence)} of ${formatPence(sheet.stated_total_pence)} entered`
      }
      size="small"
      variant={matches ? 'filled' : 'outlined'}
    />
  );
}

function Sheets({ competition }: { competition: CompetitionDetail }): React.JSX.Element {
  const { user, isAdmin } = useUser();
  const { version, isEntered, dayById, bump, latestChoice } = useCompetition();
  const notify = useNotify();
  const router = useRouter();
  const sheets = useApi<Sheet[]>(`/api/competitions/${competition.id}/sheets`, [version]);
  const [owner, setOwner] = React.useState<number | ''>(
    isEntered && user ? user.id : (competition.entrants[0]?.user_id ?? '')
  );
  const [dayId, setDayId] = React.useState<number | ''>(defaultDay(competition.days)?.id ?? '');
  const [totalText, setTotalText] = React.useState('');
  const [note, setNote] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // The page remounts when the competition changes, so an upload that finishes after that
  // (or after leaving the page) must not navigate anywhere.
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const canUpload = (isEntered || isAdmin) && competition.days.length > 0 && competition.entrants.length > 0;

  const upload = async (): Promise<void> => {
    if (!file || owner === '' || dayId === '') {
      setError('Choose a photo and the day');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('That photo is over 15 MB');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const stated = parsePounds(totalText);
      if (totalText.trim() && stated === null) {
        setError('Enter the sheet total like 30 or 2.50, or leave it empty');
        setBusy(false);
        return;
      }
      const sheet = await api<Sheet>(
        withQuery(`/api/competitions/${competition.id}/sheets`, {
          day_id: dayId,
          user_id: owner === user?.id ? null : owner,
          stated_total_pence: stated,
          note: note.trim() || null,
        }),
        { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } }
      );
      bump();
      // Navigate only if this page is still open and its competition is still the one
      // chosen: another may have been picked and still be loading.
      if (!mounted.current || latestChoice() !== competition.id) {
        notify('Sheet uploaded.');
        return;
      }
      notify('Sheet uploaded. Now enter the bets on it.');
      setFile(null);
      setTotalText('');
      setNote('');
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      router.push(`${paths.dashboard.newBet}?sheet=${sheet.id}`);
    } catch (error_) {
      setError(errorMessage(error_));
    } finally {
      setBusy(false);
    }
  };

  const byDay = new Map<number, Sheet[]>();
  for (const sheet of sheets.data ?? []) {
    byDay.set(sheet.day_id, [...(byDay.get(sheet.day_id) ?? []), sheet]);
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        subtitle="Upload a photo of a written sheet (or a WhatsApp screenshot), then enter each bet next to it."
        title="Bet sheets"
      />
      {canUpload ? (
        <Card>
          <CardHeader title="Upload a sheet" />
          <CardContent sx={{ pt: 0 }}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 7 }}>
                <Stack spacing={2}>
                  {isAdmin ? (
                    <TextField
                      disabled={busy}
                      label="Whose sheet"
                      onChange={(event) => {
                        setOwner(Number(event.target.value));
                      }}
                      select
                      value={owner}
                    >
                      {competition.entrants.map((entrant) => (
                        <MenuItem key={entrant.user_id} value={entrant.user_id}>
                          {entrant.display_name}
                          {entrant.user_id === user?.id ? ' (me)' : ''}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : null}
                  <TextField
                    disabled={busy}
                    label="Day"
                    onChange={(event) => {
                      setDayId(Number(event.target.value));
                    }}
                    select
                    value={dayId}
                  >
                    {competition.days.map((day) => (
                      <MenuItem key={day.id} value={day.id}>
                        {dayName(day)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <MoneyField
                    disabled={busy}
                    helperText="The total written on the sheet, if there is one. Used to check the bets add up."
                    label="Sheet total (optional)"
                    onChange={(text) => {
                      setTotalText(text);
                    }}
                    value={totalText}
                  />
                  <TextField
                    disabled={busy}
                    label="Note (optional)"
                    onChange={(event) => {
                      setNote(event.target.value);
                    }}
                    value={note}
                  />
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <Stack spacing={2} sx={{ height: '100%' }}>
                  <Box
                    aria-label={file ? `Change the photo (${file.name})` : 'Take or choose a photo'}
                    component="button"
                    disabled={busy}
                    onClick={() => inputRef.current?.click()}
                    type="button"
                    sx={{
                      bgcolor: 'transparent',
                      color: 'inherit',
                      font: 'inherit',
                      '&:focus-visible': { outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: 2 },
                      alignItems: 'center',
                      border: '2px dashed var(--mui-palette-divider)',
                      borderRadius: 2,
                      cursor: busy ? 'default' : 'pointer',
                      display: 'flex',
                      flex: '1 1 auto',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      minHeight: 200,
                      overflow: 'hidden',
                      p: 2,
                      textAlign: 'center',
                    }}
                  >
                    {preview ? (
                      <Box alt="Preview" component="img" src={preview} sx={{ maxHeight: 260, maxWidth: '100%' }} />
                    ) : (
                      <>
                        <CameraIcon fontSize={40} />
                        <Typography sx={{ mt: 1 }} variant="subtitle2">
                          Take or choose a photo
                        </Typography>
                        <Typography color="text.secondary" variant="caption">
                          JPEG, PNG, WebP or HEIC, up to 15 MB
                        </Typography>
                      </>
                    )}
                  </Box>
                  <input
                    accept="image/*"
                    disabled={busy}
                    hidden
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null);
                      setError(null);
                    }}
                    ref={inputRef}
                    type="file"
                  />
                  {file ? (
                    <Typography color="text.secondary" variant="caption">
                      {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
                    </Typography>
                  ) : null}
                </Stack>
              </Grid>
            </Grid>
            {busy ? <LinearProgress sx={{ mt: 2 }} /> : null}
            {error ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            ) : null}
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end', mt: 2 }}>
              <Button
                disabled={busy || !file}
                onClick={() => {
                  upload().catch(() => {
                    // upload reports its own errors
                  });
                }}
                variant="contained"
              >
                Upload and enter bets
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {sheets.error ? <ErrorAlert message={sheets.error} onRetry={sheets.reload} /> : null}
      {sheets.isLoading && !sheets.data ? <Loading /> : null}
      {sheets.data && sheets.data.length === 0 ? (
        <EmptyState
          description="Photos of everyone's sheets will appear here, so anyone can check a bet against what was written."
          icon={<ImageIcon />}
          title="No sheets yet"
        />
      ) : null}
      {competition.days
        .filter((day) => byDay.has(day.id))
        // filter() returns a new array, so reversing it leaves the competition's days alone.
        .reverse()
        .map((day) => (
          <Stack key={day.id} spacing={2}>
            <Typography variant="h6">{dayName(dayById(day.id))}</Typography>
            <Grid container spacing={2}>
              {(byDay.get(day.id) ?? []).map((sheet) => (
                <Grid key={sheet.id} size={{ xs: 6, sm: 4, md: 3, xl: 2 }}>
                  <Card sx={{ height: '100%' }} variant="outlined">
                    <CardActionArea component={RouterLink} href={paths.dashboard.sheet(sheet.id)} sx={{ height: '100%' }}>
                      <Box
                        alt={`Sheet from ${sheet.display_name}`}
                        component="img"
                        loading="lazy"
                        src={`/api/sheets/${sheet.id}/image`}
                        sx={{ aspectRatio: '3 / 4', bgcolor: 'var(--mui-palette-background-level1)', display: 'block', objectFit: 'cover', width: '100%' }}
                      />
                      <CardContent sx={{ p: 1.5 }}>
                        <Typography noWrap variant="subtitle2">
                          {sheet.display_name}
                        </Typography>
                        <Typography color="text.secondary" sx={{ display: 'block', mb: 1 }} variant="caption">
                          {formatTime(sheet.created_at)}
                        </Typography>
                        <TotalsChip sheet={sheet} />
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Stack>
        ))}
    </Stack>
  );
}

