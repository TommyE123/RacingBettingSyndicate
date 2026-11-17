'use client';

import * as React from 'react';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import type { TextFieldProps } from '@mui/material/TextField';

import { parsePounds } from '@/lib/money';

export type MoneyFieldProps = Omit<TextFieldProps, 'onChange' | 'value'> & {
  value: string;
  onChange: (text: string, pence: number | null) => void;
  allowEmpty?: boolean;
};

// A pounds-and-pence box that accepts "30", "2.50", "£1,000" or "50p".
export function MoneyField({ value, onChange, allowEmpty = true, helperText, ...props }: MoneyFieldProps): React.JSX.Element {
  const pence = parsePounds(value);
  const invalid = value.trim() !== '' && pence === null;
  const missing = !allowEmpty && value.trim() === '';
  return (
    <TextField
      {...props}
      error={invalid || props.error}
      helperText={invalid ? 'Enter an amount like 2.50' : missing ? undefined : helperText}
      onChange={(event) => {
        onChange(event.target.value, parsePounds(event.target.value));
      }}
      slotProps={{
        ...props.slotProps,
        input: { startAdornment: <InputAdornment position="start">£</InputAdornment> },
        htmlInput: { inputMode: 'decimal', autoComplete: 'off' },
      }}
      value={value}
    />
  );
}
