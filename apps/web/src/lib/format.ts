const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
const number = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${number.format(value)} ${UNITS[unit] ?? 'B'}`;
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.35],
  ['month', 12],
  ['year', Infinity],
];

/** "just now", "5 minutes ago", "yesterday", … */
export function formatRelative(iso: string, now: Date = new Date()): string {
  let value = (new Date(iso).getTime() - now.getTime()) / 1000;
  if (Math.abs(value) < 45) return 'just now';
  for (const [unit, size] of STEPS) {
    if (Math.abs(value) < size) return relative.format(Math.round(value), unit);
    value /= size;
  }
  return relative.format(Math.round(value), 'year');
}
