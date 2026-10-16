export interface ProgressSnapshot {
  readonly done: number;
  readonly total: number;
  /** Milliseconds since the generation started. */
  readonly elapsedMs: number;
}

export interface ProgressEstimate {
  /** 0..1 */
  readonly fraction: number;
  /** Certificates per second, or null before the first batch. */
  readonly rate: number | null;
  /** Estimated milliseconds left, or null when unknown. */
  readonly remainingMs: number | null;
}

/** Linear estimate from the average rate so far (stable enough with batches of ~10–25). */
export function estimateProgress({ done, total, elapsedMs }: ProgressSnapshot): ProgressEstimate {
  const safeTotal = Math.max(total, 0);
  const clampedDone = Math.min(Math.max(done, 0), safeTotal);
  const fraction = safeTotal === 0 ? 1 : clampedDone / safeTotal;
  if (clampedDone === 0 || elapsedMs <= 0) {
    return { fraction, rate: null, remainingMs: clampedDone === safeTotal ? 0 : null };
  }
  const rate = clampedDone / (elapsedMs / 1000);
  const remainingMs = ((safeTotal - clampedDone) / rate) * 1000;
  return { fraction, rate, remainingMs };
}

/** Splits `total` items into consecutive batches of at most `size` (last one may be shorter). */
export function batchRanges(total: number, size: number): { start: number; end: number }[] {
  const step = Math.max(1, Math.floor(size));
  const ranges: { start: number; end: number }[] = [];
  for (let start = 0; start < total; start += step) {
    ranges.push({ start, end: Math.min(total, start + step) });
  }
  return ranges;
}
