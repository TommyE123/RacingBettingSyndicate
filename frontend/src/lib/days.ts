import dayjs from 'dayjs';

import type { Day } from '@/types/api';

export function dayName(day: Day | undefined | null): string {
  if (!day) {
    return '—';
  }
  const date = dayjs(day.date).format('ddd D MMM');
  return day.label ? `${date} · ${day.label}` : date;
}

export function shortDayName(day: Day | undefined | null): string {
  return day ? dayjs(day.date).format('ddd D MMM') : '—';
}

// The festival day matching today's date, else the next one, else the last.
export function defaultDay(days: Day[]): Day | undefined {
  if (days.length === 0) {
    return undefined;
  }
  const today = dayjs().format('YYYY-MM-DD');
  return days.find((day) => day.date === today) ?? days.find((day) => day.date > today) ?? days.at(-1);
}

export function formatDateTime(value: string): string {
  return dayjs(value).format('D MMM YYYY, HH:mm');
}

export function formatTime(value: string): string {
  return dayjs(value).format('ddd HH:mm');
}
