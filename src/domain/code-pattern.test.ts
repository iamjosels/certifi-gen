import { describe, expect, it } from 'vitest';
import { formatCode, isValidCodePattern, parseCodePattern } from './code-pattern';
import { AppError } from './errors';

describe('formatCode', () => {
  it('pads with the number of zeros of the pattern', () => {
    expect(formatCode('CERT-2026-{n:000}', 1)).toBe('CERT-2026-001');
    expect(formatCode('CERT-2026-{n:000}', 42)).toBe('CERT-2026-042');
    expect(formatCode('CERT-2026-{n:000}', 360)).toBe('CERT-2026-360');
  });

  it('never truncates numbers longer than the padding', () => {
    expect(formatCode('{n:00}', 1000)).toBe('1000');
  });

  it('supports unpadded numbers, several tokens and literal braces', () => {
    expect(formatCode('N° {n}', 7)).toBe('N° 7');
    expect(formatCode('{n:0000}/{n}', 12)).toBe('0012/12');
    expect(formatCode('{{lote}}-{n:00}', 3)).toBe('{lote}-03');
    expect(formatCode('}{n}', 3)).toBe('}3');
  });

  it('rejects invalid numbers', () => {
    expect(() => formatCode('{n}', -1)).toThrow(AppError);
    expect(() => formatCode('{n}', 1.5)).toThrow(AppError);
  });
});

describe('parseCodePattern / isValidCodePattern', () => {
  it('requires a {n} token', () => {
    expect(isValidCodePattern('CERT-2026')).toBe(false);
    expect(() => parseCodePattern('CERT')).toThrow(/missing/);
  });

  it('rejects unknown or malformed tokens', () => {
    expect(isValidCodePattern('{x}-{n}')).toBe(false);
    expect(isValidCodePattern('{n:abc}')).toBe(false);
    expect(isValidCodePattern('{n:000')).toBe(false);
    expect(isValidCodePattern('{n} {')).toBe(false);
  });

  it('accepts valid patterns', () => {
    expect(isValidCodePattern('CERT-{n:000}')).toBe(true);
    expect(parseCodePattern('A{n}B')).toEqual([
      { kind: 'text', value: 'A' },
      { kind: 'number', pad: 0 },
      { kind: 'text', value: 'B' },
    ]);
  });
});
