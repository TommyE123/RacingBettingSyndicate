'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { CompetitionDetail, Sheet, Slip } from '@/types/api';
import { paths } from '@/paths';
import { betHeadline } from '@/lib/bets';
import { dayName } from '@/lib/days';
import { formatPence } from '@/lib/money';
import { useCompetition } from '@/contexts/competition-context';
import { useNotify } from '@/contexts/notify-context';
import { useApi } from '@/hooks/use-api';
import { useUser } from '@/hooks/use-user';
import { PageHeader } from '@/components/common/page-header';
import { RequireCompetition } from '@/components/common/require-competition';
import { SheetTotals } from '@/components/sheets/sheet-totals';

import { SlipForm } from './slip-form';
import { SlipList } from './slip-view';

export function NewBetView(): React.JSX.Element {
  return <RequireCompetition>{(competition) => <NewBet competition={competition} />}</RequireCompetition>;
}

function NewBet({ competition }: { competition: CompetitionDetail }): React.JSX.Element {
  const search = useSearchParams();
  const sheetId = search.get('sheet') ? Number(search.get('sheet')) : null;
  const { isAdmin } = useUser();
  const { isEntered, version, dayById } = useCompetition();
  const notify = useNotify();
  const [formKey, setFormKey] = React.useState(0);
  const [saved, setSaved] = React.useState<Slip[]>([]);
  const sheet = useApi<Sheet>(sheetId ? `/api/sheets/${sheetId}` : null, [version]);
  const fromSheet = useApi<Slip[]>(
    sheetId ? `/api/competitions/${competition.id}/slips?sheet_id=${sheetId}` : null,
    [version]
  );

  if (!isEntered && !isAdmin) {
    return (
      <Alert severity="info">
        You are not entered in {competition.name}. Ask an admin to enter you before adding bets.
      </Alert>
    );
  }
  if (competition.days.length === 0) {
    return (
      <Alert severity="warning">
        {competition.name} has no days yet.{' '}
        {isAdmin ? (
          <RouterLink href={paths.dashboard.admin.competition(competition.id)}>Add the festival days</RouterLink>
        ) : (
          'An admin needs to add the festival days first.'
        )}
      </Alert>
    );
  }

  const owner = sheet.data?.user_id ?? null;
  const startDay = sheet.data?.day_id ?? saved[0]?.day_id ?? null;
  const form = (
    <SlipForm
      defaultDayId={startDay}
      key={`${formKey}-${owner ?? ''}-${startDay ?? ''}`}
      onSaved={(slip) => {
        notify(`Saved: ${betHeadline(slip)} for ${formatPence(slip.stake_pence)}${slip.over_budget ? ' (over budget, flagged)' : ''}`);
        setSaved((current) => [slip, ...current]);
        setFormKey((value) => value + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      ownerId={owner}
      sheetId={sheetId}
    />
  );

  return (
    <Stack spacing={3}>
      <PageHeader
        subtitle="One bet at a time, as written on your sheet. The cost is worked out for you."
        title={sheet.data ? `Add bets from ${sheet.data.display_name}'s sheet` : 'Add a bet'}
      />
      {sheet.data ? (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 5 }}>
            <Box sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
              <Card>
                <CardHeader
                  action={
                    <Button component={RouterLink} href={paths.dashboard.sheet(sheet.data.id)} size="small">
                      Open
                    </Button>
                  }
                  subheader={dayName(dayById(sheet.data.day_id))}
                  title="The sheet"
                />
                <Box
                  alt={`Bet sheet from ${sheet.data.display_name}`}
                  component="img"
                  src={`/api/sheets/${sheet.data.id}/image`}
                  sx={{ display: 'block', maxHeight: { xs: 360, lg: '70vh' }, objectFit: 'contain', width: '100%' }}
                />
                <CardContent>
                  <SheetTotals sheet={sheet.data} />
                </CardContent>
              </Card>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, lg: 7 }}>{form}</Grid>
        </Grid>
      ) : (
        form
      )}
      {sheetId && fromSheet.data ? (
        <Card>
          <CardHeader title={`Entered from this sheet (${fromSheet.data.length})`} />
          <CardContent sx={{ pt: 0 }}>
            <SlipList emptyText="None yet." slips={fromSheet.data} />
          </CardContent>
        </Card>
      ) : saved.length > 0 ? (
        <Card>
          <CardHeader title={`Saved just now (${saved.length})`} />
          <CardContent sx={{ pt: 0 }}>
            <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
              Keep going for the rest of the sheet, or check them on{' '}
              <RouterLink href={paths.dashboard.bets}>All bets</RouterLink>.
            </Typography>
            <SlipList slips={saved} />
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
