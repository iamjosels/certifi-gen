import type { RawParticipantRow } from './participant';
import { comparisonKey, normalizeText } from './text';

/** Rows as read from a list file, before choosing columns. */
export interface RawTable {
  /** Each row is a list of cell values (strings, not normalized). */
  readonly rows: readonly (readonly string[])[];
  /** True for formats without columns (TXT, DOCX): every row has exactly one cell. */
  readonly singleColumn: boolean;
}

export interface TableLayout {
  readonly hasHeader: boolean;
  /** Column labels: header values, or "Columna N" when there is no header. */
  readonly columns: readonly string[];
  readonly nameColumn: number;
}

const NAME_HEADERS_PRIORITY: readonly string[] = [
  'nombre completo',
  'nombres y apellidos',
  'apellidos y nombres',
  'nombre y apellido',
  'nombre y apellidos',
  'full name',
  'fullname',
  'nombre',
  'nombres',
  'participante',
  'participantes',
  'name',
];

const KNOWN_HEADERS: ReadonlySet<string> = new Set([
  ...NAME_HEADERS_PRIORITY,
  'apellido',
  'apellidos',
  'correo',
  'correo electronico',
  'email',
  'e-mail',
  'mail',
  'curso',
  'course',
  'taller',
  'evento',
  'dni',
  'documento',
  'cedula',
  'fecha',
  'codigo',
  'id',
  'n',
  'n°',
  'nro',
  'numero',
  'cargo',
  'empresa',
  'telefono',
  'celular',
]);

function headerKey(value: string): string {
  return comparisonKey(value)
    .replace(/[.:]+$/u, '')
    .trim();
}

export function columnLabel(index: number): string {
  return `Columna ${String(index + 1)}`;
}

function columnCount(table: RawTable): number {
  return table.rows.reduce((max, row) => Math.max(max, row.length), 0);
}

function looksLikeEmail(value: string): boolean {
  return /\S+@\S+\.\S+/u.test(value);
}

function looksLikeNumber(value: string): boolean {
  return /^[\d\s.,/-]+$/u.test(value);
}

function isBlankRow(row: readonly string[]): boolean {
  return row.every((cell) => normalizeText(cell).length === 0);
}

/**
 * Decides whether the first non-blank row is a header: it is when one of its cells is a known
 * header name, or when it has no e-mail although the same column holds e-mails below.
 */
export function detectHeader(table: RawTable): boolean {
  if (table.singleColumn) {
    const first = table.rows.find((row) => !isBlankRow(row));
    return first !== undefined && NAME_HEADERS_PRIORITY.includes(headerKey(first[0] ?? ''));
  }
  const nonBlank = table.rows.filter((row) => !isBlankRow(row));
  const [first, ...rest] = nonBlank;
  if (!first) return false;
  if (first.some((cell) => KNOWN_HEADERS.has(headerKey(cell)))) return true;
  return first.some((cell, column) => {
    if (looksLikeEmail(cell)) return false;
    const below = rest.slice(0, 20).map((row) => row[column] ?? '');
    return below.length > 0 && below.filter(looksLikeEmail).length >= Math.ceil(below.length / 2);
  });
}

/** Picks the name column: by header name first, then the first column that looks like text. */
export function detectNameColumn(table: RawTable, hasHeader: boolean): number {
  const count = columnCount(table);
  if (count <= 1) return 0;
  const nonBlank = table.rows.filter((row) => !isBlankRow(row));
  if (hasHeader && nonBlank[0]) {
    const keys = nonBlank[0].map(headerKey);
    for (const candidate of NAME_HEADERS_PRIORITY) {
      const index = keys.indexOf(candidate);
      if (index !== -1) return index;
    }
  }
  const sample = nonBlank.slice(hasHeader ? 1 : 0, 30);
  for (let column = 0; column < count; column += 1) {
    const values = sample.map((row) => normalizeText(row[column] ?? '')).filter(Boolean);
    if (values.length === 0) continue;
    const texty = values.filter((value) => !looksLikeEmail(value) && !looksLikeNumber(value));
    if (texty.length >= values.length / 2) return column;
  }
  return 0;
}

export function describeTable(table: RawTable, hasHeader = detectHeader(table)): TableLayout {
  const count = Math.max(1, columnCount(table));
  const headerRow = hasHeader ? table.rows.find((row) => !isBlankRow(row)) : undefined;
  const seen = new Map<string, number>();
  const columns = Array.from({ length: count }, (_, index) => {
    const header = headerRow ? normalizeText(headerRow[index] ?? '') : '';
    const base = header || columnLabel(index);
    const repeat = seen.get(base) ?? 0;
    seen.set(base, repeat + 1);
    return repeat === 0 ? base : `${base} (${String(repeat + 1)})`;
  });
  return { hasHeader, columns, nameColumn: detectNameColumn(table, hasHeader) };
}

/** Turns the table into participant rows using the chosen layout. */
export function tableToRows(table: RawTable, layout: TableLayout): RawParticipantRow[] {
  const rows: RawParticipantRow[] = [];
  let headerSkipped = !layout.hasHeader;
  table.rows.forEach((row, rowIndex) => {
    if (!headerSkipped && !isBlankRow(row)) {
      headerSkipped = true;
      return;
    }
    if (!headerSkipped) return;
    const fields: Record<string, string> = {};
    layout.columns.forEach((column, index) => {
      fields[column] = row[index] ?? '';
    });
    rows.push({ name: row[layout.nameColumn] ?? '', fields, sourceRow: rowIndex + 1 });
  });
  return rows;
}
