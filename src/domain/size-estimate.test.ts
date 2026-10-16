import { describe, expect, it } from 'vitest';
import { estimateOutputSize } from './size-estimate';

const sample = {
  individualSizes: [100_000, 110_000],
  mergedSmall: { pages: 10, bytes: 150_000 },
  mergedLarge: { pages: 20, bytes: 200_000 },
};

describe('estimateOutputSize', () => {
  it('estimates the ZIP from the average individual size', () => {
    const { zipBytes, mergedBytes } = estimateOutputSize(sample, 360, 'zip');
    expect(mergedBytes).toBeNull();
    expect(zipBytes).toBeGreaterThan(360 * 105_000);
    expect(zipBytes).toBeLessThan(360 * 105_000 * 1.01);
  });

  it('estimates the merged PDF from the marginal size per page between two samples', () => {
    const { zipBytes, mergedBytes } = estimateOutputSize(sample, 360, 'merged');
    expect(zipBytes).toBeNull();
    // (200 - 150) KB / 10 pages = 5 KB per page
    expect(mergedBytes).toBe(200_000 + 5_000 * 340);
  });

  it('estimates both, also for lists smaller than the sample', () => {
    const both = estimateOutputSize(sample, 5, 'both');
    expect(both.zipBytes).not.toBeNull();
    expect(both.mergedBytes).toBe(200_000 - 5_000 * 15);
  });

  it('handles empty samples and equal page counts', () => {
    const empty = estimateOutputSize(
      {
        individualSizes: [],
        mergedSmall: { pages: 1, bytes: 10 },
        mergedLarge: { pages: 1, bytes: 10 },
      },
      0,
      'both',
    );
    expect(empty.mergedBytes).toBe(10);
    expect(empty.zipBytes).toBeGreaterThan(0);
  });
});
