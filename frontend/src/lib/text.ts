// Matches app/bets.py horse_key: case, spaces and punctuation do not matter.
export function horseKey(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}]/gu, '')
    .replaceAll(/\p{M}/gu, '');
}
