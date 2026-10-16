import { describe, expect, it } from 'vitest';
import { canonicalPunctuation, comparisonKey, normalizeText, stripDiacritics } from './text';

describe('normalizeText', () => {
  it('trims and collapses spaces, tabs and NBSP', () => {
    expect(normalizeText('  María \t José\u00a0\u00a0López  ')).toBe('María José López');
  });

  it('removes BOM and invisible characters', () => {
    expect(normalizeText('\ufeffAna')).toBe('Ana');
    expect(normalizeText('An\u200ba Ma\u00adría')).toBe('Ana María');
    expect(normalizeText('Luis\u2060 Pérez\u200d')).toBe('Luis Pérez');
    expect(normalizeText('\u200e\u200fRosa')).toBe('Rosa');
  });

  it('removes control characters but keeps line breaks as spaces', () => {
    expect(normalizeText('Ana\u0000\u0007 Ruiz')).toBe('Ana Ruiz');
    expect(normalizeText('Ana\r\nRuiz')).toBe('Ana Ruiz');
  });

  it('composes decomposed accents (NFD → NFC)', () => {
    const decomposed = 'Jose\u0301 Nu\u0301n\u0303ez';
    const result = normalizeText(decomposed);
    expect(result).toBe('José Núñez');
    expect(result.length).toBe('José Núñez'.length);
  });

  it('returns an empty string for blank or invisible-only input', () => {
    expect(normalizeText('')).toBe('');
    expect(normalizeText('   \t ')).toBe('');
    expect(normalizeText('\u200b\u00a0')).toBe('');
  });

  it('never changes letter case', () => {
    expect(normalizeText('jUAN pÉREZ')).toBe('jUAN pÉREZ');
  });
});

describe('stripDiacritics', () => {
  it('removes accents, tildes and diaeresis', () => {
    expect(stripDiacritics('Ñuño Güemes Ángela Zoë')).toBe('Nuno Guemes Angela Zoe');
  });
});

describe('canonicalPunctuation', () => {
  it('maps typographic apostrophes and dashes to ASCII', () => {
    expect(canonicalPunctuation('O’Neill‐Ruiz — Ana')).toBe("O'Neill-Ruiz - Ana");
  });
});

describe('comparisonKey', () => {
  it('ignores accents, case, spaces and apostrophe style', () => {
    expect(comparisonKey('  Inés   MUÑOZ ')).toBe(comparisonKey('ines munoz'));
    expect(comparisonKey('Liam O’Neill')).toBe(comparisonKey("liam o'neill"));
  });

  it('keeps different names different', () => {
    expect(comparisonKey('María José')).not.toBe(comparisonKey('María-José'));
  });
});
