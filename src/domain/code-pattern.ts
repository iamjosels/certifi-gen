import { AppError } from './errors';

/**
 * Correlative code patterns.
 *
 *   {n}       → 7
 *   {n:000}   → 007   (zero padded to the number of zeros; longer numbers are never cut)
 *   {{ / }}   → literal braces
 */
type Token = { kind: 'text'; value: string } | { kind: 'number'; pad: number };

const TOKEN = /\{\{|\}\}|\{n(?::(0+))?\}|\{[^}]*\}?/gu;

export function parseCodePattern(pattern: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  let hasNumber = false;
  for (const match of pattern.matchAll(TOKEN)) {
    const index = match.index;
    if (index > last) tokens.push({ kind: 'text', value: pattern.slice(last, index) });
    const [whole, zeros] = match;
    if (whole === '{{') tokens.push({ kind: 'text', value: '{' });
    else if (whole === '}}') tokens.push({ kind: 'text', value: '}' });
    else if (whole.startsWith('{n')) {
      if (!whole.endsWith('}') || (whole !== '{n}' && zeros === undefined)) {
        throw new AppError('code-pattern-invalid', whole);
      }
      tokens.push({ kind: 'number', pad: zeros?.length ?? 0 });
      hasNumber = true;
    } else {
      throw new AppError('code-pattern-invalid', whole);
    }
    last = index + whole.length;
  }
  if (last < pattern.length) tokens.push({ kind: 'text', value: pattern.slice(last) });
  if (!hasNumber) throw new AppError('code-pattern-invalid', 'missing {n}');
  return tokens;
}

export function isValidCodePattern(pattern: string): boolean {
  try {
    parseCodePattern(pattern);
    return true;
  } catch {
    return false;
  }
}

export function formatCode(pattern: string, value: number): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new AppError('code-pattern-invalid', `invalid number ${String(value)}`);
  }
  return parseCodePattern(pattern)
    .map((token) => (token.kind === 'text' ? token.value : String(value).padStart(token.pad, '0')))
    .join('');
}
