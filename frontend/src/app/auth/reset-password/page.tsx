import * as React from 'react';
import type { Metadata } from 'next';
import RouterLink from 'next/link';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { config } from '@/config';
import { paths } from '@/paths';
import { Layout } from '@/components/auth/layout';

export const metadata = { title: `Forgotten password | ${config.site.name}` } satisfies Metadata;

export default function Page(): React.JSX.Element {
  return (
    <Layout>
      <Stack spacing={3}>
        <Typography variant="h4">Forgotten your password?</Typography>
        <Typography color="text.secondary">
          Ask one of the syndicate admins to reset it. They will give you a new password, and you can change it to
          one of your own from My account once you are signed in.
        </Typography>
        <Button component={RouterLink} href={paths.auth.signIn} variant="contained">
          Back to sign in
        </Button>
      </Stack>
    </Layout>
  );
}
