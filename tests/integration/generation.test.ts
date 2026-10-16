import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';
import { extractFromDoc, openPdf } from '../../scripts/lib/pdf-node';
import type { FontAsset, GenerationProgress, LoadedTemplate } from '../../src/application/ports';
import { createField, createNameField, type FieldConfig } from '../../src/domain/field';
import { certificateFileName } from '../../src/domain/filename';
import type { Participant } from '../../src/domain/participant';
import {
  blobBytes,
  loadBundledFonts,
  loadParticipants,
  loadTemplateFixture,
  runGeneration,
} from './engine-helpers';
import { readExpected, type Expected } from './helpers';

const KB = 1024;
const MB = 1024 * 1024;

let fonts: FontAsset[];
let participants: Participant[];
let expected: Expected;
let template: LoadedTemplate;

beforeAll(async () => {
  [fonts, participants, expected, template] = await Promise.all([
    loadBundledFonts(),
    loadParticipants(),
    readExpected(),
    loadTemplateFixture('plantilla-horizontal.pdf'),
  ]);
});

/** Text drawn inside the vertical band of a field (template texts are elsewhere). */
async function nameItemsOnPage(
  pdf: Uint8Array | Awaited<ReturnType<typeof openPdf>>['doc'],
  pageNumber: number,
  field: FieldConfig,
) {
  const owned = pdf instanceof Uint8Array ? await openPdf(pdf) : null;
  const doc = owned ? owned.doc : (pdf as Awaited<ReturnType<typeof openPdf>>['doc']);
  try {
    const { items, pageWidth, pageHeight } = await extractFromDoc(doc, pageNumber);
    const centerY = (1 - field.box.y) * pageHeight;
    const band = items.filter((item) => Math.abs(item.y - centerY) < field.maxSize);
    return {
      text: band.map((item) => item.text).join(''),
      items: band,
      boxLeft: field.box.x * pageWidth,
      boxRight: (field.box.x + field.box.width) * pageWidth,
    };
  } finally {
    await owned?.close();
  }
}

function indexOfName(name: string): number {
  const index = participants.findIndex((p) => p.name === name);
  if (index === -1) throw new Error(`${name} not found`);
  return index;
}

describe('360 certificates from the PDF template and the TXT list', () => {
  let zipFiles: Map<string, Uint8Array>;
  let merged: Uint8Array;
  let reportCsv: string;
  let progress: GenerationProgress[];
  let elapsedMs: number;
  const nameField = createNameField();

  beforeAll(async () => {
    progress = [];
    const output = await runGeneration({
      template,
      participants,
      mode: 'both',
      fonts,
      fields: [nameField],
      onProgress: (p) => progress.push(p),
    });
    elapsedMs = output.elapsedMs;
    const zip = await JSZip.loadAsync(await blobBytes(output.zip));
    zipFiles = new Map();
    for (const file of Object.values(zip.files)) {
      zipFiles.set(file.name, await file.async('uint8array'));
    }
    reportCsv = new TextDecoder().decode(zipFiles.get('reporte.csv'));
    merged = await blobBytes(output.merged);
    console.info(
      `[metrics] 360 both modes: ${String(Math.round(elapsedMs))} ms, ` +
        `ZIP ${(output.zip?.size ?? 0).toLocaleString('en')} B, ` +
        `merged ${(output.merged?.size ?? 0).toLocaleString('en')} B`,
    );
  });

  it('creates 360 PDFs plus reporte.csv in the ZIP, with indexed unique names', () => {
    const pdfs = [...zipFiles.keys()].filter((name) => name.endsWith('.pdf'));
    expect(pdfs).toHaveLength(360);
    expect(zipFiles.has('reporte.csv')).toBe(true);
    expect(new Set(pdfs).size).toBe(360);
    expect(pdfs).toContain(certificateFileName(0, 360, expected.names[0] ?? ''));
    expect(pdfs.every((name) => /^\d{3}_[A-Za-z0-9_]+\.pdf$/u.test(name))).toBe(true);
  });

  it('creates a single PDF with 360 pages', async () => {
    expect((await PDFDocument.load(merged)).getPageCount()).toBe(360);
  });

  it('writes the exact names in the single PDF (first, last, longest, with ñ)', async () => {
    const { doc, close } = await openPdf(merged);
    try {
      for (const name of [
        expected.samples.first,
        expected.samples.last,
        expected.samples.longest,
        expected.samples.withEnye,
        expected.samples.withApostrophe,
        expected.samples.withDiaeresis,
      ]) {
        const page = indexOfName(name) + 1;
        expect((await nameItemsOnPage(doc, page, nameField)).text).toBe(name);
      }
    } finally {
      await close();
    }
  });

  it('writes the exact names in the individual PDFs', async () => {
    for (const name of [expected.samples.first, expected.samples.last, expected.samples.longest]) {
      const index = indexOfName(name);
      const file = zipFiles.get(certificateFileName(index, 360, name));
      expect(file).toBeDefined();
      expect((await nameItemsOnPage(file ?? new Uint8Array(), 1, nameField)).text).toBe(name);
    }
  });

  it('keeps every long name inside its box', async () => {
    const { doc, close } = await openPdf(merged);
    try {
      for (const name of expected.samples.longNames) {
        const { items, boxLeft, boxRight } = await nameItemsOnPage(
          doc,
          indexOfName(name) + 1,
          nameField,
        );
        const left = Math.min(...items.map((item) => item.x));
        const right = Math.max(...items.map((item) => item.x + item.width));
        expect(left).toBeGreaterThanOrEqual(boxLeft - 0.5);
        expect(right).toBeLessThanOrEqual(boxRight + 0.5);
      }
    } finally {
      await close();
    }
  });

  it('reports every participant and no overflow with the default field', () => {
    const lines = reportCsv
      .replace(/^\ufeff/u, '')
      .trim()
      .split('\r\n');
    expect(lines[0]).toBe('indice,nombre,archivo,codigo,desborde');
    expect(lines).toHaveLength(361);
    expect(lines.slice(1).every((line) => line.endsWith(',no'))).toBe(true);
    expect(lines[1]).toContain(expected.samples.first);
  });

  it('reports progress by batches up to 360/360', () => {
    const rendering = progress.filter((p) => p.phase === 'rendering');
    expect(rendering[0]?.done).toBe(0);
    expect(rendering.map((p) => p.done)).toContain(180);
    expect(rendering.at(-1)?.done).toBe(360);
    expect(progress.at(-1)?.phase).toBe('packaging');
  });

  it('generates the 360 certificates in both modes in less than 60 seconds', () => {
    expect(elapsedMs).toBeLessThan(60_000);
  });

  it('keeps the single PDF light: template embedded once (≤ template + 10 MB)', () => {
    expect(merged.length).toBeLessThanOrEqual(template.bytes.length + 10 * MB);
  });

  it('keeps every individual PDF ≤ template + 150 KB', () => {
    const largest = Math.max(
      ...[...zipFiles.entries()].filter(([n]) => n.endsWith('.pdf')).map(([, b]) => b.length),
    );
    expect(largest).toBeLessThanOrEqual(template.bytes.length + 150 * KB);
  });
});

describe('other templates (sizes, orientation and text)', () => {
  const TEMPLATES = [
    'plantilla-vertical.pdf',
    'plantilla-horizontal.png',
    'plantilla-vertical.png',
    'plantilla-horizontal.jpg',
    'plantilla-vertical.jpg',
    'plantilla-pesada.png',
    'plantilla-transparente.png',
    'plantilla-exif-rotada.jpg',
    'plantilla-rotada.pdf',
    'plantilla-recortada.pdf',
  ];

  it.each(TEMPLATES)(
    '%s: 360-page PDF and individual PDFs within the size limits',
    async (file) => {
      const loaded = await loadTemplateFixture(file);
      const nameField = createNameField();
      const mergedOutput = await runGeneration({
        template: loaded,
        participants,
        mode: 'merged',
        fonts,
        fields: [nameField],
      });
      const merged = await blobBytes(mergedOutput.merged);
      expect((await PDFDocument.load(merged)).getPageCount()).toBe(360);
      expect(merged.length).toBeLessThanOrEqual(loaded.bytes.length + 10 * MB);
      expect(mergedOutput.overflowCount).toBe(0);

      const longest = participants[indexOfName(expected.samples.longest)];
      const sample = [participants[0], longest].filter((p): p is Participant => p !== undefined);
      const zipOutput = await runGeneration({
        template: loaded,
        participants: sample,
        mode: 'zip',
        fonts,
        fields: [nameField],
      });
      const zip = await JSZip.loadAsync(await blobBytes(zipOutput.zip));
      const sizes: number[] = [];
      for (const entry of Object.values(zip.files).filter((f) => f.name.endsWith('.pdf'))) {
        sizes.push((await entry.async('uint8array')).length);
      }
      expect(sizes).toHaveLength(2);
      expect(Math.max(...sizes)).toBeLessThanOrEqual(loaded.bytes.length + 150 * KB);
      expect(
        (await nameItemsOnPage(merged, indexOfName(expected.samples.longest) + 1, nameField)).text,
      ).toBe(expected.samples.longest);
      console.info(
        `[metrics] ${file}: template ${loaded.bytes.length.toLocaleString('en')} B, ` +
          `merged 360 ${merged.length.toLocaleString('en')} B, ` +
          `largest individual ${Math.max(...sizes).toLocaleString('en')} B, ` +
          `${String(Math.round(mergedOutput.elapsedMs))} ms`,
      );
    },
  );
});

describe('several fields, codes and overflow', () => {
  it('draws the code and a column field and fills the report code column', async () => {
    const name = createNameField();
    const code = createField('sequence', [name]);
    // Placed below the signatures, where the template has no text of its own.
    const course: FieldConfig = {
      ...createField('column', [name, code], { column: 'Curso' }),
      box: { x: 0.3, y: 0.93, width: 0.4 },
    };
    const list = (await loadParticipants('participantes-360.csv')).slice(0, 3);
    const output = await runGeneration({
      template,
      participants: list,
      mode: 'both',
      fonts,
      fields: [name, code, course],
    });
    const merged = await blobBytes(output.merged);
    expect((await nameItemsOnPage(merged, 2, code)).text).toBe('CERT-2026-002');
    expect((await nameItemsOnPage(merged, 1, course)).text).toBe(list[0]?.fields.Curso);
    const zip = await JSZip.loadAsync(await blobBytes(output.zip));
    const report = (await zip.file('reporte.csv')?.async('string')) ?? '';
    expect(report).toContain(',CERT-2026-001,no');
  });

  it('marks names that do not fit even at the minimum size', async () => {
    const narrow: FieldConfig = { ...createNameField(), box: { x: 0.4, y: 0.5, width: 0.2 } };
    const longest = participants[indexOfName(expected.samples.longest)];
    const output = await runGeneration({
      template,
      participants: longest ? [longest] : [],
      mode: 'zip',
      fonts,
      fields: [narrow],
    });
    expect(output.overflowCount).toBe(1);
    expect(output.report[0]?.overflowFields).toEqual(['Nombre']);
    const zip = await JSZip.loadAsync(await blobBytes(output.zip));
    expect(await zip.file('reporte.csv')?.async('string')).toContain('sí (Nombre)');
  });

  it('applies the title-case transform on the certificate only', async () => {
    const field: FieldConfig = { ...createNameField(), transform: 'title' };
    const mixed = participants.filter((p) => p.name === 'pEdRo SÁNCHEZ díaz');
    const output = await runGeneration({
      template,
      participants: mixed,
      mode: 'merged',
      fonts,
      fields: [field],
    });
    expect((await nameItemsOnPage(await blobBytes(output.merged), 1, field)).text).toBe(
      'Pedro Sánchez Díaz',
    );
    expect(output.report[0]?.name).toBe('pEdRo SÁNCHEZ díaz');
  });

  it('refuses to generate with an invalid code pattern', async () => {
    const code: FieldConfig = {
      ...createField('sequence', [createNameField()]),
      source: { kind: 'sequence', pattern: 'CERT', start: 1 },
    };
    await expect(
      runGeneration({
        template,
        participants: participants.slice(0, 2),
        mode: 'zip',
        fonts,
        fields: [createNameField(), code],
      }),
    ).rejects.toMatchObject({ code: 'code-pattern-invalid' });
  });

  it('stops at the next batch when cancelled', async () => {
    let checkpoints = 0;
    await expect(
      runGeneration({
        template,
        participants,
        mode: 'zip',
        fonts,
        checkpoint: () => {
          checkpoints += 1;
          return checkpoints === 2 ? Promise.reject(new Error('cancelled')) : Promise.resolve();
        },
      }),
    ).rejects.toThrow('cancelled');
    expect(checkpoints).toBe(2);
  });
});
