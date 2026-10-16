import { describe, expect, it } from 'vitest';
import { estimateOutputSize } from './size-estimate';

const sample = {
  individualSizes: [100_000, 110_000],
  mergedSampleSize: 140_000,
  mergedSamplePages: 5,
  mergedSinglePageSize: 100_000,
};

describe('estimateOutputSize', () => {
  it('estimates the ZIP from the average individual size', () => {
    const { zipBytes, mergedBytes } = estimateOutputSize(sample, 360, 'zip');
    expect(mergedBytes).toBeNull();
    expect(zipBytes).toBeGreaterThan(360 * 105_000);
    expect(zipBytes).toBeLessThan(360 * 105_000 * 1.01);
  });

  it('estimates the merged PDF as base + marginal size per page', () => {
    const { zipBytes, mergedBytes } = estimateOutputSize(sample, 360, 'merged');
    expect(zipBytes).toBeNull();
    // 100 KB for the first page, (140 - 100) / 4 = 10 KB per extra page
    expect(mergedBytes).toBe(100_000 + 10_000 * 359);
  });

  it('estimates both', () => {
    const both = estimateOutputSize(sample, 10, 'both');
    expect(both.zipBytes).not.toBeNull();
    expect(both.mergedBytes).toBe(100_000 + 10_000 * 9);
  });

  it('handles empty samples and a single page sample', () => {
    const empty = estimateOutputSize(
      { individualSizes: [], mergedSampleSize: 0, mergedSamplePages: 1, mergedSinglePageSize: 0 },
      0,
      'both',
    );
    expect(empty.mergedBytes).toBe(0);
    expect(empty.zipBytes).toBeGreaterThan(0);
  });
});
