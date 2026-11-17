'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { HorseIcon } from '@phosphor-icons/react/dist/ssr/Horse';

type Color = 'dark' | 'light';

export interface LogoProps {
  color?: Color;
  emblem?: boolean;
  height?: number;
  width?: number;
}

export function Logo({ color = 'dark', emblem, height = 32 }: LogoProps): React.JSX.Element {
  const text = color === 'light' ? 'var(--mui-palette-common-white)' : 'var(--mui-palette-text-primary)';
  return (
    <Box sx={{ alignItems: 'center', display: 'inline-flex', gap: 1, height }}>
      <Box
        sx={{
          alignItems: 'center',
          bgcolor: 'var(--mui-palette-primary-main)',
          borderRadius: '8px',
          color: 'var(--mui-palette-primary-contrastText)',
          display: 'inline-flex',
          height,
          justifyContent: 'center',
          width: height,
        }}
      >
        <HorseIcon fontSize={height * 0.7} weight="fill" />
      </Box>
      {emblem ? null : (
        <Box sx={{ color: text, lineHeight: 1 }}>
          <Typography sx={{ color: 'inherit', fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.1 }}>
            Racing Betting
          </Typography>
          <Typography sx={{ color: 'inherit', fontSize: '0.75rem', letterSpacing: '0.12em', opacity: 0.75 }}>
            SYNDICATE
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export interface DynamicLogoProps {
  colorDark?: Color;
  colorLight?: Color;
  emblem?: boolean;
  height?: number;
  width?: number;
}

export function DynamicLogo({ colorLight = 'dark', ...props }: DynamicLogoProps): React.JSX.Element {
  return <Logo color={colorLight} {...props} />;
}
