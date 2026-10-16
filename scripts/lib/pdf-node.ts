/**
 * Node-only helpers around pdf.js (legacy build) + @napi-rs/canvas.
 * Used by the fixture generator, the visual verification script and integration tests.
 */
import { createCanvas } from '@napi-rs/canvas';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PDFJS_DIR = join(ROOT, 'node_modules', 'pdfjs-dist');

function assetDir(name: string): string {
  return `${join(PDFJS_DIR, name)}/`;
}

export async function openPdf(bytes: Uint8Array): Promise<{
  doc: PDFDocumentProxy;
  close: () => Promise<void>;
}> {
  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl: assetDir('standard_fonts'),
    cMapUrl: assetDir('cmaps'),
    cMapPacked: true,
    wasmUrl: assetDir('wasm'),
    iccUrl: assetDir('iccs'),
    verbosity: 0,
  });
  const doc = await loadingTask.promise;
  return { doc, close: () => loadingTask.destroy() };
}

export interface RenderOptions {
  /** Pixels per PDF point. 1 = 72 DPI. */
  scale?: number;
  pageNumber?: number;
  /** Optional crop in rendered pixels. */
  crop?: { x: number; y: number; width: number; height: number };
  format?: 'png' | 'jpeg';
  quality?: number;
}

export async function renderPdfPage(
  bytes: Uint8Array,
  options: RenderOptions = {},
): Promise<Buffer> {
  const { scale = 2, pageNumber = 1, format = 'png', quality = 90 } = options;
  const { doc, close } = await openPdf(bytes);
  try {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    let output = canvas;
    if (options.crop) {
      const { x, y, width: cropWidth, height: cropHeight } = options.crop;
      const cropped = createCanvas(Math.round(cropWidth), Math.round(cropHeight));
      cropped
        .getContext('2d')
        .drawImage(canvas, x, y, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      output = cropped;
    }
    return format === 'png' ? output.toBuffer('image/png') : output.toBuffer('image/jpeg', quality);
  } finally {
    await close();
  }
}

export interface ExtractedTextItem {
  text: string;
  /** Position in PDF points, origin bottom-left. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function extractPageText(
  bytes: Uint8Array,
  pageNumber = 1,
): Promise<{ items: ExtractedTextItem[]; pageWidth: number; pageHeight: number }> {
  const { doc, close } = await openPdf(bytes);
  try {
    return await extractFromDoc(doc, pageNumber);
  } finally {
    await close();
  }
}

export async function extractFromDoc(
  doc: PDFDocumentProxy,
  pageNumber: number,
): Promise<{ items: ExtractedTextItem[]; pageWidth: number; pageHeight: number }> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items: ExtractedTextItem[] = [];
  for (const item of content.items) {
    if (!('str' in item) || item.str.length === 0) continue;
    const [, , , , e, f] = item.transform as [number, number, number, number, number, number];
    items.push({ text: item.str, x: e, y: f, width: item.width, height: item.height });
  }
  return { items, pageWidth: viewport.width, pageHeight: viewport.height };
}

export async function countPages(bytes: Uint8Array): Promise<number> {
  const { doc, close } = await openPdf(bytes);
  try {
    return doc.numPages;
  } finally {
    await close();
  }
}
