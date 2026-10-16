import { describe, expect, it } from 'vitest';
import { batchRanges, estimateProgress } from './progress';

describe('estimateProgress', () => {
  it('estimates the remaining time from the average rate', () => {
    const estimate = estimateProgress({ done: 120, total: 360, elapsedMs: 6000 });
    expect(estimate.fraction).toBeCloseTo(1 / 3);
    expect(estimate.rate).toBe(20);
    expect(estimate.remainingMs).toBe(12000);
  });

  it('is unknown before the first batch', () => {
    expect(estimateProgress({ done: 0, total: 360, elapsedMs: 500 })).toEqual({
      fraction: 0,
      rate: null,
      remainingMs: null,
    });
    expect(estimateProgress({ done: 10, total: 360, elapsedMs: 0 }).remainingMs).toBeNull();
  });

  it('finishes at zero remaining', () => {
    expect(estimateProgress({ done: 360, total: 360, elapsedMs: 9000 }).remainingMs).toBe(0);
    expect(estimateProgress({ done: 0, total: 0, elapsedMs: 0 })).toEqual({
      fraction: 1,
      rate: null,
      remainingMs: 0,
    });
  });

  it('clamps out-of-range values', () => {
    expect(estimateProgress({ done: 500, total: 360, elapsedMs: 1000 }).fraction).toBe(1);
    expect(estimateProgress({ done: -3, total: 360, elapsedMs: 1000 }).fraction).toBe(0);
  });
});

describe('batchRanges', () => {
  it('splits into consecutive batches', () => {
    expect(batchRanges(55, 25)).toEqual([
      { start: 0, end: 25 },
      { start: 25, end: 50 },
      { start: 50, end: 55 },
    ]);
    expect(batchRanges(0, 25)).toEqual([]);
    expect(batchRanges(3, 0)).toHaveLength(3);
  });
});
