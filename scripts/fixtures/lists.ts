/**
 * Participant list fixtures in every supported format, built from the same NameEntry list.
 */
import { Document, Packer, Paragraph, TextRun } from 'docx';
import * as XLSX from 'xlsx';
import type { NameEntry } from './names';

const COURSES = [
  'Gestión de Proyectos Ágiles',
  'Diseño Gráfico',
  'Programación Web',
  'Atención al Cliente',
  'Logística y Distribución',
  'Análisis de Datos',
];

/** Blank rows/lines inserted before the entry with that index (and at the end). */
export const BLANK_POSITIONS: readonly number[] = [
  0, 0, 29, 58, 87, 116, 145, 174, 203, 232, 261, 290, 319, 348,
];
export const TRAILING_BLANKS = 3;
export const TOTAL_BLANKS = BLANK_POSITIONS.length + TRAILING_BLANKS;

const TXT_BLANK_VARIANTS = ['', '   ', '\t', '\u200b', '\u00a0\u00a0'] as const;

function blankVariant(i: number): string {
  return TXT_BLANK_VARIANTS[i % TXT_BLANK_VARIANTS.length] ?? '';
}

export function emailFor(clean: string, index: number): string {
  const tokens = clean
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  const first = tokens[0] ?? 'participante';
  const last = tokens[tokens.length - 1] ?? 'anonimo';
  return `${first}.${last}${String(index + 1)}@ejemplo.edu.pe`;
}

export function courseFor(index: number): string {
  return COURSES[index % COURSES.length] ?? 'Curso';
}

/** Walks the entries emitting blanks at the configured positions. */
function interleave<T>(
  entries: readonly NameEntry[],
  row: (entry: NameEntry, index: number) => T,
  blank: (n: number) => T,
): T[] {
  const out: T[] = [];
  let blanks = 0;
  entries.forEach((entry, index) => {
    for (const position of BLANK_POSITIONS) {
      if (position === index) out.push(blank(blanks++));
    }
    out.push(row(entry, index));
  });
  for (let i = 0; i < TRAILING_BLANKS; i += 1) out.push(blank(blanks++));
  return out;
}

export function buildTxt(entries: readonly NameEntry[]): Uint8Array {
  const lines = interleave(entries, (entry) => entry.raw, blankVariant);
  const body = `${lines.join('\r\n')}\r\n`;
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const text = new TextEncoder().encode(body);
  const out = new Uint8Array(bom.length + text.length);
  out.set(bom, 0);
  out.set(text, bom.length);
  return out;
}

export function buildEmptyTxt(): Uint8Array {
  return new TextEncoder().encode('\n   \n\t\n\u200b\n\n');
}

function csvCell(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes('"') || /[\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRows(entries: readonly NameEntry[], delimiter: string, latin: boolean): string[] {
  const header = ['Nombre', 'Correo', 'Curso'].join(delimiter);
  const rows = interleave(
    entries,
    (entry, index) =>
      [latin ? entry.rawLatin : entry.raw, emailFor(entry.clean, index), courseFor(index)]
        .map((cell) => csvCell(cell, delimiter))
        .join(delimiter),
    (n) =>
      n % 3 === 0 ? '' : n % 3 === 1 ? `${delimiter}${delimiter}` : ` ${delimiter} ${delimiter} `,
  );
  return [header, ...rows];
}

export function buildCsvUtf8(entries: readonly NameEntry[]): Uint8Array {
  return new TextEncoder().encode(`${csvRows(entries, ',', false).join('\n')}\n`);
}

const CP1252_SPECIAL: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

export function encodeWindows1252(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80 || (code >= 0xa0 && code <= 0xff)) {
      bytes.push(code);
    } else if (CP1252_SPECIAL[code] !== undefined) {
      bytes.push(CP1252_SPECIAL[code]);
    } else {
      throw new Error(`Character U+${code.toString(16)} is not representable in Windows-1252`);
    }
  }
  return new Uint8Array(bytes);
}

/** Like Excel "CSV (delimitado por comas)" on a Spanish Windows: `;`, CRLF, Windows-1252. */
export function buildCsvWindows1252(entries: readonly NameEntry[]): Uint8Array {
  return encodeWindows1252(`${csvRows(entries, ';', true).join('\r\n')}\r\n`);
}

export function buildXlsx(entries: readonly NameEntry[]): Uint8Array {
  const rows: string[][] = [
    ['Nombre', 'Correo', 'Curso'],
    ...interleave(
      entries,
      (entry, index) => [entry.raw, emailFor(entry.clean, index), courseFor(index)],
      () => ['', '', ''],
    ),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Participantes');
  const out = XLSX.write(book, {
    type: 'array',
    bookType: 'xlsx',
    compression: true,
  }) as ArrayBuffer;
  return new Uint8Array(out);
}

export async function buildDocx(entries: readonly NameEntry[]): Promise<Uint8Array> {
  const paragraphs = interleave(
    entries,
    (entry) => new Paragraph({ children: [new TextRun(entry.raw)] }),
    () => new Paragraph({ children: [] }),
  );
  const doc = new Document({
    creator: 'certifi-gen fixtures',
    title: 'Participantes',
    sections: [{ children: paragraphs }],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}
