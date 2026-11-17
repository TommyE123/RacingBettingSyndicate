import * as React from 'react';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';

import type { Sheet } from '@/types/api';
import { formatPence } from '@/lib/money';

// Compares the total written on the sheet with the bets entered from it.
export function SheetTotals({ sheet }: { sheet: Sheet }): React.JSX.Element {
  const entered = `${sheet.slip_count} bet${sheet.slip_count === 1 ? '' : 's'} entered, totalling ${formatPence(sheet.entered_total_pence)}`;
  if (sheet.stated_total_pence === null) {
    return (
      <Typography color="text.secondary" variant="body2">
        {entered}. Add the sheet&apos;s written total to check it adds up.
      </Typography>
    );
  }
  const difference = sheet.stated_total_pence - sheet.entered_total_pence;
  if (difference === 0) {
    return <Alert severity="success">{entered}: matches the {formatPence(sheet.stated_total_pence)} written on the sheet.</Alert>;
  }
  return (
    <Alert severity={difference > 0 ? 'info' : 'warning'}>
      {entered}. The sheet says {formatPence(sheet.stated_total_pence)}, so{' '}
      {difference > 0 ? `${formatPence(difference)} is still to enter` : `${formatPence(-difference)} more has been entered than written`}
      .
    </Alert>
  );
}
