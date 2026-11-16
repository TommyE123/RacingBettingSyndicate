import * as React from 'react';
import Typography from '@mui/material/Typography';
import type { TypographyProps } from '@mui/material/Typography';

import { formatPence, formatProfit, profitColor } from '@/lib/money';

export function Profit({
  pence,
  ...props
}: { pence: number | null | undefined } & Omit<TypographyProps, 'children'>): React.JSX.Element {
  return (
    <Typography
      color={profitColor(pence)}
      component="span"
      sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' }}
      variant="inherit"
      {...props}
    >
      {formatProfit(pence)}
    </Typography>
  );
}

export function Money({
  pence,
  ...props
}: { pence: number | null | undefined } & Omit<TypographyProps, 'children'>): React.JSX.Element {
  return (
    <Typography
      component="span"
      sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
      variant="inherit"
      {...props}
    >
      {formatPence(pence)}
    </Typography>
  );
}
