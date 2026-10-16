import { normalizeText } from './text';

/** Particles that stay lowercase unless they start the name. */
export const NAME_PARTICLES: ReadonlySet<string> = new Set([
  'de',
  'del',
  'la',
  'las',
  'los',
  'y',
  'e',
  'da',
  'das',
  'do',
  'dos',
  'di',
  'du',
  'van',
  'von',
  'der',
  'den',
]);

const APOSTROPHE = /['’ʼ]/u;

function capitalizeFirstLetter(segment: string): string {
  const chars = Array.from(segment);
  const index = chars.findIndex((char) => /[\p{L}\p{N}]/u.test(char));
  // Words that start with a digit ("3ro") are left as they are.
  if (index === -1 || !/\p{L}/u.test(chars[index] ?? '')) return segment;
  chars[index] = (chars[index] ?? '').toLocaleUpperCase('es');
  return chars.join('');
}

/** "o'connor" → "O'Connor", "d’angelo" → "D’Angelo". */
function capitalizeApostrophes(word: string): string {
  const parts = word.split(APOSTROPHE);
  if (parts.length === 1) return capitalizeFirstLetter(word);
  const separators = word.match(new RegExp(APOSTROPHE.source, 'gu')) ?? [];
  return parts
    .map((part) => capitalizeFirstLetter(part))
    .reduce((acc, part, i) => `${acc}${separators[i - 1] ?? ''}${part}`);
}

/** "maría-josé" → "María-José". */
function capitalizeWord(word: string): string {
  return word
    .split('-')
    .map((segment) => capitalizeApostrophes(segment))
    .join('-');
}

/**
 * Title case for person names: lowercase particles (de, del, la, van, von…) except at the
 * start, and correct handling of apostrophes (O'Connor) and hyphens (María-José).
 */
export function toTitleCase(value: string): string {
  const words = normalizeText(value).toLocaleLowerCase('es').split(' ');
  return words
    .map((word, index) => (index > 0 && NAME_PARTICLES.has(word) ? word : capitalizeWord(word)))
    .join(' ');
}

export function toUpperCase(value: string): string {
  return normalizeText(value).toLocaleUpperCase('es');
}
