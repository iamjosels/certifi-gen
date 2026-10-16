import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FIXTURES = join(import.meta.dirname, '..', '..', 'fixtures');

describe('generated fixtures (smoke)', () => {
  it('provides the 360-participant ground truth', async () => {
    const expected = JSON.parse(await readFile(join(FIXTURES, 'expected.json'), 'utf8')) as {
      count: number;
      names: string[];
    };
    expect(expected.count).toBe(360);
    expect(expected.names).toHaveLength(360);
  });

  it('provides a heavy PNG template over 3 MB', async () => {
    const info = await stat(join(FIXTURES, 'plantilla-pesada.png'));
    expect(info.size).toBeGreaterThan(3 * 1024 * 1024);
  });
});
