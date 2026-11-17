// Matches app/bets.py horse_key: case, spaces and punctuation do not matter.
export function horseKey(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}]/gu, '')
    .replaceAll(/\p{M}/gu, '');
}

// For libraries that build labels with innerHTML (ApexCharts' legend and tooltip): the text
// then shows exactly as typed and can never become markup.
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
