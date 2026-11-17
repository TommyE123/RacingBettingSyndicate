import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  icon?: React.ReactNode;
  color?: string;
  valueColor?: string;
  children?: React.ReactNode;
}

export function StatCard({ label, value, caption, icon, color, valueColor, children }: StatCardProps): React.JSX.Element {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Stack spacing={1}>
              <Typography color="text.secondary" variant="overline">
                {label}
              </Typography>
              <Typography color={valueColor} variant="h4">
                {value}
              </Typography>
            </Stack>
            {icon ? (
              <Avatar sx={{ bgcolor: color ?? 'var(--mui-palette-primary-main)', height: 48, width: 48 }}>{icon}</Avatar>
            ) : null}
          </Stack>
          {caption ? (
            <Typography color="text.secondary" variant="body2">
              {caption}
            </Typography>
          ) : null}
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}
