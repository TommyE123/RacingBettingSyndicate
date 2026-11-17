import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function Loading({ label = 'Loading…' }: { label?: string }): React.JSX.Element {
  return (
    <Stack spacing={2} sx={{ alignItems: 'center', py: 6 }}>
      <CircularProgress size={32} />
      <Typography color="text.secondary" variant="body2">
        {label}
      </Typography>
    </Stack>
  );
}

export function ErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }): React.JSX.Element {
  return (
    <Alert
      action={
        onRetry ? (
          <Button color="inherit" onClick={onRetry} size="small">
            Try again
          </Button>
        ) : undefined
      }
      severity="error"
    >
      {message}
    </Alert>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}): React.JSX.Element {
  return (
    <Card variant="outlined" sx={{ borderStyle: 'dashed' }}>
      <Stack spacing={1.5} sx={{ alignItems: 'center', px: 3, py: 5, textAlign: 'center' }}>
        {icon ? <Box sx={{ color: 'text.secondary', fontSize: 40, lineHeight: 0 }}>{icon}</Box> : null}
        <Typography variant="h6">{title}</Typography>
        {description ? (
          <Typography color="text.secondary" sx={{ maxWidth: 480 }} variant="body2">
            {description}
          </Typography>
        ) : null}
        {action}
      </Stack>
    </Card>
  );
}
