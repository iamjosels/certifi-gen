import { read, utils } from 'xlsx';
import type { ParticipantParser } from '../../application/ports';
import { AppError } from '../../domain/errors';

/** With `raw: false` SheetJS returns formatted strings; other values are converted defensively. */
function cellText(cell: unknown): string {
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell);
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return '';
}

/** First worksheet with data; cells read as formatted text. */
export const xlsxParser: ParticipantParser = {
  format: 'xlsx',
  parse(file) {
    let workbook;
    try {
      workbook = read(file.bytes, { type: 'array', dense: true, cellHTML: false });
    } catch (error) {
      throw new AppError('list-damaged', file.name, { cause: error });
    }
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rows = utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: false,
        defval: '',
        blankrows: true,
      });
      const cells = rows.map((row) => row.map((cell) => cellText(cell)));
      if (cells.some((row) => row.some((cell) => cell.trim().length > 0))) {
        return Promise.resolve({ rows: cells, singleColumn: false, encoding: null });
      }
    }
    return Promise.resolve({ rows: [], singleColumn: false, encoding: null });
  },
};
