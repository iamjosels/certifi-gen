import { describe, expect, it } from 'vitest';
import {
  applyTransform,
  clampBox,
  codeFieldOf,
  createField,
  createNameField,
  invalidFields,
  rawFieldText,
  resolveFieldText,
  type FieldConfig,
} from './field';
import type { Participant } from './participant';

const participant: Participant = {
  index: 6,
  name: 'maría-josé de la cruz',
  fields: { Curso: 'Diseño Gráfico', Nombre: 'maría-josé de la cruz' },
  duplicateOf: null,
  sourceRow: 8,
};

describe('createNameField', () => {
  it('creates the default "Nombre" field centered on the page', () => {
    const field = createNameField();
    expect(field.source).toEqual({ kind: 'name' });
    expect(field.label).toBe('Nombre');
    expect(field.align).toBe('center');
    expect(field.box.x + field.box.width / 2).toBeCloseTo(0.5);
    expect(field.minSize).toBeLessThan(field.maxSize);
  });

  it('accepts a font', () => {
    expect(createNameField('poppins').fontId).toBe('poppins');
  });
});

describe('createField', () => {
  const existing = [createNameField()];

  it('creates a sequence field with the default pattern', () => {
    const field = createField('sequence', existing);
    expect(field.source).toEqual({ kind: 'sequence', pattern: 'CERT-2026-{n:000}', start: 1 });
    expect(field.label).toBe('Código');
    expect(field.id).not.toBe('name');
  });

  it('creates column and static fields', () => {
    expect(createField('column', existing, { column: 'Curso' }).source).toEqual({
      kind: 'column',
      column: 'Curso',
    });
    expect(createField('column', existing).label).toBe('Columna');
    expect(createField('static', existing, { fontId: 'marcellus' })).toMatchObject({
      source: { kind: 'static', text: 'Texto' },
      fontId: 'marcellus',
    });
  });

  it('generates unique ids', () => {
    const first = createField('static', existing);
    const taken: FieldConfig[] = [...existing, first, { ...first, id: 'field-2' }];
    const second = createField('static', taken);
    expect(new Set([...taken.map((f) => f.id), second.id]).size).toBe(taken.length + 1);
  });

  it('skips ids that are already taken', () => {
    const taken: FieldConfig[] = [createNameField(), { ...createNameField(), id: 'field-2' }];
    expect(createField('static', taken).id).toBe('field-3');
  });
});

describe('applyTransform', () => {
  it('applies none, title and upper', () => {
    expect(applyTransform('  ana  DE la cruz ', 'none')).toBe('ana DE la cruz');
    expect(applyTransform('ana DE la cruz', 'title')).toBe('Ana de la Cruz');
    expect(applyTransform('ana de la cruz', 'upper')).toBe('ANA DE LA CRUZ');
  });
});

describe('rawFieldText / resolveFieldText', () => {
  it('reads the name', () => {
    const field = { ...createNameField(), transform: 'title' as const };
    expect(rawFieldText(field, participant)).toBe('maría-josé de la cruz');
    expect(resolveFieldText(field, participant)).toBe('María-José de la Cruz');
  });

  it('reads another column (empty when missing)', () => {
    const field = createField('column', [], { column: 'Curso' });
    expect(resolveFieldText(field, participant)).toBe('Diseño Gráfico');
    expect(resolveFieldText(createField('column', [], { column: 'Otro' }), participant)).toBe('');
  });

  it('builds the correlative code from start + index', () => {
    const field = createField('sequence', []);
    expect(resolveFieldText(field, participant)).toBe('CERT-2026-007');
  });

  it('returns static text', () => {
    const field = {
      ...createField('static', []),
      source: { kind: 'static' as const, text: 'Lima, 2026' },
    };
    expect(resolveFieldText(field, participant)).toBe('Lima, 2026');
  });
});

describe('invalid code patterns', () => {
  it('shows the raw pattern while it is invalid and lists the field as invalid', () => {
    const field = {
      ...createField('sequence', []),
      source: { kind: 'sequence' as const, pattern: 'CERT', start: 1 },
    };
    expect(resolveFieldText(field, participant)).toBe('CERT');
    expect(invalidFields([createNameField(), field])).toEqual([field]);
    expect(invalidFields([createNameField(), createField('sequence', [])])).toEqual([]);
  });
});

describe('codeFieldOf', () => {
  it('returns the first sequence field', () => {
    const code = createField('sequence', [createNameField()]);
    expect(codeFieldOf([createNameField(), code])).toBe(code);
    expect(codeFieldOf([createNameField()])).toBeUndefined();
  });
});

describe('clampBox', () => {
  it('keeps the box inside the page', () => {
    expect(clampBox({ x: -0.2, y: 1.4, width: 0.5 })).toEqual({ x: 0, y: 1, width: 0.5 });
    expect(clampBox({ x: 0.9, y: -1, width: 0.5 })).toEqual({ x: 0.5, y: 0, width: 0.5 });
    expect(clampBox({ x: 0.1, y: 0.5, width: 3 })).toEqual({ x: 0, y: 0.5, width: 1 });
    expect(clampBox({ x: 0.1, y: 0.5, width: 0 }).width).toBe(0.02);
  });
});
