import { describe, expect, it } from 'vitest';
import {
  archiveFileName,
  certificateFileName,
  indexPrefix,
  MAX_NAME_PART,
  sanitizeFileNamePart,
} from './filename';

describe('sanitizeFileNamePart', () => {
  it('removes accents and joins words with underscores', () => {
    expect(sanitizeFileNamePart('María-José López')).toBe('Maria_Jose_Lopez');
    expect(sanitizeFileNamePart('Begoña Núñez Ibáñez')).toBe('Begona_Nunez_Ibanez');
    expect(sanitizeFileNamePart('Jürgen Müller')).toBe('Jurgen_Muller');
  });

  it('drops apostrophes instead of splitting the surname', () => {
    expect(sanitizeFileNamePart("Seán O'Connor")).toBe('Sean_OConnor');
    expect(sanitizeFileNamePart('Liam O’Neill')).toBe('Liam_ONeill');
  });

  it('removes characters that are invalid on Windows or macOS', () => {
    expect(sanitizeFileNamePart('a<b>c:d"e/f\\g|h?i*j')).toBe('a_b_c_d_e_f_g_h_i_j');
    expect(sanitizeFileNamePart('  ..Ana..  ')).toBe('Ana');
    expect(sanitizeFileNamePart('CON')).toBe('CON');
  });

  it('transliterates letters without decomposition', () => {
    expect(sanitizeFileNamePart('Strauß Øster Łukasz Æsir')).toBe('Strauss_Oster_Lukasz_AEsir');
  });

  it('limits the length without leaving a trailing underscore', () => {
    const long = 'María de los Ángeles Fernández-Villaverde y Santisteban '.repeat(3);
    const result = sanitizeFileNamePart(long);
    expect(result.length).toBeLessThanOrEqual(MAX_NAME_PART);
    expect(result.endsWith('_')).toBe(false);
    expect(sanitizeFileNamePart('Ana Ruiz', 4)).toBe('Ana');
  });

  it('returns an empty string when nothing is left', () => {
    expect(sanitizeFileNamePart('李小龙')).toBe('');
  });
});

describe('indexPrefix', () => {
  it('pads to at least 3 digits and to the size of the total', () => {
    expect(indexPrefix(0, 360)).toBe('001');
    expect(indexPrefix(359, 360)).toBe('360');
    expect(indexPrefix(0, 1000)).toBe('0001');
    expect(indexPrefix(4, 5)).toBe('005');
    expect(indexPrefix(0, 0)).toBe('001');
  });
});

describe('certificateFileName', () => {
  it('builds index + sanitized name', () => {
    expect(certificateFileName(0, 360, 'María José López')).toBe('001_Maria_Jose_Lopez.pdf');
  });

  it('is unique for duplicate participants thanks to the index', () => {
    const a = certificateFileName(10, 360, 'Juan Pérez');
    const b = certificateFileName(11, 360, 'Juan Pérez');
    expect(a).not.toBe(b);
  });

  it('falls back when the name has no Latin letters', () => {
    expect(certificateFileName(2, 3, '李小龙')).toBe('003_certificado.pdf');
  });

  it('keeps names well below common path limits', () => {
    const name = certificateFileName(999, 1000, 'x'.repeat(300));
    expect(name.length).toBeLessThanOrEqual(4 + 1 + MAX_NAME_PART + 4);
  });
});

describe('archiveFileName', () => {
  it('uses the date and a sanitized base', () => {
    const date = new Date('2026-10-15T12:00:00Z');
    expect(archiveFileName('Certificados Ágiles', date, 'zip')).toBe(
      'Certificados_Agiles_2026-10-15.zip',
    );
    expect(archiveFileName('', date, 'pdf')).toBe('certificados_2026-10-15.pdf');
  });
});
