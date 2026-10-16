import AxeBuilder from '@axe-core/playwright';
import JSZip from 'jszip';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { extractFromDoc, openPdf } from '../../scripts/lib/pdf-node';
import { expect, type Page } from './fixtures';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const FIXTURES = join(ROOT, 'fixtures');

export function fixture(name: string): string {
  return join(FIXTURES, name);
}

export interface Expected {
  names: string[];
  samples: Record<'first' | 'last' | 'longest' | 'withEnye' | 'withApostrophe' | 'normal', string>;
}

export async function readExpected(): Promise<Expected> {
  return JSON.parse(await readFile(fixture('expected.json'), 'utf8')) as Expected;
}

export async function uploadTemplate(page: Page, file: string): Promise<void> {
  await page.getByLabel('Elegir plantilla (PDF, PNG o JPG)').setInputFiles(fixture(file));
  await expect(page.getByAltText(/Miniatura de la plantilla/)).toBeVisible();
}

export async function uploadList(page: Page, file: string): Promise<void> {
  await page.getByLabel('Elegir lista de participantes').setInputFiles(fixture(file));
  await expect(page.getByText('Participantes válidos')).toBeVisible();
}

export async function next(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Continuar' }).click();
}

/** Template + list + design step ready (measurements done). */
export async function prepare(page: Page, template: string, list: string): Promise<void> {
  await page.goto('/');
  await uploadTemplate(page, template);
  await next(page);
  await uploadList(page, list);
  await next(page);
  await expect(
    page.getByRole('heading', { name: 'Ubica los campos sobre la plantilla' }),
  ).toBeVisible();
  await expect(page.getByText(/Todos los textos entran|no entran/)).toBeVisible();
}

export type Mode = 'zip' | 'merged' | 'both';
const MODE_LABEL: Record<Mode, RegExp> = {
  zip: /ZIP con un PDF por persona/,
  merged: /Un solo PDF con todos/,
  both: /^Ambos/,
};

export async function selectMode(page: Page, mode: Mode): Promise<void> {
  await page.getByRole('radio', { name: MODE_LABEL[mode] }).check({ force: true });
}

/** Starts the generation and waits for the summary. Returns the browser-side duration. */
export async function generate(page: Page, total: number): Promise<number> {
  const started = Date.now();
  await page
    .getByRole('button', {
      name: new RegExp(`Generar ${total.toLocaleString('es-PE')} certificados|Volver a generar`),
    })
    .click();
  await expect(page.getByText(/¡Listo! .* certificados generados/)).toBeVisible({
    timeout: 120_000,
  });
  return Date.now() - started;
}

export async function download(page: Page, link: RegExp): Promise<Uint8Array> {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: link }).click(),
  ]);
  const path = await file.path();
  return new Uint8Array(await readFile(path));
}

export async function readZip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const zip = await JSZip.loadAsync(bytes);
  const files = new Map<string, Uint8Array>();
  for (const entry of Object.values(zip.files))
    files.set(entry.name, await entry.async('uint8array'));
  return files;
}

export async function pageCount(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount();
}

export async function pageSize(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  return (await PDFDocument.load(bytes)).getPage(0).getSize();
}

/** Text drawn in the vertical band centered at `y` (relative, top-left origin). */
export async function textInBand(
  bytes: Uint8Array,
  pageNumber: number,
  y = 0.5,
  halfHeight = 40,
): Promise<string> {
  const { doc, close } = await openPdf(bytes);
  try {
    const { items, pageHeight } = await extractFromDoc(doc, pageNumber);
    const centerY = (1 - y) * pageHeight;
    return items
      .filter((item) => Math.abs(item.y - centerY) < halfHeight)
      .map((item) => item.text)
      .join('');
  } finally {
    await close();
  }
}

export async function expectNoA11yViolations(page: Page, context: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? '?'}): ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(' '))
        .join(' | ')}`,
  );
  expect(summary, `axe violations in ${context}`).toEqual([]);
}

/** Records the main-thread long tasks from now on. */
export async function watchLongTasks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store: number[] = [];
    (window as unknown as { __longTasks: number[] }).__longTasks = store;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) store.push(entry.duration);
    }).observe({ type: 'longtask' });
  });
}

export async function longTasks(page: Page): Promise<number[]> {
  return page.evaluate(() => (window as unknown as { __longTasks: number[] }).__longTasks);
}

export async function recordMetric(name: string, value: unknown): Promise<void> {
  const file = join(ROOT, 'docs', 'verification', 'metrics-e2e.json');
  await mkdir(dirname(file), { recursive: true });
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
  } catch {
    data = {};
  }
  data[name] = value;
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}
