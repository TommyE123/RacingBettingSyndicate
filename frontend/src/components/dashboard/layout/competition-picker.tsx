'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';

import { useCompetition } from '@/contexts/competition-context';

export function CompetitionPicker(): React.JSX.Element {
  const { competitions, competition, select } = useCompetition();

  return (
    <Box
      sx={{
        border: '1px solid var(--mui-palette-neutral-700)',
        borderRadius: '12px',
        p: '4px 12px',
      }}
    >
      <Typography color="var(--mui-palette-neutral-400)" variant="body2">
        Competition
      </Typography>
      {competitions.length === 0 ? (
        <Typography color="inherit" variant="subtitle1">
          None yet
        </Typography>
      ) : (
        <Select
          aria-label="Competition"
          fullWidth
          onChange={(event) => {
            select(Number(event.target.value));
          }}
          size="small"
          sx={{
            color: 'inherit',
            fontWeight: 600,
            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
            '& .MuiSelect-select': { p: 0, pr: '24px !important' },
            '& .MuiSvgIcon-root': { color: 'var(--mui-palette-neutral-400)' },
          }}
          value={competition?.id ?? ''}
          variant="outlined"
        >
          {competitions.map((item) => (
            <MenuItem key={item.id} value={item.id}>
              {item.name}
              {item.entered ? '' : ' (not entered)'}
            </MenuItem>
          ))}
        </Select>
      )}
    </Box>
  );
}
