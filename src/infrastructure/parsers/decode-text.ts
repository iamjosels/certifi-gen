import type { TextEncodingName } from '../../application/ports';

export interface DecodedText {
  readonly text: string;
  readonly encoding: TextEncodingName;
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

/** UTF-16 without BOM: most of the high (or low) bytes are zero in Latin text. */
function guessUtf16(bytes: Uint8Array): 'utf-16le' | 'utf-16be' | null {
  const sample = bytes.subarray(0, Math.min(bytes.length, 2048));
  if (sample.length < 4) return null;
  let evenZeros = 0;
  let oddZeros = 0;
  for (let i = 0; i + 1 < sample.length; i += 2) {
    if (sample[i] === 0) evenZeros += 1;
    if (sample[i + 1] === 0) oddZeros += 1;
  }
  const pairs = Math.floor(sample.length / 2);
  if (oddZeros / pairs > 0.4 && evenZeros / pairs < 0.05) return 'utf-16le';
  if (evenZeros / pairs > 0.4 && oddZeros / pairs < 0.05) return 'utf-16be';
  return null;
}

/**
 * Decodes a text file: BOM first (UTF-8 / UTF-16), then strict UTF-8, and Windows-1252
 * (what Excel on Windows exports as "CSV") when the bytes are not valid UTF-8.
 */
export function decodeText(bytes: Uint8Array): DecodedText {
  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8' };
  }
  if (startsWith(bytes, [0xff, 0xfe])) {
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'utf-16le' };
  }
  if (startsWith(bytes, [0xfe, 0xff])) {
    return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'utf-16be' };
  }
  const utf16 = guessUtf16(bytes);
  if (utf16) return { text: new TextDecoder(utf16).decode(bytes), encoding: utf16 };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252' };
  }
}

/** Splits into lines (CRLF, LF or CR). A final line break does not create an extra line. */
export function splitLines(text: string): string[] {
  const lines = text.split(/\r\n|\n|\r/u);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}
