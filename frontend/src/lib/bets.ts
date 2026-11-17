import type { BetType, Slip } from '@/types/api';
import { formatPence, formatStake } from '@/lib/money';

export function combinations(n: number, k: number): number {
  if (k < 0 || k > n) {
    return 0;
  }
  let result = 1;
  for (let index = 1; index <= k; index += 1) {
    result = (result * (n - k + index)) / index;
  }
  return Math.round(result);
}

export function foldName(size: number, plural = true): string {
  if (size === 1) {
    return plural ? 'Singles' : 'Single';
  }
  if (size === 2) {
    return plural ? 'Doubles' : 'Double';
  }
  if (size === 3) {
    return plural ? 'Trebles' : 'Treble';
  }
  return plural ? `${size}-folds` : `${size}-fold`;
}

// Lines for a bet type, or an explanation of why it does not add up yet.
export function linesFor(
  betType: BetType | undefined,
  selections: number,
  foldSize: number | null
): { lines: number | null; problem: string | null } {
  if (!betType) {
    return { lines: null, problem: 'Choose a bet type' };
  }
  if (selections < betType.min_selections || selections > betType.max_selections) {
    const needed =
      betType.min_selections === betType.max_selections
        ? `${betType.min_selections}`
        : `${betType.min_selections} to ${betType.max_selections}`;
    return { lines: null, problem: `A ${betType.label} needs ${needed} horses (you have ${selections})` };
  }
  if (betType.key === 'perm') {
    if (!foldSize || foldSize < 1 || foldSize > selections) {
      return { lines: null, problem: 'Choose the perm size' };
    }
    return { lines: combinations(selections, foldSize), problem: null };
  }
  return { lines: betType.fixed_lines, problem: null };
}

export function betTitle(slip: Pick<Slip, 'bet_type' | 'bet_label' | 'fold_size' | 'selections'>): string {
  if (slip.bet_type === 'perm' && slip.fold_size) {
    return `${foldName(slip.fold_size)} from ${slip.selections.length}`;
  }
  return slip.bet_label;
}

// "£1 e/w Lucky 15", as people write it.
export function betHeadline(slip: Slip): string {
  return `${formatStake(slip.unit_stake_pence)} ${slip.each_way ? 'e/w ' : ''}${betTitle(slip)}`;
}

// "15 bets × £1 × 2 (each way) = £30.00"
export function stakeBreakdown(slip: Pick<Slip, 'line_count' | 'unit_stake_pence' | 'each_way' | 'stake_pence'>): string {
  const bets = `${slip.line_count} bet${slip.line_count === 1 ? '' : 's'}`;
  const each = formatStake(slip.unit_stake_pence);
  return `${bets} × ${each}${slip.each_way ? ' × 2 each way' : ''} = ${formatPence(slip.stake_pence)}`;
}

export type SlipStatus = 'void' | 'pending' | 'won' | 'lost';

export function slipStatus(slip: Slip): SlipStatus {
  if (slip.voided_at) {
    return 'void';
  }
  if (slip.return_pence === null) {
    return 'pending';
  }
  return slip.return_pence > 0 ? 'won' : 'lost';
}

const LINE_PATTERN = /^\s*(?:[-*•]\s*)?(\d{1,2}\s*[:.]\s*\d{2})\s*(?:[-–—:|]\s*)?(.+?)\s*$/;

// Reads pasted lines like "2:10 - Gaelic Warrior" or "14.10 Gaelic Warrior (top 4)".
export function parsePastedHorses(text: string): { race_time: string; horse_name: string; note: string }[] {
  const rows: { race_time: string; horse_name: string; note: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = LINE_PATTERN.exec(line);
    if (!match) {
      continue;
    }
    let name = match[2].replace(/\s*£.*$/, '').trim();
    let note = '';
    const bracket = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(name);
    if (bracket) {
      name = bracket[1].trim();
      note = bracket[2].trim();
    }
    if (name) {
      rows.push({ race_time: match[1].replaceAll(/\s/g, ''), horse_name: name, note });
    }
  }
  return rows;
}
