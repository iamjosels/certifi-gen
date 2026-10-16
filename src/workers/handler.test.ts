import { describe, expect, it, vi } from 'vitest';
import type {
  Archiver,
  CertificateRenderer,
  LoadedTemplate,
  MeasureResponse,
  TemplateLoader,
} from '../application/ports';
import { AppError } from '../domain/errors';
import { createNameField } from '../domain/field';
import { buildParticipantList } from '../domain/participant';
import { createWorkerHandler } from './handler';
import type { WorkerResponse } from './protocol';

const template: LoadedTemplate = {
  bytes: new Uint8Array([1]),
  info: {
    kind: 'pdf',
    fileName: 't.pdf',
    fileSize: 1,
    page: { width: 100, height: 50 },
    orientation: 'landscape',
    rotation: 0,
    warnings: [],
  },
};

const participants = buildParticipantList(
  Array.from({ length: 25 }, (_, i) => ({ name: `Persona ${String(i)}`, sourceRow: i + 1 })),
).participants;

function fakeRenderer(delay = 0): CertificateRenderer {
  const measure = (_field: unknown, texts: readonly string[]) => ({
    unitWidths: texts.map((t) => t.length),
    missingChars: texts.map((t) => (t.includes('9') ? ['9'] : [])),
    capHeight: 0.7,
  });
  return {
    prepare: () =>
      Promise.resolve({
        measure,
        renderDocument: async () => {
          if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
          return { bytes: new Uint8Array([1, 2, 3]), overflowFields: [] };
        },
        createMergedDocument: () =>
          Promise.resolve({
            addPage: () => ({ overflowFields: [] }),
            save: () => Promise.resolve(new Uint8Array([4, 5])),
          }),
      }),
    prepareMeasurer: () => Promise.resolve({ measure }),
  };
}

const archiver: Archiver = {
  create: () => {
    const names: string[] = [];
    return {
      add: (name) => names.push(name),
      finish: () => Promise.resolve(new Blob([names.join('\n')])),
    };
  },
};

const templateLoader: TemplateLoader = { load: () => Promise.resolve(template) };

function setup(renderer = fakeRenderer()) {
  const messages: WorkerResponse[] = [];
  const handle = createWorkerHandler({
    renderer,
    archiver,
    templateLoader,
    inspectFont: () => ({
      familyName: 'X',
      isCff: false,
      isVariable: false,
      missingSpanishChars: [],
    }),
    post: (message) => messages.push(message),
  });
  return { handle, messages };
}

function fail(): never {
  throw new Error('missing participant');
}

const request = {
  template,
  fields: [createNameField()],
  fonts: [],
  participants,
  mode: 'both' as const,
};

describe('createWorkerHandler', () => {
  it('answers template and font requests', async () => {
    const { handle, messages } = setup();
    await handle({
      id: 1,
      type: 'load-template',
      file: { name: 't.pdf', bytes: new Uint8Array() },
    });
    await handle({ id: 2, type: 'inspect-font', file: { name: 'f.ttf', bytes: new Uint8Array() } });
    expect(messages).toEqual([
      { id: 1, type: 'result', result: template },
      {
        id: 2,
        type: 'result',
        result: { familyName: 'X', isCff: false, isVariable: false, missingSpanishChars: [] },
      },
    ]);
  });

  it('measures fields and lists missing glyphs', async () => {
    const { handle, messages } = setup();
    await handle({
      id: 3,
      type: 'measure',
      request: { fields: [createNameField()], fonts: [], participants: participants.slice(0, 10) },
    });
    const message = messages[0];
    if (message?.type !== 'result') throw new Error('expected a result');
    const { fields } = message.result as MeasureResponse;
    expect(fields.name?.unitWidths).toHaveLength(10);
    expect(fields.name?.missingChars).toEqual([{ participantIndex: 9, chars: ['9'] }]);
  });

  it('builds previews and size estimates', async () => {
    const { handle, messages } = setup();
    await handle({
      id: 4,
      type: 'preview',
      request: { ...request, participant: participants[0] ?? participants[1] ?? fail() },
    });
    await handle({ id: 5, type: 'estimate', request });
    expect(messages[0]).toMatchObject({ id: 4, type: 'result' });
    expect(messages[1]).toMatchObject({
      id: 5,
      type: 'result',
      result: {
        individualSizes: [3, 3, 3],
        mergedSmall: { pages: 10, bytes: 2 },
        mergedLarge: { pages: 20, bytes: 2 },
      },
    });
  });

  it('streams progress and returns the generation result', async () => {
    const { handle, messages } = setup();
    await handle({ id: 6, type: 'generate', request: { ...request, batchSize: 10 } });
    const progress = messages.flatMap((m) => (m.type === 'progress' ? [m.progress.done] : []));
    expect(progress).toEqual([0, 10, 20, 25, 25]);
    const last = messages.at(-1);
    expect(last).toMatchObject({ id: 6, type: 'result' });
  });

  it('cancels a running generation at the next batch', async () => {
    const { handle, messages } = setup(fakeRenderer(2));
    const running = handle({ id: 7, type: 'generate', request: { ...request, batchSize: 5 } });
    await new Promise((resolve) => setTimeout(resolve, 15));
    await handle({ id: 7, type: 'cancel' });
    await running;
    const last = messages.at(-1);
    expect(last).toMatchObject({ id: 7, type: 'error', code: 'generation-cancelled' });
    const done = messages.flatMap((m) => (m.type === 'progress' ? [m.progress.done] : []));
    expect(Math.max(...done)).toBeLessThan(25);
  });

  it('maps errors to codes', async () => {
    const failing: CertificateRenderer = {
      ...fakeRenderer(),
      prepare: () => Promise.reject(new AppError('font-invalid', 'x')),
      prepareMeasurer: () => Promise.reject(new Error('boom')),
    };
    const { handle, messages } = setup(failing);
    await handle({ id: 8, type: 'generate', request });
    await handle({
      id: 9,
      type: 'measure',
      request: { fields: [createNameField()], fonts: [], participants },
    });
    expect(messages).toEqual([
      { id: 8, type: 'error', code: 'font-invalid', detail: 'x', message: 'font-invalid: x' },
      {
        id: 9,
        type: 'error',
        code: 'worker-unavailable',
        detail: 'boom',
        message: 'worker-unavailable: boom',
      },
    ]);
  });

  it('reports unexpected generation failures as generation-failed', async () => {
    const renderer = fakeRenderer();
    const broken: CertificateRenderer = {
      ...renderer,
      prepare: vi.fn(() => Promise.reject(new Error('disk full'))),
    };
    const { handle, messages } = setup(broken);
    await handle({ id: 10, type: 'generate', request });
    expect(messages[0]).toMatchObject({ code: 'generation-failed', detail: 'disk full' });
  });
});
