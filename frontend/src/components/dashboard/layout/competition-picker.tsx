'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';

import { useCompetition } from '@/contexts/competition-context';

export function CompetitionPicker(): React.JSX.Element {
  const { competitions, competition, selectedId, select } = useCompetition();

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
          fullWidth
          onChange={(event) => {
            select(Number(event.target.value));
          }}
          size="small"
          // The name goes on the dropdown itself (the element with the combobox role).
          SelectDisplayProps={{ 'aria-label': 'Competition' } as React.HTMLAttributes<HTMLDivElement>}
          sx={{
            color: 'inherit',
            fontWeight: 600,
            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
            '& .MuiSelect-select': { p: 0, pr: '24px !important' },
            '& .MuiSvgIcon-root': { color: 'var(--mui-palette-neutral-400)' },
          }}
          // Show the competition chosen, not the one loaded: after a failed switch they differ,
          // and showing the old one would make picking it again a no-op.
          value={selectedId ?? competition?.id ?? ''}
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
