import { describe, expect, it } from 'vitest';
import { fitFromUnitWidth, fitText, type MeasureFn } from './text-fit';

/** 0.5 em per character: width = chars × size × 0.5 */
const linear: MeasureFn = (text, size) => text.length * size * 0.5;

describe('fitText', () => {
  it('keeps the maximum size when the text fits', () => {
    expect(fitText('Ana Ruiz', linear, 500, 40, 14)).toEqual({
      size: 40,
      width: 160,
      overflow: false,
    });
  });

  it('shrinks to the largest size that fits', () => {
    // 40 chars × 0.5 = 20 pt per pt of size → 300 / 20 = 15
    const result = fitText('x'.repeat(40), linear, 300, 40, 10);
    expect(result).toEqual({ size: 15, width: 300, overflow: false });
  });

  it('rounds down to 0.25 pt steps', () => {
    const result = fitText('x'.repeat(30), linear, 250, 40, 10);
    expect(result.size).toBe(16.5);
    expect(result.width).toBeLessThanOrEqual(250);
  });

  it('flags overflow when not even the minimum size fits', () => {
    const result = fitText('x'.repeat(100), linear, 300, 40, 14);
    expect(result).toEqual({ size: 14, width: 700, overflow: true });
  });

  it('accepts a text that fits exactly at the minimum size', () => {
    const result = fitText('x'.repeat(40), linear, 280, 40, 14);
    expect(result).toEqual({ size: 14, width: 280, overflow: false });
  });

  it('walks down when the measure is not linear', () => {
    // Wider than linear at small sizes (like hinting/kerning): the estimate does not fit.
    const nonLinear: MeasureFn = (text, size) => text.length * (size * 0.5 + 2);
    const result = fitText('x'.repeat(20), nonLinear, 300, 40, 8);
    expect(result.overflow).toBe(false);
    expect(nonLinear('x'.repeat(20), result.size)).toBeLessThanOrEqual(300);
    expect(nonLinear('x'.repeat(20), result.size + 0.25)).toBeGreaterThan(300);
  });

  it('treats empty text as fitting', () => {
    expect(fitText('', linear, 10, 30, 10)).toEqual({ size: 30, width: 0, overflow: false });
  });

  it('tolerates min > max by swapping them', () => {
    expect(fitText('x'.repeat(40), linear, 300, 10, 40).size).toBe(15);
  });

  it('overflows with a zero width box', () => {
    expect(fitText('Ana', linear, 0, 30, 10).overflow).toBe(true);
  });
});

describe('fitFromUnitWidth', () => {
  it('is the linear case of fitText', () => {
    expect(fitFromUnitWidth(20, 300, 40, 10)).toEqual({ size: 15, width: 300, overflow: false });
    expect(fitFromUnitWidth(0, 300, 40, 10)).toEqual({ size: 40, width: 0, overflow: false });
  });
});
