/**
 * Text normalization shared by every list format.
 */

/** Format characters (BOM, zero-width spaces/joiners, soft hyphen, bidi marks, word joiner). */
const FORMAT_CHARS = /\p{Cf}/gu;
/** Control characters other than whitespace (tabs and line breaks are whitespace). */
const CONTROL_CHARS = /[^\P{Cc}\t\n\r\f\v]/gu;
const WHITESPACE_RUN = /\s+/gu;

/**
 * NFC, removes BOM and invisible characters, turns any Unicode whitespace (tabs, NBSP…) into a
 * single space and trims. Letter case is never changed.
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFC')
    .replace(FORMAT_CHARS, '')
    .replace(CONTROL_CHARS, '')
    .replace(WHITESPACE_RUN, ' ')
    .trim();
}

/** Removes combining marks: "Núñez" → "Nunez". */
export function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
}

const APOSTROPHES = /[\u2019\u2018\u02bc\u0060\u00b4]/gu;
const HYPHENS = /[\u2010\u2011\u2012\u2013\u2014\u2212]/gu;

/** Typographic apostrophes and dashes are compared as their ASCII forms. */
export function canonicalPunctuation(value: string): string {
  return value.replace(APOSTROPHES, "'").replace(HYPHENS, '-');
}

/** Key used to compare names: no accents, no case, canonical punctuation and spaces. */
export function comparisonKey(value: string): string {
  return canonicalPunctuation(stripDiacritics(normalizeText(value))).toLocaleLowerCase('es');
}
