import { describe, expect, it } from 'vitest';
import { csvParser } from './csv-parser';
import { decodeText, splitLines } from './decode-text';
import { createParserRegistry } from './registry';
import { txtParser } from './txt-parser';

const utf8 = (text: string) => new TextEncoder().encode(text);

describe('decodeText', () => {
  it('reads UTF-8 with and without BOM', () => {
    expect(decodeText(utf8('Peña'))).toEqual({ text: 'Peña', encoding: 'utf-8' });
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('Ñu')]);
    expect(decodeText(bom)).toEqual({ text: 'Ñu', encoding: 'utf-8' });
  });

  it('falls back to Windows-1252 when the bytes are not valid UTF-8', () => {
    // "Peña José ’" in Windows-1252
    const bytes = new Uint8Array([
      0x50, 0x65, 0xf1, 0x61, 0x20, 0x4a, 0x6f, 0x73, 0xe9, 0x20, 0x92,
    ]);
    expect(decodeText(bytes)).toEqual({ text: 'Peña José ’', encoding: 'windows-1252' });
  });

  it('reads UTF-16 with BOM in both byte orders', () => {
    const le = new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0xf1, 0x00]);
    expect(decodeText(le)).toEqual({ text: 'Añ', encoding: 'utf-16le' });
    const be = new Uint8Array([0xfe, 0xff, 0x00, 0x41, 0x00, 0xf1]);
    expect(decodeText(be)).toEqual({ text: 'Añ', encoding: 'utf-16be' });
  });

  it('detects UTF-16 without BOM', () => {
    const text = 'Ana Ruiz\nLuis';
    const le = new Uint8Array(text.length * 2);
    const be = new Uint8Array(text.length * 2);
    for (let i = 0; i < text.length; i += 1) {
      le[i * 2] = text.charCodeAt(i);
      be[i * 2 + 1] = text.charCodeAt(i);
    }
    expect(decodeText(le).encoding).toBe('utf-16le');
    expect(decodeText(be)).toEqual({ text, encoding: 'utf-16be' });
  });
});

describe('splitLines', () => {
  it('handles CRLF, LF and CR and ignores the final line break', () => {
    expect(splitLines('a\r\nb\nc\rd\n')).toEqual(['a', 'b', 'c', 'd']);
    expect(splitLines('a\n\n')).toEqual(['a', '']);
    expect(splitLines('')).toEqual([]);
  });
});

describe('txtParser', () => {
  it('returns one single-cell row per line', async () => {
    const table = await txtParser.parse({ name: 'a.txt', bytes: utf8('Ana\n\nLuis\n') });
    expect(table).toEqual({
      rows: [['Ana'], [''], ['Luis']],
      singleColumn: true,
      encoding: 'utf-8',
    });
  });
});

describe('csvParser', () => {
  it('guesses the delimiter and handles quotes', async () => {
    const semicolon = await csvParser.parse({
      name: 'a.csv',
      bytes: utf8('Nombre;Curso\n"Ruiz; Ana";X\n'),
    });
    expect(semicolon.rows).toEqual([
      ['Nombre', 'Curso'],
      ['Ruiz; Ana', 'X'],
    ]);
    const tabs = await csvParser.parse({ name: 'a.csv', bytes: utf8('Ana\tX\nLuis\tY') });
    expect(tabs.rows).toEqual([
      ['Ana', 'X'],
      ['Luis', 'Y'],
    ]);
  });

  it('reads single-column and empty CSV files', async () => {
    expect((await csvParser.parse({ name: 'a.csv', bytes: utf8('Ana\nLuis\n') })).rows).toEqual([
      ['Ana'],
      ['Luis'],
    ]);
    expect((await csvParser.parse({ name: 'a.csv', bytes: utf8('') })).rows).toEqual([]);
  });
});

describe('createParserRegistry', () => {
  const registry = createParserRegistry();
  const zip = new Uint8Array([0x50, 0x4b, 3, 4]);
  const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]);

  it('detects formats by extension (case insensitive)', () => {
    expect(registry.detectFormat({ name: 'Lista.TXT', bytes: utf8('a') })).toBe('txt');
    expect(registry.detectFormat({ name: 'lista.csv', bytes: utf8('a') })).toBe('csv');
    expect(registry.detectFormat({ name: 'lista.xlsx', bytes: zip })).toBe('xlsx');
    expect(registry.detectFormat({ name: 'lista.xls', bytes: ole })).toBe('xlsx');
    expect(registry.detectFormat({ name: 'lista.docx', bytes: zip })).toBe('docx');
  });

  it('rejects unknown extensions and mismatched signatures', () => {
    expect(registry.detectFormat({ name: 'lista.json', bytes: utf8('{}') })).toBeNull();
    expect(registry.detectFormat({ name: 'sin-extension', bytes: utf8('a') })).toBeNull();
    expect(registry.detectFormat({ name: 'lista.csv', bytes: zip })).toBeNull();
    expect(registry.detectFormat({ name: 'lista.docx', bytes: utf8('hola') })).toBeNull();
    expect(registry.detectFormat({ name: 'lista.xlsx', bytes: utf8('hola') })).toBeNull();
  });

  it('loads each parser lazily', async () => {
    for (const format of ['txt', 'csv', 'xlsx', 'docx'] as const) {
      expect((await registry.load(format)).format).toBe(format);
    }
  });
});
