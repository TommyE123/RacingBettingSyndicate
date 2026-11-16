import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type { AuditEntry } from '@/types/api';
import { formatPence } from '@/lib/money';

const ACTIONS: Record<string, string> = {
  'auth.login': 'Signed in',
  'user.bootstrapped': 'First admin created',
  'user.created': 'User created',
  'user.updated': 'User changed',
  'user.password_changed': 'Password changed',
  'competition.created': 'Competition created',
  'competition.updated': 'Competition changed',
  'day.added': 'Day added',
  'day.removed': 'Day removed',
  'entry.added': 'Entered',
  'entry.removed': 'Entry removed',
  'slip.created': 'Bet entered',
  'slip.updated': 'Bet edited',
  'slip.return_set': 'Return entered',
  'slip.return_cleared': 'Return cleared',
  'slip.voided': 'Bet voided',
  'slip.restored': 'Bet restored',
  'sheet.uploaded': 'Sheet uploaded',
  'sheet.updated': 'Sheet changed',
  'sheet.deleted': 'Sheet deleted',
};

export function describeAction(action: string): string {
  return ACTIONS[action] ?? action;
}

const LABELS: Record<string, string> = {
  stake_pence: 'Total stake',
  unit_stake_pence: 'Stake per bet',
  return_pence: 'Return',
  budget_pence: 'Budget',
  stated_total_pence: 'Written total',
  line_count: 'Bets',
  bet_type: 'Bet type',
  fold_size: 'Perm size',
  each_way: 'Each way',
  day_id: 'Day',
  display_name: 'Name',
  is_active: 'Active',
  sheet_id: 'Sheet',
};

function show(key: string, value: unknown): string {
  if (value === null || value === undefined) {
    return 'none';
  }
  if (key.endsWith('_pence') && typeof value === 'number') {
    return formatPence(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no';
  }
  if (key === 'selections' && Array.isArray(value)) {
    return (value as unknown[][]).map((leg) => `${String(leg[1])} ${String(leg[2])}`).join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

// A readable summary of an audit row's detail: "Return: none → £86.50".
export function AuditDetail({ entry }: { entry: AuditEntry }): React.JSX.Element | null {
  const detail = entry.detail ?? {};
  const changes = detail.changes as Record<string, unknown> | undefined;
  const lines: string[] = [];
  if (changes && typeof changes === 'object') {
    for (const [key, change] of Object.entries(changes)) {
      if (change && typeof change === 'object' && 'from' in change && 'to' in change) {
        const { from, to } = change as { from: unknown; to: unknown };
        lines.push(`${LABELS[key] ?? key.replaceAll('_', ' ')}: ${show(key, from)} → ${show(key, to)}`);
      } else {
        lines.push(`${LABELS[key] ?? key}: ${show(key, change)}`);
      }
    }
  } else {
    for (const [key, value] of Object.entries(detail)) {
      if (key === 'competition_id' || value === null) {
        continue;
      }
      lines.push(`${LABELS[key] ?? key.replaceAll('_', ' ')}: ${show(key, value)}`);
    }
  }
  if (lines.length === 0) {
    return null;
  }
  return (
    <Box sx={{ mt: 0.5 }}>
      {lines.map((line) => (
        <Typography color="text.secondary" key={line} sx={{ display: 'block', wordBreak: 'break-word' }} variant="caption">
          {line}
        </Typography>
      ))}
    </Box>
  );
}
