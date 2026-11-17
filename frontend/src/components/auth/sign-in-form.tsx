'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { EyeIcon } from '@phosphor-icons/react/dist/ssr/Eye';
import { EyeSlashIcon } from '@phosphor-icons/react/dist/ssr/EyeSlash';

import { paths } from '@/paths';
import { authClient } from '@/lib/auth/client';
import { useUser } from '@/hooks/use-user';

export function SignInForm(): React.JSX.Element {
  const router = useRouter();
  const { setUser } = useUser();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter your username and password');
      return;
    }
    setIsPending(true);
    setError(null);
    const result = await authClient.signIn({ username: username.trim(), password });
    if (result.error) {
      setError(result.error);
      setIsPending(false);
      return;
    }
    setUser?.(result.user ?? null);
    router.replace(paths.dashboard.overview);
  };

  return (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Typography variant="h4">Sign in</Typography>
        <Typography color="text.secondary" variant="body2">
          Use the username and password an admin gave you.
        </Typography>
      </Stack>
      <form noValidate onSubmit={onSubmit}>
        <Stack spacing={2}>
          <TextField
            autoCapitalize="none"
            autoComplete="username"
            autoFocus
            label="Username"
            onChange={(event) => {
              setUsername(event.target.value);
            }}
            slotProps={{ htmlInput: { autoCorrect: 'off', spellCheck: false } }}
            value={username}
          />
          <TextField
            autoComplete="current-password"
            label="Password"
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      edge="end"
                      onClick={() => {
                        setShowPassword((value) => !value);
                      }}
                    >
                      {showPassword ? <EyeIcon /> : <EyeSlashIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
            type={showPassword ? 'text' : 'password'}
            value={password}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Button disabled={isPending} size="large" type="submit" variant="contained">
            {isPending ? 'Signing in…' : 'Sign in'}
          </Button>
          <Link component={RouterLink} href={paths.auth.resetPassword} variant="body2">
            Forgotten your password?
          </Link>
        </Stack>
      </form>
    </Stack>
  );
}
