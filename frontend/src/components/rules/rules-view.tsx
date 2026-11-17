'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SkullIcon } from '@phosphor-icons/react/dist/ssr/Skull';
import { TrophyIcon } from '@phosphor-icons/react/dist/ssr/Trophy';

import { formatPence } from '@/lib/money';
import { useCompetition } from '@/contexts/competition-context';
import { PageHeader } from '@/components/common/page-header';
import { ErrorAlert, Loading } from '@/components/common/states';

export function RulesView(): React.JSX.Element {
  const { competition, isLoading, error } = useCompetition();
  if (isLoading && !competition) {
    return <Loading />;
  }
  if (error && !competition) {
    return <ErrorAlert message={error} />;
  }
  // Never guess an amount: with no competition, name the budget without a figure.
  const budget = competition ? formatPence(competition.budget_pence).replace('.00', '') : 'the budget';

  return (
    <Stack spacing={3} sx={{ maxWidth: 820 }}>
      <PageHeader subtitle="The simple rules, as agreed on the group." title="Rules" />
      <Card>
        <CardContent>
          <Stack component="ol" spacing={2} sx={{ m: 0, pl: 3 }}>
            <Typography component="li">
              Every participant has a total of <strong>{budget}</strong> to bet at the festival: no more, no less.
            </Typography>
            <Typography component="li">
              Place your money however you see fit. One {competition ? budget : 'single'} bet is fine. Thousands of different bets is fine too
              (Maurizio, take note).
            </Typography>
            <Typography component="li">
              All bets must be posted <strong>before the first race of the day</strong>. Enter them here, or upload
              a photo of your sheet and enter the bets from it.
            </Typography>
            <Typography component="li">
              After the last race of the day, enter what each bet returned. Your profit or loss is worked out from
              that.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Stack direction="row" spacing={2}>
              <Box sx={{ color: '#f5a524', lineHeight: 0 }}>
                <TrophyIcon fontSize={44} weight="fill" />
              </Box>
              <div>
                <Typography variant="h6">Bob Addis Memorial Trophy</Typography>
                <Typography color="text.secondary" variant="body2">
                  For the most profit (or least loss) by the end of the week. The trophy stays in Looker&apos;s bar in
                  Lanzarote.
                </Typography>
              </div>
            </Stack>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Stack direction="row" spacing={2}>
              <Box sx={{ color: 'text.secondary', lineHeight: 0 }}>
                <SkullIcon fontSize={44} weight="fill" />
              </Box>
              <div>
                <Typography variant="h6">JFK Blowout Trophy</Typography>
                <Typography color="text.secondary" variant="body2">
                  For the biggest loss (or least profit). It must be taken home and placed somewhere prominent.
                </Typography>
              </div>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
      <Card>
        <CardContent>
          <Typography gutterBottom variant="h6">
            How the site works it out
          </Typography>
          <Stack component="ul" spacing={1} sx={{ m: 0, pl: 3 }}>
            <Typography component="li" variant="body2">
              A bet&apos;s cost is the stake per bet × the number of bets in it × 2 if each way. A £1 each-way Lucky 15
              is 15 bets × £1 × 2 = £30.
            </Typography>
            <Typography component="li" variant="body2">
              The stake comes off your budget on the day you placed the bet. Its return counts on the day of its
              last horse.
            </Typography>
            <Typography component="li" variant="body2">
              Returns are whatever your bookie paid; the site never works them out from prices.
            </Typography>
            <Typography component="li" variant="body2">
              Going over the budget is allowed only with a confirmation, and is flagged for everyone to see.
            </Typography>
            <Typography component="li" variant="body2">
              Every change to a bet is logged with who made it and when, and void bets stay in the history.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
