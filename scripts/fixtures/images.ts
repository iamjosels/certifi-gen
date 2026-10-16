/**
 * Raster versions of the certificate templates (PNG / JPG), rendered from the PDF fixtures
 * with pdf.js + @napi-rs/canvas so they look exactly the same.
 */
import { createCanvas, loadImage, type Canvas } from '@napi-rs/canvas';
import { renderPdfPage } from '../lib/pdf-node';
import { createRandom } from './names';

/** 200 DPI. */
const SCALE = 200 / 72;

async function renderToCanvas(pdf: Uint8Array, scale = SCALE): Promise<Canvas> {
  const png = await renderPdfPage(pdf, { scale, format: 'png' });
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  canvas.getContext('2d').drawImage(image, 0, 0);
  return canvas;
}

export async function pngFromPdf(pdf: Uint8Array): Promise<Buffer> {
  return (await renderToCanvas(pdf)).toBuffer('image/png');
}

export async function jpgFromPdf(pdf: Uint8Array): Promise<Buffer> {
  return (await renderToCanvas(pdf)).toBuffer('image/jpeg', 90);
}

function addPaperNoise(canvas: Canvas, amplitude: number, seed: number): void {
  const context = canvas.getContext('2d');
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const random = createRandom(seed);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      const noise = Math.round((random() * 2 - 1) * amplitude);
      const value = (data[i + c] ?? 0) + noise;
      data[i + c] = value < 0 ? 0 : value > 255 ? 255 : value;
    }
  }
  context.putImageData(image, 0, 0);
}

/** Opaque PNG over 3 MB: the same certificate with a paper grain texture. */
export async function heavyPngFromPdf(pdf: Uint8Array): Promise<Buffer> {
  const canvas = await renderToCanvas(pdf);
  addPaperNoise(canvas, 5, 7);
  return canvas.toBuffer('image/png');
}

/** PNG over 1 MB with transparent rounded corners and margin. */
export async function transparentPngFromPdf(pdf: Uint8Array): Promise<Buffer> {
  const source = await renderToCanvas(pdf);
  addPaperNoise(source, 4, 11);
  const canvas = createCanvas(source.width, source.height);
  const context = canvas.getContext('2d');
  const inset = Math.round(source.width * 0.012);
  const radius = Math.round(source.width * 0.03);
  context.beginPath();
  context.roundRect(inset, inset, source.width - inset * 2, source.height - inset * 2, radius);
  context.clip();
  context.drawImage(source, 0, 0);
  return canvas.toBuffer('image/png');
}

/**
 * JPG stored rotated 90° counter-clockwise with EXIF Orientation = 6, so viewers that honor
 * EXIF show it upright (landscape).
 */
export async function exifRotatedJpgFromPdf(pdf: Uint8Array): Promise<Buffer> {
  const source = await renderToCanvas(pdf, 120 / 72);
  const canvas = createCanvas(source.height, source.width);
  const context = canvas.getContext('2d');
  context.translate(0, source.width);
  context.rotate(-Math.PI / 2);
  context.drawImage(source, 0, 0);
  const jpeg = canvas.toBuffer('image/jpeg', 88);
  return insertExifOrientation(jpeg, 6);
}

function insertExifOrientation(jpeg: Buffer, orientation: number): Buffer {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('Not a JPEG');
  const segments: number[][] = [
    [0xff, 0xe1, 0x00, 0x22], // APP1 marker, length 34
    [0x45, 0x78, 0x69, 0x66, 0x00, 0x00], // 'Exif' + 2 NUL bytes
    [0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08], // TIFF header (big endian), IFD at 8
    [0x00, 0x01], // one IFD entry
    [0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00], // Orientation
    [0x00, 0x00, 0x00, 0x00], // no next IFD
  ];
  const app1 = Buffer.from(segments.flat());
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}
