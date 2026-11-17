// Money is whole pence everywhere; these helpers turn it into pounds for people.

const formatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

export function formatPence(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) {
    return '—';
  }
  return formatter.format(pence / 100);
}

export function formatProfit(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) {
    return '—';
  }
  if (pence === 0) {
    return formatter.format(0);
  }
  const amount = formatter.format(Math.abs(pence) / 100);
  return pence > 0 ? `+${amount}` : `−${amount}`;
}

// Short form for stakes on slips: "£1", "50p", "£2.50".
export function formatStake(pence: number): string {
  if (pence < 100) {
    return `${pence}p`;
  }
  return pence % 100 === 0 ? `£${(pence / 100).toLocaleString('en-GB')}` : formatter.format(pence / 100);
}

const MONEY_PATTERN = /^£?\s*(\d{1,3}(,\d{3})+|\d+)?(\.(\d{1,2}))?\s*$/;
const PENCE_PATTERN = /^(\d+)\s*p$/i;

// Reads "30", "£30", "30.5", "£1,000.00", "0.50" or "50p". Returns null if it is not money.
export function parsePounds(input: string): number | null {
  const text = input.trim();
  if (!text) {
    return null;
  }
  const pence = PENCE_PATTERN.exec(text);
  if (pence) {
    return Number.parseInt(pence[1], 10);
  }
  const match = MONEY_PATTERN.exec(text);
  if (!match || (match[1] === undefined && match[4] === undefined)) {
    return null;
  }
  const pounds = match[1] ? Number.parseInt(match[1].replaceAll(',', ''), 10) : 0;
  const fraction = match[4] ? Number.parseInt(match[4].padEnd(2, '0'), 10) : 0;
  return pounds * 100 + fraction;
}

export function penceToInput(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) {
    return '';
  }
  return (pence / 100).toFixed(2).replace(/\.00$/, '');
}

export function profitColor(pence: number | null | undefined): string {
  if (!pence) {
    return 'text.primary';
  }
  return pence > 0 ? 'success.main' : 'error.main';
}

export function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${Math.round(value * 100)}%`;
}
