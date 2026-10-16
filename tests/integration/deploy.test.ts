import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from '../../deploy/headers';
import { ROOT_DIR } from './helpers';

interface VercelConfig {
  outputDirectory: string;
  buildCommand: string;
  headers: { source: string; headers: { key: string; value: string }[] }[];
}

describe('vercel.json', () => {
  it('serves the static build and declares the same security headers as `vite preview`', async () => {
    const config = JSON.parse(
      await readFile(join(ROOT_DIR, 'vercel.json'), 'utf8'),
    ) as VercelConfig;
    expect(config.outputDirectory).toBe('dist');
    expect(config.buildCommand).toBe('npm run build');
    const global = config.headers.find((entry) => entry.source === '/(.*)');
    expect(Object.fromEntries((global?.headers ?? []).map((h) => [h.key, h.value]))).toEqual(
      SECURITY_HEADERS,
    );
    expect(config.headers.some((entry) => entry.source === '/assets/(.*)')).toBe(true);
  });
});
