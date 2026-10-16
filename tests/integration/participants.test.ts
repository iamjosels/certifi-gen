import { beforeAll, describe, expect, it } from 'vitest';
import { applyLayout, parseParticipants } from '../../src/application/parse-participants';
import { createParserRegistry } from '../../src/infrastructure/parsers/registry';
import { readExpected, readFixture, type Expected } from './helpers';

const registry = createParserRegistry();
let expected: Expected;

beforeAll(async () => {
  expected = await readExpected();
});

const FORMATS = [
  { file: 'participantes-360.txt', format: 'txt', encoding: 'utf-8', columns: false },
  { file: 'participantes-360.csv', format: 'csv', encoding: 'utf-8', columns: true },
  {
    file: 'participantes-360-windows1252.csv',
    format: 'csv',
    encoding: 'windows-1252',
    columns: true,
  },
  { file: 'participantes-360.xlsx', format: 'xlsx', encoding: null, columns: true },
  { file: 'participantes-360.docx', format: 'docx', encoding: null, columns: false },
] as const;

describe.each(FORMATS)('$file', ({ file, format, encoding, columns }) => {
  it('reads exactly the same 360 valid participants with correct accents', async () => {
    const result = await parseParticipants(await readFixture(file), registry);
    expect(result.format).toBe(format);
    expect(result.encoding).toBe(encoding);
    expect(result.list.participants.map((p) => p.name)).toEqual(expected.names);
    expect(result.list.report.valid).toBe(360);
  });

  it('reports discarded empty rows and duplicates', async () => {
    const { list } = await parseParticipants(await readFixture(file), registry);
    expect(list.report.emptyDiscarded).toBe(expected.blankRows);
    expect(list.report.duplicateGroups.map((group) => group.indexes)).toEqual(
      expected.duplicateGroups,
    );
  });

  it('detects the header and the name column', async () => {
    const { layout } = await parseParticipants(await readFixture(file), registry);
    if (columns) {
      expect(layout.hasHeader).toBe(true);
      expect(layout.columns).toEqual(expected.columns);
      expect(layout.nameColumn).toBe(0);
    } else {
      expect(layout.hasHeader).toBe(false);
      expect(layout.columns).toHaveLength(1);
    }
  });
});

describe('special characters survive every format', () => {
  it.each(FORMATS.map((f) => f.file))('%s', async (file) => {
    const { list } = await parseParticipants(await readFixture(file), registry);
    const names = list.participants.map((p) => p.name);
    for (const name of [
      "Seán O'Connor",
      'Liam O’Neill',
      'María-José López',
      'Begoña Núñez Ibáñez',
      'Mario Güemes Argüello',
      'Zoë Agüero',
      'María de los Ángeles Fernández-Villaverde y Santisteban',
    ]) {
      expect(names).toContain(name);
    }
  });
});

describe('columns from CSV and XLSX', () => {
  it('keeps the other columns as participant fields', async () => {
    const { list } = await parseParticipants(await readFixture('participantes-360.xlsx'), registry);
    const first = list.participants[0];
    expect(first?.fields.Correo).toMatch(/@ejemplo\.edu\.pe$/);
    expect(first?.fields.Curso).toBeTruthy();
  });

  it('lets the user choose another name column without reading the file again', async () => {
    const result = await parseParticipants(await readFixture('participantes-360.csv'), registry);
    const byMail = applyLayout(result.table, { nameColumn: 1 });
    expect(byMail.layout.nameColumn).toBe(1);
    expect(byMail.list.participants[0]?.name).toMatch(/@/);
    const preferred = applyLayout(result.table, { preferredNameColumn: 'Curso' });
    expect(preferred.layout.nameColumn).toBe(2);
    const unknown = applyLayout(result.table, { preferredNameColumn: 'Otra', nameColumn: 99 });
    expect(unknown.layout.nameColumn).toBe(0);
  });

  it('can treat the header row as data', async () => {
    const result = await parseParticipants(await readFixture('participantes-360.csv'), registry);
    const noHeader = applyLayout(result.table, { hasHeader: false });
    expect(noHeader.list.participants[0]?.name).toBe('Nombre');
    expect(noHeader.list.report.valid).toBe(361);
  });
});

describe('expected errors', () => {
  it('rejects an empty list', async () => {
    await expect(
      parseParticipants(await readFixture('lista-vacia.txt'), registry),
    ).rejects.toMatchObject({ code: 'list-empty' });
  });

  it('rejects unsupported formats', async () => {
    await expect(
      parseParticipants(await readFixture('lista-no-soportada.json'), registry),
    ).rejects.toMatchObject({ code: 'list-unsupported' });
  });

  it('rejects a damaged spreadsheet and document', async () => {
    const garbage = new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    await expect(
      parseParticipants({ name: 'roto.xlsx', bytes: garbage }, registry),
    ).rejects.toMatchObject({ code: 'list-damaged' });
    await expect(
      parseParticipants({ name: 'roto.docx', bytes: garbage }, registry),
    ).rejects.toMatchObject({ code: 'list-damaged' });
  });
});
