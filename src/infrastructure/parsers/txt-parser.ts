import type { ParticipantParser } from '../../application/ports';
import { decodeText, splitLines } from './decode-text';

/** One participant per line. */
export const txtParser: ParticipantParser = {
  format: 'txt',
  parse(file) {
    const { text, encoding } = decodeText(file.bytes);
    return Promise.resolve({
      rows: splitLines(text).map((line) => [line]),
      singleColumn: true,
      encoding,
    });
  },
};
