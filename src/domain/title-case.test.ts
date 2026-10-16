import { describe, expect, it } from 'vitest';
import { toTitleCase, toUpperCase } from './title-case';

describe('toTitleCase', () => {
  it.each([
    ['juan pérez', 'Juan Pérez'],
    ['ANA GARCÍA LÓPEZ', 'Ana García López'],
    ['pEdRo SÁNCHEZ díaz', 'Pedro Sánchez Díaz'],
    ['ñuflo peña', 'Ñuflo Peña'],
    ['íñigo muñoz', 'Íñigo Muñoz'],
  ])('%s → %s', (input, expected) => {
    expect(toTitleCase(input)).toBe(expected);
  });

  it('keeps particles lowercase except at the start', () => {
    expect(toTitleCase('JUAN DE LA CRUZ')).toBe('Juan de la Cruz');
    expect(toTitleCase('maría de los ángeles pérez y garcía')).toBe(
      'María de los Ángeles Pérez y García',
    );
    expect(toTitleCase('pedro DEL valle')).toBe('Pedro del Valle');
    expect(toTitleCase('luis VAN DER berg')).toBe('Luis van der Berg');
    expect(toTitleCase('ana von bismarck')).toBe('Ana von Bismarck');
    expect(toTitleCase('josé da silva')).toBe('José da Silva');
    expect(toTitleCase('ana las heras e hijos')).toBe('Ana las Heras e Hijos');
    expect(toTitleCase('de la fuente, ana')).toBe('De la Fuente, Ana');
    expect(toTitleCase('van gogh')).toBe('Van Gogh');
  });

  it('handles apostrophes', () => {
    expect(toTitleCase("SEÁN O'CONNOR")).toBe("Seán O'Connor");
    expect(toTitleCase('liam o’neill')).toBe('Liam O’Neill');
    expect(toTitleCase("d'angelo rossi")).toBe("D'Angelo Rossi");
  });

  it('handles hyphenated names', () => {
    expect(toTitleCase('MARÍA-JOSÉ LÓPEZ')).toBe('María-José López');
    expect(toTitleCase('jean-pierre o’brien-smith')).toBe('Jean-Pierre O’Brien-Smith');
  });

  it('normalizes spaces and ignores segments without letters', () => {
    expect(toTitleCase('  ana   ruiz 3ro ')).toBe('Ana Ruiz 3ro');
    expect(toTitleCase("ana - '")).toBe("Ana - '");
  });
});

describe('toUpperCase', () => {
  it('uppercases keeping accents and ñ', () => {
    expect(toUpperCase(' maría  peña güemes ')).toBe('MARÍA PEÑA GÜEMES');
  });
});
