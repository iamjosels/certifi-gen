import fontkit from '@pdf-lib/fontkit';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { PDFDocument, rgb } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { extractPageText, renderPdfPage } from '../../scripts/lib/pdf-node';
import type { FontAsset } from '../../src/application/ports';
import { BUNDLED_FONTS, SPANISH_CHARS } from '../../src/infrastructure/fonts/bundled-fonts';
import { inspectFont, missingChars, openFont } from '../../src/infrastructure/fonts/font-tools';
import { embedOptions } from '../../src/infrastructure/pdf/pdf-lib-renderer';
import { loadBundledFonts } from './engine-helpers';

const SAMPLE = "Begoña Núñez · Seán O'Connor · María-José · Güemes ¿¡ÁÉÍÓÚÜÑ!? Zoë Ñuflo";

type EmbedOptions = ReturnType<typeof embedOptions>;

async function pdfWith(bytes: Uint8Array, options: EmbedOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(bytes, options);
  const page = doc.addPage([900, 120]);
  const size = Math.min(30, 860 / font.widthOfTextAtSize(SAMPLE, 1));
  page.drawText(SAMPLE, { x: 20, y: 50, size, font, color: rgb(0, 0, 0) });
  return doc.save();
}

async function pixels(png: Buffer): Promise<Uint8ClampedArray> {
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, image.width, image.height).data;
}

async function assetOf(id: string): Promise<FontAsset> {
  const asset = (await loadBundledFonts()).find((font) => font.id === id);
  if (!asset) throw new Error(`font ${id} not loaded`);
  return asset;
}

const subsetOptions = embedOptions({ id: 'x', bytes: new Uint8Array(), subset: true });
const fullOptions = embedOptions({ id: 'x', bytes: new Uint8Array(), subset: false });

describe.each(BUNDLED_FONTS)('bundled font $name', (font) => {
  it('draws every Spanish character and is a static TrueType font', async () => {
    const asset = await assetOf(font.id);
    expect(missingChars(openFont(asset.bytes), SPANISH_CHARS)).toEqual([]);
    expect(inspectFont({ name: font.path, bytes: asset.bytes })).toMatchObject({
      isCff: false,
      isVariable: false,
      missingSpanishChars: [],
    });
  });

  it('subsetting never changes the glyphs (pixel-identical to the complete font)', async () => {
    const asset = await assetOf(font.id);
    // Same layout in both (no substitutions), so only the embedding differs.
    const complete = await pdfWith(asset.bytes, fullOptions);
    const subset = await pdfWith(asset.bytes, { ...fullOptions, subset: true });
    const [a, b] = await Promise.all([
      pixels(await renderPdfPage(complete, { scale: 2 })),
      pixels(await renderPdfPage(subset, { scale: 2 })),
    ]);
    let diff = 0;
    let ink = 0;
    for (let i = 0; i < a.length; i += 4) {
      diff += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
      if ((a[i] ?? 255) < 128) ink += 1;
    }
    expect(ink).toBeGreaterThan(1000);
    expect(diff / (a.length / 4)).toBeLessThan(0.01);
    expect(subset.length).toBeLessThan(complete.length);
  });

  it.each([
    ['subset (bundled fonts)', subsetOptions],
    ['complete (CFF uploads)', fullOptions],
  ] as const)('keeps the exact text when embedded %s', async (_label, options) => {
    const asset = await assetOf(font.id);
    const pdf = await pdfWith(asset.bytes, options);
    const text = (await extractPageText(pdf)).items.map((item) => item.text).join('');
    expect(text).toBe(SAMPLE);
    console.info(`[metrics] font ${font.id} ${_label}: ${pdf.length.toLocaleString('en')} B`);
  });
});

describe('inspectFont', () => {
  it('rejects files that are not TTF/OTF', () => {
    expect(() =>
      inspectFont({ name: 'x.woff', bytes: new TextEncoder().encode('wOFF....') }),
    ).toThrow(expect.objectContaining({ code: 'font-unsupported' }) as Error);
  });

  it('rejects broken font files', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x00, 0x00, 1, 2, 3, 4, 5, 6]);
    expect(() => inspectFont({ name: 'roto.ttf', bytes })).toThrow(
      expect.objectContaining({ code: 'font-invalid' }) as Error,
    );
  });
});
