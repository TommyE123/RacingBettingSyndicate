import * as React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { TrophyIcon } from '@phosphor-icons/react/dist/ssr/Trophy';

import { Logo } from '@/components/core/logo';

export interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps): React.JSX.Element {
  return (
    <Box
      sx={{
        display: { xs: 'flex', lg: 'grid' },
        flexDirection: 'column',
        gridTemplateColumns: '1fr 1fr',
        minHeight: '100%',
      }}
    >
      <Box sx={{ display: 'flex', flex: '1 1 auto', flexDirection: 'column' }}>
        <Box sx={{ p: 3 }}>
          <Logo height={40} />
        </Box>
        <Box sx={{ alignItems: 'center', display: 'flex', flex: '1 1 auto', justifyContent: 'center', p: 3 }}>
          <Box sx={{ maxWidth: '420px', width: '100%' }}>{children}</Box>
        </Box>
      </Box>
      <Box
        sx={{
          alignItems: 'center',
          background: 'radial-gradient(60% 60% at 50% 40%, #0f5132 0%, #06251a 100%)',
          color: 'var(--mui-palette-common-white)',
          display: { xs: 'none', lg: 'flex' },
          justifyContent: 'center',
          p: 6,
        }}
      >
        <Stack spacing={4} sx={{ maxWidth: 480 }}>
          <Typography color="inherit" sx={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.2 }} variant="h1">
            £500 each. One week. Two trophies.
          </Typography>
          <Typography color="inherit" sx={{ opacity: 0.85 }} variant="subtitle1">
            Post your bets before the first race, enter your returns after the last, and watch the leaderboard settle
            who takes home what.
          </Typography>
          <Stack spacing={2}>
            <Trophy name="Bob Addis Memorial Trophy" detail="Most profit. Stays at Looker's bar in Lanzarote." />
            <Trophy name="JFK Blowout Trophy" detail="Biggest loss. Goes home with you, somewhere prominent." />
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

function Trophy({ name, detail }: { name: string; detail: string }): React.JSX.Element {
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
      <Box sx={{ color: '#f5c542', lineHeight: 0 }}>
        <TrophyIcon fontSize={36} weight="fill" />
      </Box>
      <div>
        <Typography color="inherit" variant="subtitle1">
          {name}
        </Typography>
        <Typography color="inherit" sx={{ opacity: 0.75 }} variant="body2">
          {detail}
        </Typography>
      </div>
    </Stack>
  );
}
