import * as React from 'react';
import MuiChip from '@mui/material/Chip';
import type { ChipProps as MuiChipProps } from '@mui/material/Chip';

export type ChipProps = MuiChipProps & { component?: React.ElementType; href?: string };

function ignoreClick(): void {
  // Deliberately empty; see Chip below.
}

// MUI 7.1.1's Chip calls its onClick prop even when none is given, so tapping a plain chip
// throws "onClick is not a function". Always pass a handler, and keep plain chips looking
// non-clickable. Remove this wrapper once @mui/material is upgraded past the fix.
export function Chip({ onClick, clickable, ...props }: ChipProps): React.JSX.Element {
  return <MuiChip clickable={clickable ?? Boolean(onClick)} onClick={onClick ?? ignoreClick} {...(props as MuiChipProps)} />;
}
