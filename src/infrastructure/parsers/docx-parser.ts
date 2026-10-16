import mammoth from 'mammoth';
import type { ParticipantParser } from '../../application/ports';
import { AppError } from '../../domain/errors';

/**
 * One participant per paragraph (line breaks inside a paragraph also split names).
 * mammoth's browser build reads `arrayBuffer` and its Node build reads `buffer`: both are given
 * so the same adapter runs in the app and in the integration tests.
 */
export const docxParser: ParticipantParser = {
  format: 'docx',
  async parse(file) {
    const arrayBuffer = file.bytes.buffer.slice(
      file.bytes.byteOffset,
      file.bytes.byteOffset + file.bytes.byteLength,
    ) as ArrayBuffer;
    const input = { arrayBuffer, buffer: file.bytes };
    let text: string;
    try {
      text = (await mammoth.extractRawText(input)).value;
    } catch (error) {
      throw new AppError('list-damaged', file.name, { cause: error });
    }
    const paragraphs = text.replace(/\n\n$/u, '').split('\n\n');
    const rows =
      text.length === 0 ? [] : paragraphs.flatMap((p) => p.split('\n')).map((line) => [line]);
    return { rows, singleColumn: true, encoding: null };
  },
};
