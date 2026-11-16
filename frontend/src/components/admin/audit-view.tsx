'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import type { ApiUser, AuditEntry } from '@/types/api';
import { paths } from '@/paths';
import { api, errorMessage, withQuery } from '@/lib/api';
import { formatDateTime } from '@/lib/days';
import { useApi } from '@/hooks/use-api';
import { PageHeader } from '@/components/common/page-header';
import { ErrorAlert, Loading } from '@/components/common/states';

import { AdminOnly } from './admin-only';
import { AuditDetail, describeAction } from './audit-detail';

const PAGE = 100;

export function AuditView(): React.JSX.Element {
  return (
    <AdminOnly>
      <Audit />
    </AdminOnly>
  );
}

function entityLink(entry: AuditEntry): React.ReactNode {
  if (entry.entity_id === null) {
    return entry.entity_type;
  }
  if (entry.entity_type === 'slip') {
    return (
      <Link component={RouterLink} href={paths.dashboard.bet(entry.entity_id)}>
        Bet #{entry.entity_id}
      </Link>
    );
  }
  if (entry.entity_type === 'sheet' && entry.action !== 'sheet.deleted') {
    return (
      <Link component={RouterLink} href={paths.dashboard.sheet(entry.entity_id)}>
        Sheet #{entry.entity_id}
      </Link>
    );
  }
  if (entry.entity_type === 'competition') {
    return (
      <Link component={RouterLink} href={paths.dashboard.admin.competition(entry.entity_id)}>
        Competition #{entry.entity_id}
      </Link>
    );
  }
  return `${entry.entity_type.replace('_', ' ')} #${entry.entity_id}`;
}

function Audit(): React.JSX.Element {
  const users = useApi<ApiUser[]>('/api/admin/users');
  const [entity, setEntity] = React.useState('');
  const [actor, setActor] = React.useState('');
  const [rows, setRows] = React.useState<AuditEntry[]>([]);
  const [busy, setBusy] = React.useState(true);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (before: number | null): Promise<void> => {
      setBusy(true);
      setError(null);
      try {
        const page = await api<AuditEntry[]>(
          withQuery('/api/admin/audit', {
            limit: PAGE,
            before_id: before,
            entity_type: entity || null,
            actor_user_id: actor || null,
          })
        );
        setRows((current) => (before === null ? page : [...current, ...page]));
        setDone(page.length < PAGE);
      } catch (error_) {
        setError(errorMessage(error_));
      } finally {
        setBusy(false);
      }
    },
    [entity, actor]
  );

  React.useEffect(() => {
    load(null).catch(() => {
      // load reports its own errors
    });
  }, [load]);

  return (
    <Stack spacing={3}>
      <PageHeader subtitle="Every change anyone has made, newest first. Nothing here can be edited." title="Audit log" />
      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="What"
              onChange={(event) => {
                setEntity(event.target.value);
              }}
              select
              size="small"
              sx={{ minWidth: 200 }}
              value={entity}
            >
              <MenuItem value="">Everything</MenuItem>
              <MenuItem value="slip">Bets</MenuItem>
              <MenuItem value="sheet">Sheets</MenuItem>
              <MenuItem value="user">Users</MenuItem>
              <MenuItem value="competition">Competitions</MenuItem>
              <MenuItem value="competition_day">Days</MenuItem>
              <MenuItem value="entry">Entries</MenuItem>
            </TextField>
            <TextField
              label="Who"
              onChange={(event) => {
                setActor(event.target.value);
              }}
              select
              size="small"
              sx={{ minWidth: 200 }}
              value={actor}
            >
              <MenuItem value="">Anyone</MenuItem>
              {(users.data ?? []).map((user) => (
                <MenuItem key={user.id} value={String(user.id)}>
                  {user.display_name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>
      {error ? <ErrorAlert message={error} /> : null}
      <Card>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Who</TableCell>
                <TableCell>What</TableCell>
                <TableCell>On</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((entry) => (
                <TableRow hover key={entry.id} sx={{ verticalAlign: 'top' }}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(entry.at)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{entry.actor_name ?? 'System'}</TableCell>
                  <TableCell>
                    <Chip label={describeAction(entry.action)} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{entityLink(entry)}</TableCell>
                  <TableCell sx={{ maxWidth: 420 }}>
                    <AuditDetail entry={entry} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        {busy ? <Loading /> : null}
        {!busy && rows.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 3 }} variant="body2">
            Nothing matches.
          </Typography>
        ) : null}
      </Card>
      {!done && rows.length > 0 ? (
        <div>
          <Button
            disabled={busy}
            onClick={() => {
              load(rows.at(-1)?.id ?? null).catch(() => {
                // load reports its own errors
              });
            }}
            variant="outlined"
          >
            Load older
          </Button>
        </div>
      ) : null}
    </Stack>
  );
}
