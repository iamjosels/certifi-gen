import { createCanvas, loadImage } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { renderPdfPage } from '../../scripts/lib/pdf-node';
import { createNameField } from '../../src/domain/field';
import { A4_LONG_SIDE } from '../../src/domain/template';
import { encodePngForPdf } from '../../src/infrastructure/pdf/png';
import { templateLoader } from '../../src/infrastructure/pdf/template-loader';
import {
  blobBytes,
  loadBundledFonts,
  loadParticipants,
  loadTemplateFixture,
  runGeneration,
} from './engine-helpers';
import { readFixture } from './helpers';

describe('templateLoader', () => {
  it.each([
    ['plantilla-horizontal.pdf', 'pdf', 'landscape', 841.89, 595.28],
    ['plantilla-vertical.pdf', 'pdf', 'portrait', 595.28, 841.89],
    ['plantilla-rotada.pdf', 'pdf', 'landscape', 841.89, 595.28],
    ['plantilla-recortada.pdf', 'pdf', 'landscape', 841.89, 595.28],
  ] as const)('%s → %s %s %f × %f pt', async (file, kind, orientation, width, height) => {
    const { info } = await templateLoader.load(await readFixture(file));
    expect(info).toMatchObject({ kind, orientation });
    expect(info.page.width).toBeCloseTo(width, 1);
    expect(info.page.height).toBeCloseTo(height, 1);
  });

  it('reports the /Rotate of the original page', async () => {
    expect((await loadTemplateFixture('plantilla-rotada.pdf')).info.rotation).toBe(90);
  });

  it.each([
    ['plantilla-horizontal.png', 'png', 'landscape'],
    ['plantilla-vertical.png', 'png', 'portrait'],
    ['plantilla-horizontal.jpg', 'jpg', 'landscape'],
    ['plantilla-vertical.jpg', 'jpg', 'portrait'],
  ] as const)('%s → %s %s with the A4 long side', async (file, kind, orientation) => {
    const { info } = await templateLoader.load(await readFixture(file));
    expect(info).toMatchObject({ kind, orientation, hasTransparency: false, warnings: [] });
    expect(Math.max(info.page.width, info.page.height)).toBe(A4_LONG_SIDE);
    const ratio = (info.pixels?.width ?? 0) / (info.pixels?.height ?? 1);
    expect(info.page.width / info.page.height).toBeCloseTo(ratio, 2);
  });

  it('warns about extra pages, heavy images and EXIF rotation', async () => {
    expect((await loadTemplateFixture('plantilla-2-paginas.pdf')).info.warnings).toEqual([
      { kind: 'extra-pages', pageCount: 2 },
    ]);
    const heavy = await loadTemplateFixture('plantilla-pesada.png');
    expect(heavy.info.warnings).toEqual([{ kind: 'heavy-image', bytes: heavy.bytes.length }]);
    const exif = await loadTemplateFixture('plantilla-exif-rotada.jpg');
    expect(exif.info.warnings).toEqual([{ kind: 'exif-rotated', orientation: 6 }]);
    expect(exif.info.orientation).toBe('landscape');
  });

  it('detects real transparency', async () => {
    expect((await loadTemplateFixture('plantilla-transparente.png')).info.hasTransparency).toBe(
      true,
    );
    expect((await loadTemplateFixture('plantilla-pesada.png')).info.hasTransparency).toBe(false);
  });

  it.each([
    ['plantilla-protegida.pdf', 'template-pdf-encrypted'],
    ['plantilla-danada.pdf', 'template-pdf-damaged'],
    ['formato-no-soportado.gif', 'template-unsupported'],
    ['participantes-360.txt', 'template-unsupported'],
  ])('%s → %s', async (file, code) => {
    await expect(templateLoader.load(await readFixture(file))).rejects.toMatchObject({ code });
  });

  it('rejects truncated images', async () => {
    const png = (await readFixture('plantilla-horizontal.png')).bytes;
    await expect(
      templateLoader.load({ name: 'a.png', bytes: png.slice(0, 20) }),
    ).rejects.toMatchObject({
      code: 'template-image-damaged',
    });
    const jpg = (await readFixture('plantilla-horizontal.jpg')).bytes;
    await expect(
      templateLoader.load({ name: 'a.jpg', bytes: jpg.slice(0, 4) }),
    ).rejects.toMatchObject({
      code: 'template-image-damaged',
    });
  });
});

async function grayPixels(png: Buffer, width: number) {
  const image = await loadImage(png);
  const height = Math.round((image.height * width) / image.width);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
}

function meanDifference(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let diff = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 4)
    diff += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  return diff / (Math.min(a.length, b.length) / 4);
}

describe('every template variant renders the same upright certificate', () => {
  it.each([
    'plantilla-rotada.pdf',
    'plantilla-recortada.pdf',
    'plantilla-horizontal.png',
    'plantilla-horizontal.jpg',
    'plantilla-exif-rotada.jpg',
    'plantilla-pesada.png',
  ])('%s looks like plantilla-horizontal.pdf', async (file) => {
    const fonts = await loadBundledFonts();
    const participants = (await loadParticipants()).slice(0, 1);
    const render = async (name: string) => {
      const template = await loadTemplateFixture(name);
      const output = await runGeneration({
        template,
        participants,
        mode: 'merged',
        fonts,
        fields: [createNameField()],
      });
      return grayPixels(await renderPdfPage(await blobBytes(output.merged), { scale: 1 }), 400);
    };
    const [reference, variant] = await Promise.all([
      render('plantilla-horizontal.pdf'),
      render(file),
    ]);
    // Raster templates are resampled and the heavy one has paper grain: allow small noise.
    expect(meanDifference(reference, variant)).toBeLessThan(6);
  });
});

describe('encodePngForPdf', () => {
  it('drops the alpha channel of opaque RGBA PNGs and keeps it for transparent ones', async () => {
    const opaque = encodePngForPdf((await readFixture('plantilla-horizontal.png')).bytes);
    expect(opaque).toMatchObject({ alpha: null, hasTransparency: false, passthrough: false });
    const transparent = encodePngForPdf((await readFixture('plantilla-transparente.png')).bytes);
    expect(transparent.hasTransparency).toBe(true);
    expect(transparent.alpha).not.toBeNull();
  });

  it('passes RGB PNGs through without decoding them', () => {
    // A minimal RGB (color type 2) PNG built by hand: IHDR + one stored IDAT.
    const png = rgbPng(4, 2, [10, 20, 30]);
    const encoded = encodePngForPdf(png);
    expect(encoded).toMatchObject({ width: 4, height: 2, passthrough: true, alpha: null });
    expect(encoded.color.colorSpace).toBe('DeviceRGB');
  });
});

function crc32(bytes: Uint8Array): number {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function rgbPng(width: number, height: number, color: [number, number, number]): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const raw = new Uint8Array((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) raw.set(color, y * (width * 3 + 1) + 1 + x * 3);
  }
  // zlib "stored" block: header 78 01, one final block with the raw bytes, adler32.
  const stored = new Uint8Array(2 + 5 + raw.length + 4);
  stored.set(
    [
      0x78,
      0x01,
      0x01,
      raw.length & 0xff,
      raw.length >> 8,
      ~raw.length & 0xff,
      (~raw.length >> 8) & 0xff,
    ],
    0,
  );
  stored.set(raw, 7);
  let a = 1;
  let b = 0;
  for (const byte of raw) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  new DataView(stored.buffer).setUint32(7 + raw.length, ((b << 16) | a) >>> 0);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', stored),
    chunk('IEND', new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
