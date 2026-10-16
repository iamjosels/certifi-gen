import { normalizeText, stripDiacritics } from './text';

/** Maximum length of the name part (without index and extension). */
export const MAX_NAME_PART = 80;

const LETTER_FALLBACKS: Readonly<Record<string, string>> = {
  ß: 'ss',
  æ: 'ae',
  Æ: 'AE',
  ø: 'o',
  Ø: 'O',
  œ: 'oe',
  Œ: 'OE',
  ł: 'l',
  Ł: 'L',
  đ: 'd',
  Đ: 'D',
  ð: 'd',
  Ð: 'D',
  þ: 'th',
  Þ: 'Th',
  ı: 'i',
};

/**
 * "María-José López" → "Maria_Jose_Lopez". Only [A-Za-z0-9_-]: safe on Windows, macOS and
 * Linux, inside ZIP files and in URLs. Accents are removed only here, never on the certificate.
 */
export function sanitizeFileNamePart(value: string, maxLength = MAX_NAME_PART): string {
  const ascii = Array.from(stripDiacritics(normalizeText(value)))
    .map((char) => LETTER_FALLBACKS[char] ?? char)
    .join('');
  const cleaned = ascii
    .replace(/['’`´]/gu, '')
    .replace(/[^A-Za-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
  const cut = cleaned.slice(0, maxLength).replace(/_+$/u, '');
  return cut;
}

/** Zero-padded 1-based index, at least 3 digits and as many as `total` needs. */
export function indexPrefix(index: number, total: number): string {
  const width = Math.max(3, String(Math.max(total, 1)).length);
  return String(index + 1).padStart(width, '0');
}

/** "001_Maria_Jose_Lopez.pdf". The index makes names unique even with duplicate participants. */
export function certificateFileName(index: number, total: number, name: string): string {
  const part = sanitizeFileNamePart(name) || 'certificado';
  return `${indexPrefix(index, total)}_${part}.pdf`;
}

/** "certificados_2026-10-15.zip" from an optional event name. */
export function archiveFileName(base: string, date: Date, extension: 'zip' | 'pdf'): string {
  const day = date.toISOString().slice(0, 10);
  const part = sanitizeFileNamePart(base, 60) || 'certificados';
  return `${part}_${day}.${extension}`;
}
