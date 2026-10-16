import { formatCode, isValidCodePattern } from './code-pattern';
import type { Participant } from './participant';
import { toTitleCase, toUpperCase } from './title-case';
import { normalizeText } from './text';

export type TextAlign = 'left' | 'center' | 'right';
export type TextTransform = 'none' | 'title' | 'upper';

export type FieldSource =
  /** The column chosen as participant name. */
  | { readonly kind: 'name' }
  /** Any other column of the list, by column label. */
  | { readonly kind: 'column'; readonly column: string }
  /** Correlative code, e.g. "CERT-2026-{n:000}". */
  | { readonly kind: 'sequence'; readonly pattern: string; readonly start: number }
  /** Same text on every certificate. */
  | { readonly kind: 'static'; readonly text: string };

/**
 * Position relative to the page (0..1), origin at the top-left corner like the canvas.
 * `x` is the left edge, `width` the maximum text width, `y` the vertical center of the line.
 */
export interface FieldBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

export interface FieldConfig {
  readonly id: string;
  readonly label: string;
  readonly source: FieldSource;
  readonly box: FieldBox;
  readonly fontId: string;
  /** Points. */
  readonly maxSize: number;
  /** Points. */
  readonly minSize: number;
  /** #rrggbb */
  readonly color: string;
  readonly align: TextAlign;
  readonly transform: TextTransform;
}

export const NAME_FIELD_ID = 'name';
export const DEFAULT_FONT_ID = 'dm-serif-display';

export const FIELD_LIMITS = {
  minFontSize: 4,
  maxFontSize: 200,
  minBoxWidth: 0.02,
  maxFields: 20,
} as const;

export function createNameField(fontId = DEFAULT_FONT_ID): FieldConfig {
  return {
    id: NAME_FIELD_ID,
    label: 'Nombre',
    source: { kind: 'name' },
    box: { x: 0.12, y: 0.5, width: 0.76 },
    fontId,
    maxSize: 40,
    minSize: 14,
    color: '#1f2a44',
    align: 'center',
    transform: 'none',
  };
}

export type NewFieldKind = 'sequence' | 'column' | 'static';

export function createField(
  kind: NewFieldKind,
  existing: readonly FieldConfig[],
  options: { column?: string; fontId?: string } = {},
): FieldConfig {
  const used = new Set(existing.map((field) => field.id));
  let counter = existing.length;
  let id = `field-${String(counter)}`;
  while (used.has(id)) {
    counter += 1;
    id = `field-${String(counter)}`;
  }
  const yBase = Math.min(0.92, 0.62 + 0.08 * (existing.length - 1));
  const base = {
    id,
    box: { x: 0.3, y: yBase, width: 0.4 },
    fontId: options.fontId ?? 'poppins',
    maxSize: 14,
    minSize: 8,
    color: '#3a3f4b',
    align: 'center' as const,
    transform: 'none' as const,
  };
  switch (kind) {
    case 'sequence':
      return {
        ...base,
        label: 'Código',
        source: { kind: 'sequence', pattern: 'CERT-2026-{n:000}', start: 1 },
      };
    case 'column':
      return {
        ...base,
        label: options.column ?? 'Columna',
        source: { kind: 'column', column: options.column ?? '' },
      };
    case 'static':
      return { ...base, label: 'Texto fijo', source: { kind: 'static', text: 'Texto' } };
  }
}

export function applyTransform(text: string, transform: TextTransform): string {
  switch (transform) {
    case 'none':
      return normalizeText(text);
    case 'title':
      return toTitleCase(text);
    case 'upper':
      return toUpperCase(text);
  }
}

/** Text of a field for one participant, before the transform. */
export function rawFieldText(field: FieldConfig, participant: Participant): string {
  const { source } = field;
  switch (source.kind) {
    case 'name':
      return participant.name;
    case 'column':
      return participant.fields[source.column] ?? '';
    case 'sequence':
      // An invalid pattern (being typed) is shown as is; generation refuses it (invalidFields).
      return isValidCodePattern(source.pattern)
        ? formatCode(source.pattern, source.start + participant.index)
        : source.pattern;
    case 'static':
      return source.text;
  }
}

/** Final text drawn on the certificate. */
export function resolveFieldText(field: FieldConfig, participant: Participant): string {
  return applyTransform(rawFieldText(field, participant), field.transform);
}

/** Fields that cannot be generated as they are (today: invalid code patterns). */
export function invalidFields(fields: readonly FieldConfig[]): FieldConfig[] {
  return fields.filter(
    (field) => field.source.kind === 'sequence' && !isValidCodePattern(field.source.pattern),
  );
}

/** The first sequence field defines the "código" column of the report. */
export function codeFieldOf(fields: readonly FieldConfig[]): FieldConfig | undefined {
  return fields.find((field) => field.source.kind === 'sequence');
}

export function clampBox(box: FieldBox): FieldBox {
  const width = Math.min(1, Math.max(FIELD_LIMITS.minBoxWidth, box.width));
  const x = Math.min(1 - width, Math.max(0, box.x));
  const y = Math.min(1, Math.max(0, box.y));
  return { x, y, width };
}
