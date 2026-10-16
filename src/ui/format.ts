const LOCALE = 'es-PE';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  const units = ['KB', 'MB', 'GB'] as const;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value >= 100 ? 0 : 1;
  return `${value.toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${units[unit] ?? 'GB'}`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 1) return 'menos de 1 s';
  if (seconds < 60) return `${String(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes)} min ${String(seconds % 60).padStart(2, '0')} s`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString(LOCALE);
}

/** PDF points → millimetres. */
export function pointsToMm(points: number): number {
  return Math.round((points * 25.4) / 72);
}

export function percent(value: number, digits = 1): string {
  return `${(value * 100).toLocaleString(LOCALE, { maximumFractionDigits: digits })} %`;
}
