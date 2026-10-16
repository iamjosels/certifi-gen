import { isValidCodePattern } from './code-pattern';
import { AppError } from './errors';
import {
  FIELD_LIMITS,
  type FieldConfig,
  type FieldSource,
  type TextAlign,
  type TextTransform,
} from './field';
import type { OutputMode } from './size-estimate';
import type { TemplateKind } from './template';

export const CONFIG_SCHEMA_VERSION = 1;
export const CONFIG_APP_ID = 'certifi-gen';

/** Reusable event configuration: fields, positions and fonts. Never contains files. */
export interface ProjectConfig {
  readonly app: typeof CONFIG_APP_ID;
  readonly schemaVersion: typeof CONFIG_SCHEMA_VERSION;
  readonly savedAt: string;
  readonly fields: readonly FieldConfig[];
  readonly output: { readonly mode: OutputMode };
  /** Template the configuration was designed on, to warn when the new one differs. */
  readonly template: { readonly kind: TemplateKind; readonly aspectRatio: number } | null;
  /** Preferred name column label (for CSV/XLSX lists). */
  readonly nameColumn: string | null;
  /** Custom fonts referenced by fields (the files themselves are not stored). */
  readonly customFonts: readonly { readonly id: string; readonly name: string }[];
}

export type ConfigWarning =
  | { readonly kind: 'missing-font'; readonly fieldId: string; readonly fontId: string }
  | { readonly kind: 'aspect-mismatch'; readonly expected: number; readonly actual: number };

export interface ParsedConfig {
  readonly config: ProjectConfig;
  readonly warnings: readonly ConfigWarning[];
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(detail: string): never {
  throw new AppError('config-invalid', detail);
}

function number(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    fail(`${path} must be a number between ${String(min)} and ${String(max)}`);
  }
  return value;
}

function string(value: unknown, path: string, maxLength = 500): string {
  if (typeof value !== 'string' || value.length > maxLength) fail(`${path} must be a string`);
  return value;
}

function oneOf<T extends string>(value: unknown, path: string, options: readonly T[]): T {
  if (typeof value !== 'string' || !options.includes(value as T)) {
    fail(`${path} must be one of ${options.join(', ')}`);
  }
  return value as T;
}

function parseSource(value: unknown, path: string): FieldSource {
  if (!isObject(value)) fail(`${path} must be an object`);
  const kind = oneOf(value.kind, `${path}.kind`, ['name', 'column', 'sequence', 'static'] as const);
  switch (kind) {
    case 'name':
      return { kind };
    case 'column':
      return { kind, column: string(value.column, `${path}.column`, 200) };
    case 'sequence': {
      const pattern = string(value.pattern, `${path}.pattern`, 200);
      if (!isValidCodePattern(pattern)) fail(`${path}.pattern is not a valid code pattern`);
      const start = number(value.start, `${path}.start`, 0, 1e9);
      if (!Number.isInteger(start)) fail(`${path}.start must be an integer`);
      return { kind, pattern, start };
    }
    case 'static':
      return { kind, text: string(value.text, `${path}.text`, 500) };
  }
}

export function parseField(value: unknown, path = 'field'): FieldConfig {
  if (!isObject(value)) fail(`${path} must be an object`);
  const box = value.box;
  if (!isObject(box)) fail(`${path}.box must be an object`);
  const width = number(box.width, `${path}.box.width`, FIELD_LIMITS.minBoxWidth, 1);
  const x = number(box.x, `${path}.box.x`, 0, 1);
  if (x + width > 1 + 1e-6) fail(`${path}.box exceeds the page width`);
  const y = number(box.y, `${path}.box.y`, 0, 1);
  const maxSize = number(
    value.maxSize,
    `${path}.maxSize`,
    FIELD_LIMITS.minFontSize,
    FIELD_LIMITS.maxFontSize,
  );
  const minSize = number(value.minSize, `${path}.minSize`, FIELD_LIMITS.minFontSize, maxSize);
  const color = string(value.color, `${path}.color`, 7);
  if (!/^#[0-9a-fA-F]{6}$/u.test(color)) fail(`${path}.color must be #rrggbb`);
  const id = string(value.id, `${path}.id`, 64);
  if (id.length === 0) fail(`${path}.id must not be empty`);
  return {
    id,
    label: string(value.label, `${path}.label`, 100),
    source: parseSource(value.source, `${path}.source`),
    box: { x, y, width },
    fontId: string(value.fontId, `${path}.fontId`, 100),
    maxSize,
    minSize,
    color: color.toLowerCase(),
    align: oneOf<TextAlign>(value.align, `${path}.align`, ['left', 'center', 'right']),
    transform: oneOf<TextTransform>(value.transform, `${path}.transform`, [
      'none',
      'title',
      'upper',
    ]),
  };
}

export function createConfig(params: {
  fields: readonly FieldConfig[];
  mode: OutputMode;
  template: { kind: TemplateKind; aspectRatio: number } | null;
  nameColumn: string | null;
  customFonts: readonly { id: string; name: string }[];
  now?: Date;
}): ProjectConfig {
  return {
    app: CONFIG_APP_ID,
    schemaVersion: CONFIG_SCHEMA_VERSION,
    savedAt: (params.now ?? new Date()).toISOString(),
    fields: params.fields,
    output: { mode: params.mode },
    template: params.template,
    nameColumn: params.nameColumn,
    customFonts: params.customFonts,
  };
}

export function serializeConfig(config: ProjectConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

/**
 * Validates an imported configuration. Throws AppError('config-invalid' | 'config-version');
 * returns warnings for fonts that are not available and for templates with another shape.
 */
export function parseConfig(
  json: string,
  context: { availableFontIds: readonly string[]; templateAspectRatio: number | null },
): ParsedConfig {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (error) {
    throw new AppError('config-invalid', 'not JSON', { cause: error });
  }
  if (!isObject(data) || data.app !== CONFIG_APP_ID) fail('not a certifi-gen configuration');
  if (data.schemaVersion !== CONFIG_SCHEMA_VERSION) {
    throw new AppError('config-version', String(data.schemaVersion));
  }
  if (!Array.isArray(data.fields) || data.fields.length === 0) fail('fields must be a list');
  if (data.fields.length > FIELD_LIMITS.maxFields) fail('too many fields');
  const fields = data.fields.map((field, i) => parseField(field, `fields[${String(i)}]`));
  if (new Set(fields.map((field) => field.id)).size !== fields.length) fail('duplicate field ids');

  const output = isObject(data.output) ? data.output : {};
  const mode = oneOf<OutputMode>(output.mode ?? 'both', 'output.mode', ['zip', 'merged', 'both']);

  let template: ProjectConfig['template'] = null;
  if (isObject(data.template)) {
    template = {
      kind: oneOf<TemplateKind>(data.template.kind, 'template.kind', ['pdf', 'png', 'jpg']),
      aspectRatio: number(data.template.aspectRatio, 'template.aspectRatio', 0.01, 100),
    };
  }

  const customFonts = Array.isArray(data.customFonts)
    ? data.customFonts.map((font, i) => {
        if (!isObject(font)) fail(`customFonts[${String(i)}] must be an object`);
        return {
          id: string(font.id, `customFonts[${String(i)}].id`, 100),
          name: string(font.name, `customFonts[${String(i)}].name`, 200),
        };
      })
    : [];

  const warnings: ConfigWarning[] = [];
  const available = new Set(context.availableFontIds);
  for (const field of fields) {
    if (!available.has(field.fontId)) {
      warnings.push({ kind: 'missing-font', fieldId: field.id, fontId: field.fontId });
    }
  }
  if (template && context.templateAspectRatio !== null) {
    const difference = Math.abs(template.aspectRatio - context.templateAspectRatio);
    if (difference / template.aspectRatio > 0.02) {
      warnings.push({
        kind: 'aspect-mismatch',
        expected: template.aspectRatio,
        actual: context.templateAspectRatio,
      });
    }
  }

  return {
    config: {
      app: CONFIG_APP_ID,
      schemaVersion: CONFIG_SCHEMA_VERSION,
      savedAt: typeof data.savedAt === 'string' ? data.savedAt : new Date(0).toISOString(),
      fields,
      output: { mode },
      template,
      nameColumn: typeof data.nameColumn === 'string' ? data.nameColumn : null,
      customFonts,
    },
    warnings,
  };
}

/** Replaces fonts that are not available by `fallbackFontId`. */
export function withAvailableFonts(
  fields: readonly FieldConfig[],
  availableFontIds: readonly string[],
  fallbackFontId: string,
): FieldConfig[] {
  const available = new Set(availableFontIds);
  return fields.map((field) =>
    available.has(field.fontId) ? field : { ...field, fontId: fallbackFontId },
  );
}
