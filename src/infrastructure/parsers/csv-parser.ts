import Papa from 'papaparse';
import type { ParticipantParser } from '../../application/ports';
import { AppError } from '../../domain/errors';
import { decodeText } from './decode-text';

/** CSV with automatic delimiter (`,` `;` tab `|`) and encoding detection. */
export const csvParser: ParticipantParser = {
  format: 'csv',
  parse(file) {
    const { text, encoding } = decodeText(file.bytes);
    const body = text.replace(/(\r\n|\n|\r)$/u, '');
    const result = Papa.parse<string[]>(body, {
      delimiter: '',
      delimitersToGuess: [',', ';', '\t', '|'],
      skipEmptyLines: false,
      header: false,
    });
    const fatal = result.errors.find(
      (error) => error.type === 'Quotes' && error.code === 'MissingQuotes',
    );
    if (fatal && result.data.length === 0) {
      throw new AppError('list-damaged', fatal.message);
    }
    const rows = body.length === 0 ? [] : result.data;
    return Promise.resolve({ rows, singleColumn: false, encoding });
  },
};
