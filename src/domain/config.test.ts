import { describe, expect, it } from 'vitest';
import {
  createConfig,
  parseConfig,
  parseField,
  serializeConfig,
  withAvailableFonts,
  type ProjectConfig,
} from './config';
import { AppError } from './errors';
import { createField, createNameField } from './field';

const fonts = ['dm-serif-display', 'poppins'];
const context = { availableFontIds: fonts, templateAspectRatio: 841.89 / 595.28 };

function sampleConfig(): ProjectConfig {
  const name = createNameField();
  return createConfig({
    fields: [name, createField('sequence', [name])],
    mode: 'both',
    template: { kind: 'pdf', aspectRatio: 841.89 / 595.28 },
    nameColumn: 'Nombre',
    customFonts: [],
    now: new Date('2026-10-15T10:00:00Z'),
  });
}

function mutate(change: (data: Record<string, unknown>) => void): string {
  const data = JSON.parse(serializeConfig(sampleConfig())) as Record<string, unknown>;
  change(data);
  return JSON.stringify(data);
}

function fieldAt(data: Record<string, unknown>, index = 0): Record<string, unknown> {
  const field = (data.fields as Record<string, unknown>[])[index];
  if (!field) throw new Error(`No field at ${String(index)}`);
  return field;
}

describe('serializeConfig / parseConfig', () => {
  it('round-trips a configuration', () => {
    const config = sampleConfig();
    const parsed = parseConfig(serializeConfig(config), context);
    expect(parsed.config).toEqual(config);
    expect(parsed.warnings).toEqual([]);
  });

  it('serializes as readable JSON with app and schema version', () => {
    const json = serializeConfig(sampleConfig());
    expect(json).toContain('"schemaVersion": 1');
    expect(json).toContain('"app": "certifi-gen"');
    expect(json.endsWith('\n')).toBe(true);
  });

  it('uses defaults for optional parts', () => {
    const json = mutate((data) => {
      delete data.output;
      delete data.template;
      delete data.nameColumn;
      delete data.customFonts;
      delete data.savedAt;
    });
    const { config } = parseConfig(json, context);
    expect(config.output.mode).toBe('both');
    expect(config.template).toBeNull();
    expect(config.nameColumn).toBeNull();
    expect(config.customFonts).toEqual([]);
    expect(config.savedAt).toBe(new Date(0).toISOString());
  });

  it('keeps custom font references', () => {
    const json = mutate((data) => {
      data.customFonts = [{ id: 'user-1', name: 'Mi Fuente' }];
    });
    expect(parseConfig(json, context).config.customFonts).toEqual([
      { id: 'user-1', name: 'Mi Fuente' },
    ]);
  });

  it('warns about missing fonts and different template shapes', () => {
    const json = mutate((data) => {
      fieldAt(data).fontId = 'user-font';
    });
    const { warnings } = parseConfig(json, { availableFontIds: fonts, templateAspectRatio: 0.7 });
    expect(warnings).toEqual([
      { kind: 'missing-font', fieldId: 'name', fontId: 'user-font' },
      { kind: 'aspect-mismatch', expected: 841.89 / 595.28, actual: 0.7 },
    ]);
  });

  it('rejects non-JSON, foreign files and other versions', () => {
    expect(() => parseConfig('{nope', context)).toThrow(AppError);
    expect(() => parseConfig('[]', context)).toThrow(/not a certifi-gen/);
    expect(() => parseConfig('{"app":"otra"}', context)).toThrow(/not a certifi-gen/);
    try {
      parseConfig(
        mutate((data) => (data.schemaVersion = 2)),
        context,
      );
      expect.unreachable();
    } catch (error) {
      expect((error as AppError).code).toBe('config-version');
    }
  });

  it.each<[string, (data: Record<string, unknown>) => void]>([
    ['no fields', (data) => (data.fields = [])],
    ['fields not a list', (data) => (data.fields = 'x')],
    ['too many fields', (data) => (data.fields = Array.from({ length: 21 }, () => fieldAt(data)))],
    ['duplicate ids', (data) => (data.fields = [fieldAt(data), fieldAt(data)])],
    ['bad output mode', (data) => (data.output = { mode: 'rar' })],
    ['bad template kind', (data) => (data.template = { kind: 'gif', aspectRatio: 1 })],
    ['bad aspect ratio', (data) => (data.template = { kind: 'pdf', aspectRatio: 0 })],
    ['bad custom font', (data) => (data.customFonts = ['x'])],
    ['bad custom font id', (data) => (data.customFonts = [{ id: 3, name: 'x' }])],
  ])('rejects %s', (_label, change) => {
    expect(() => parseConfig(mutate(change), context)).toThrow(AppError);
  });
});

describe('parseField', () => {
  const valid = () => JSON.parse(JSON.stringify(createNameField())) as Record<string, unknown>;

  it('accepts a valid field and lowercases the color', () => {
    expect(parseField({ ...valid(), color: '#AABBCC' }).color).toBe('#aabbcc');
  });

  it('accepts every source kind', () => {
    expect(parseField({ ...valid(), source: { kind: 'column', column: 'Curso' } }).source).toEqual({
      kind: 'column',
      column: 'Curso',
    });
    expect(
      parseField({ ...valid(), source: { kind: 'sequence', pattern: 'A-{n:00}', start: 5 } })
        .source,
    ).toEqual({ kind: 'sequence', pattern: 'A-{n:00}', start: 5 });
    expect(parseField({ ...valid(), source: { kind: 'static', text: 'Hola' } }).source).toEqual({
      kind: 'static',
      text: 'Hola',
    });
  });

  it.each<[string, Record<string, unknown>]>([
    ['not an object', { field: null }],
    ['box missing', { box: null }],
    ['box too wide', { box: { x: 0.5, y: 0.5, width: 0.6 } }],
    ['negative x', { box: { x: -0.1, y: 0.5, width: 0.5 } }],
    ['y out of range', { box: { x: 0, y: 1.5, width: 0.5 } }],
    ['NaN width', { box: { x: 0, y: 0.5, width: Number.NaN } }],
    ['min > max', { minSize: 50, maxSize: 40 }],
    ['font too big', { maxSize: 900 }],
    ['bad color', { color: 'red' }],
    ['long color', { color: '#aabbccdd' }],
    ['empty id', { id: '' }],
    ['label not a string', { label: 4 }],
    ['bad align', { align: 'justify' }],
    ['bad transform', { transform: 'lower' }],
    ['bad source', { source: 'name' }],
    ['unknown source', { source: { kind: 'qr' } }],
    ['bad pattern', { source: { kind: 'sequence', pattern: 'CERT', start: 1 } }],
    ['fractional start', { source: { kind: 'sequence', pattern: '{n}', start: 1.5 } }],
    ['column not a string', { source: { kind: 'column', column: 1 } }],
  ])('rejects %s', (label, patch) => {
    const input = label === 'not an object' ? null : { ...valid(), ...patch };
    expect(() => parseField(input)).toThrow(AppError);
  });
});

describe('withAvailableFonts', () => {
  it('replaces unavailable fonts by the fallback', () => {
    const fields = [createNameField('lost-font'), createNameField('poppins')];
    expect(withAvailableFonts(fields, fonts, 'dm-serif-display').map((f) => f.fontId)).toEqual([
      'dm-serif-display',
      'poppins',
    ]);
  });
});
