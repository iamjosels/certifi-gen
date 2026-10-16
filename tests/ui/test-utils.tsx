import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { applyLayout } from '../../src/application/parse-participants';
import type {
  FontDescriptor,
  GenerationEngine,
  GenerationOutput,
  LoadedTemplate,
  MeasureResponse,
} from '../../src/application/ports';
import type { AppServices } from '../../src/application/services';
import { resolveFieldText } from '../../src/domain/field';
import type { SizeSample } from '../../src/domain/size-estimate';
import { createParserRegistry } from '../../src/infrastructure/parsers/registry';
import { ServicesProvider } from '../../src/ui/components/ServicesProvider';
import { useAppStore } from '../../src/ui/store/app-store';

export const PDF_TEMPLATE: LoadedTemplate = {
  bytes: new TextEncoder().encode('%PDF-1.7 fake'),
  info: {
    kind: 'pdf',
    fileName: 'plantilla.pdf',
    fileSize: 11_591,
    page: { width: 841.89, height: 595.28 },
    orientation: 'landscape',
    rotation: 0,
    warnings: [],
  },
};

export const SAMPLE: SizeSample = {
  individualSizes: [19_000, 19_500, 19_200],
  mergedSmall: { pages: 10, bytes: 40_000 },
  mergedLarge: { pages: 20, bytes: 45_000 },
};

const FONTS: FontDescriptor[] = [
  {
    id: 'dm-serif-display',
    name: 'DM Serif Display',
    category: 'serif',
    subset: true,
    source: 'bundled',
  },
  { id: 'poppins', name: 'Poppins', category: 'sans', subset: true, source: 'bundled' },
];

/** Width at 1 pt used by the fake engine: 0.5 em per character. */
export const FAKE_EM = 0.5;

export function fakeMeasure(request: Parameters<GenerationEngine['measure']>[0]): MeasureResponse {
  const fields: Record<string, MeasureResponse['fields'][string]> = {};
  for (const field of request.fields) {
    fields[field.id] = {
      unitWidths: request.participants.map((p) => resolveFieldText(field, p).length * FAKE_EM),
      missingChars: [],
      capHeight: 0.7,
    };
  }
  return { fields };
}

export function fakeOutput(total: number): GenerationOutput {
  return {
    zip: new Blob(['zip'], { type: 'application/zip' }),
    merged: new Blob(['pdf'], { type: 'application/pdf' }),
    report: Array.from({ length: total }, (_, i) => ({
      index: i + 1,
      name: `P${String(i)}`,
      fileName: `${String(i)}.pdf`,
      code: '',
      overflowFields: [],
    })),
    overflowCount: 0,
    elapsedMs: 4321,
  };
}

export function createFakeServices(overrides: Partial<AppServices> = {}) {
  const userFonts: FontDescriptor[] = [];
  const engine = {
    loadTemplate: vi.fn(() => Promise.resolve(PDF_TEMPLATE)),
    inspectFont: vi.fn(() =>
      Promise.resolve({
        familyName: 'Mi Fuente',
        isCff: false,
        isVariable: false,
        missingSpanishChars: [],
      }),
    ),
    measure: vi.fn((request: Parameters<GenerationEngine['measure']>[0]) =>
      Promise.resolve(fakeMeasure(request)),
    ),
    preview: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
    estimate: vi.fn(() => Promise.resolve(SAMPLE)),
    generate: vi.fn<GenerationEngine['generate']>((request, onProgress) => {
      onProgress({ phase: 'rendering', done: 0, total: request.participants.length, elapsedMs: 0 });
      return Promise.resolve(fakeOutput(request.participants.length));
    }),
  } satisfies GenerationEngine;

  const services: AppServices = {
    engine,
    parsers: createParserRegistry(),
    fonts: {
      list: () => [...FONTS, ...userFonts],
      load: (id) => Promise.resolve({ id, bytes: new Uint8Array([0, 1, 0, 0]), subset: true }),
      registerUserFont: (file, info) => {
        const descriptor: FontDescriptor = {
          id: `user-${file.name}`,
          name: info.familyName,
          category: 'custom',
          subset: !info.isCff,
          source: 'user',
        };
        userFonts.push(descriptor);
        return descriptor;
      },
    },
    rasterizer: {
      renderPdf: vi.fn(() =>
        Promise.resolve({ url: 'blob:preview', width: 1600, height: 1131, release: vi.fn() }),
      ),
    },
    imageOptimizer: {
      hasTransparency: vi.fn(() => Promise.resolve(false)),
      toJpeg: vi.fn((file: { name: string }) =>
        Promise.resolve({
          name: file.name.replace(/\.png$/u, '.jpg'),
          bytes: new Uint8Array(1000),
        }),
      ),
    },
    configStorage: { load: vi.fn(() => null), save: vi.fn(() => true) },
    ...overrides,
  };
  return { services, engine };
}

export function renderWithServices(
  ui: ReactElement,
  services: AppServices = createFakeServices().services,
): RenderResult {
  return render(<ServicesProvider services={services}>{ui}</ServicesProvider>);
}

export function textFile(name: string, content: string, type = 'text/plain'): File {
  return new File([content], name, { type });
}

/** Puts a template and a participant list in the store, as if steps 1 and 2 were done. */
export async function seedStore(names: readonly string[]): Promise<void> {
  const registry = createParserRegistry();
  const parser = await registry.load('txt');
  const table = await parser.parse({
    name: 'lista.txt',
    bytes: new TextEncoder().encode(names.join('\n')),
  });
  const { layout, list } = applyLayout(table);
  const state = useAppStore.getState();
  state.setTemplate({
    file: { name: 'plantilla.pdf', bytes: PDF_TEMPLATE.bytes },
    loaded: PDF_TEMPLATE,
    previewUrl: 'blob:preview',
    releasePreview: () => undefined,
  });
  state.setParticipants({
    fileName: 'lista.txt',
    format: 'txt',
    encoding: 'utf-8',
    table,
    layout,
    list,
  });
}
