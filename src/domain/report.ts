export interface ReportRow {
  /** 1-based, same number as the file prefix. */
  readonly index: number;
  readonly name: string;
  readonly fileName: string;
  readonly code: string;
  /** Field labels that did not fit even at their minimum size. */
  readonly overflowFields: readonly string[];
}

export const REPORT_FILE_NAME = 'reporte.csv';

const BOM = String.fromCharCode(0xfeff);

function csvCell(value: string): string {
  return /[",\r\n;]/u.test(value) || /^\s|\s$/u.test(value)
    ? `"${value.replace(/"/gu, '""')}"`
    : value;
}

/**
 * reporte.csv: UTF-8 with BOM (so Excel shows accents), comma separated, CRLF.
 * Columns: indice, nombre, archivo, codigo, desborde.
 */
export function buildReportCsv(rows: readonly ReportRow[]): string {
  const lines = [['indice', 'nombre', 'archivo', 'codigo', 'desborde'].join(',')];
  for (const row of rows) {
    lines.push(
      [
        String(row.index),
        row.name,
        row.fileName,
        row.code,
        row.overflowFields.length > 0 ? `sí (${row.overflowFields.join(' / ')})` : 'no',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
