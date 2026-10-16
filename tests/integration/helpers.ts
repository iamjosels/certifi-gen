import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { SourceFile } from '../../src/application/ports';

export const FIXTURES_DIR = join(import.meta.dirname, '..', '..', 'fixtures');
export const ROOT_DIR = join(import.meta.dirname, '..', '..');

export interface Expected {
  count: number;
  names: string[];
  blankRows: number;
  columns: string[];
  duplicateGroups: number[][];
  samples: {
    first: string;
    last: string;
    longest: string;
    withEnye: string;
    withApostrophe: string;
    withHyphen: string;
    withDiaeresis: string;
    normal: string;
    longNames: string[];
  };
}

export async function readFixture(name: string): Promise<SourceFile> {
  const bytes = new Uint8Array(await readFile(join(FIXTURES_DIR, name)));
  return { name: basename(name), bytes };
}

export async function readExpected(): Promise<Expected> {
  return JSON.parse(await readFile(join(FIXTURES_DIR, 'expected.json'), 'utf8')) as Expected;
}
