import { describe, expect, it } from 'vitest';
import { AppError, isAppError } from './errors';

describe('AppError', () => {
  it('carries a code, an optional detail and a cause', () => {
    const cause = new Error('low level');
    const error = new AppError('template-pdf-damaged', 'xref', { cause });
    expect(error.code).toBe('template-pdf-damaged');
    expect(error.detail).toBe('xref');
    expect(error.message).toBe('template-pdf-damaged: xref');
    expect(error.cause).toBe(cause);
    expect(error.name).toBe('AppError');
  });

  it('works without detail', () => {
    expect(new AppError('list-empty').message).toBe('list-empty');
  });

  it('is recognized by isAppError', () => {
    expect(isAppError(new AppError('list-empty'))).toBe(true);
    expect(isAppError(new Error('x'))).toBe(false);
  });
});
