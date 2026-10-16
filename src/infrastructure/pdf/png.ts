/**
 * PNG → PDF image streams, computed once per template and reused by every certificate.
 *
 * pdf-lib's embedPng decodes the PNG and re-compresses raw pixels without PNG filters, which
 * makes images 1.5–3× bigger and costs ~0.3 s per document. Here:
 * - 8-bit gray/RGB/palette PNGs without transparency are passed through: the IDAT zlib stream
 *   is exactly a PDF FlateDecode stream with PNG predictors.
 * - Anything else is decoded once, the alpha channel is dropped when fully opaque (or moved to
 *   an SMask), and rows are re-filtered and compressed at the maximum level.
 */
import * as upngNamespace from '@pdf-lib/upng';
import { zlibSync } from 'fflate';
import { AppError } from '../../domain/errors';

type UpngApi = typeof upngNamespace;

/**
 * The package's types declare named exports, but the ESM build only has a default export and
 * the CJS build (loaded by plain Node) nests it once more: unwrap until `decode` is found.
 */
function resolveUpng(candidate: unknown): UpngApi {
  let current = candidate as { decode?: unknown; default?: unknown } | undefined;
  for (let depth = 0; depth < 3 && current; depth += 1) {
    if (typeof current.decode === 'function') return current as UpngApi;
    current = current.default as typeof current;
  }
  throw new Error('UPNG could not be loaded');
}

const UPNG = resolveUpng(upngNamespace);

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface PngHeader {
  readonly width: number;
  readonly height: number;
  readonly bitDepth: number;
  /** 0 gray, 2 RGB, 3 palette, 4 gray+alpha, 6 RGBA */
  readonly colorType: number;
  readonly interlaced: boolean;
}

interface Chunk {
  readonly type: string;
  readonly data: Uint8Array;
}

function damaged(detail: string): AppError {
  return new AppError('template-image-damaged', detail);
}

function* readChunks(bytes: Uint8Array): Generator<Chunk> {
  if (!SIGNATURE.every((value, index) => bytes[index] === value)) throw damaged('PNG signature');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const start = offset + 8;
    if (start + length > bytes.length) throw damaged(`truncated ${type} chunk`);
    yield { type, data: bytes.subarray(start, start + length) };
    if (type === 'IEND') return;
    offset = start + length + 4;
  }
}

export function readPngHeader(bytes: Uint8Array): PngHeader {
  for (const chunk of readChunks(bytes)) {
    if (chunk.type !== 'IHDR' || chunk.data.length < 13) break;
    const view = new DataView(chunk.data.buffer, chunk.data.byteOffset, chunk.data.byteLength);
    const header = {
      width: view.getUint32(0),
      height: view.getUint32(4),
      bitDepth: chunk.data[8] ?? 0,
      colorType: chunk.data[9] ?? 0,
      interlaced: chunk.data[12] === 1,
    };
    if (header.width === 0 || header.height === 0) throw damaged('empty image');
    return header;
  }
  throw damaged('missing IHDR');
}

export interface ImageStream {
  readonly data: Uint8Array;
  /** 'DeviceRGB' | 'DeviceGray' or an Indexed palette. */
  readonly colorSpace: 'DeviceRGB' | 'DeviceGray' | { readonly palette: Uint8Array };
  readonly bitsPerComponent: number;
  /** Components per pixel in the stream (for the PNG predictor). */
  readonly colors: number;
}

export interface EncodedPng {
  readonly width: number;
  readonly height: number;
  readonly color: ImageStream;
  readonly alpha: ImageStream | null;
  /** True when at least one pixel is not fully opaque. */
  readonly hasTransparency: boolean;
  /** True when the IDAT data was reused as-is. */
  readonly passthrough: boolean;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function tryPassthrough(bytes: Uint8Array, header: PngHeader): EncodedPng | null {
  if (header.interlaced || header.bitDepth !== 8) return null;
  if (header.colorType !== 0 && header.colorType !== 2 && header.colorType !== 3) return null;
  const idat: Uint8Array[] = [];
  let palette: Uint8Array | null = null;
  for (const chunk of readChunks(bytes)) {
    if (chunk.type === 'tRNS') return null;
    if (chunk.type === 'PLTE') palette = chunk.data;
    if (chunk.type === 'IDAT') idat.push(chunk.data);
  }
  if (idat.length === 0) throw damaged('missing IDAT');
  let colorSpace: ImageStream['colorSpace'];
  let colors: number;
  if (header.colorType === 3) {
    if (!palette) throw damaged('missing PLTE');
    colorSpace = { palette };
    colors = 1;
  } else {
    colorSpace = header.colorType === 2 ? 'DeviceRGB' : 'DeviceGray';
    colors = header.colorType === 2 ? 3 : 1;
  }
  return {
    width: header.width,
    height: header.height,
    color: { data: concat(idat), colorSpace, bitsPerComponent: 8, colors },
    alpha: null,
    hasTransparency: false,
    passthrough: true,
  };
}

/** Applies the PNG filter that minimizes the sum of absolute values for each row. */
export function filterRows(
  raw: Uint8Array,
  width: number,
  height: number,
  bpp: number,
): Uint8Array {
  const stride = width * bpp;
  const out = new Uint8Array((stride + 1) * height);
  const candidate = new Uint8Array(stride);
  const best = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const row = raw.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? raw.subarray((y - 1) * stride, y * stride) : null;
    let bestType = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let type = 0; type <= 4; type += 1) {
      let score = 0;
      for (let x = 0; x < stride; x += 1) {
        const value = row[x] ?? 0;
        const left = x >= bpp ? (row[x - bpp] ?? 0) : 0;
        const up = prev ? (prev[x] ?? 0) : 0;
        const upLeft = prev && x >= bpp ? (prev[x - bpp] ?? 0) : 0;
        let predicted = 0;
        if (type === 1) predicted = left;
        else if (type === 2) predicted = up;
        else if (type === 3) predicted = (left + up) >> 1;
        else if (type === 4) {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        }
        const filtered = (value - predicted) & 0xff;
        candidate[x] = filtered;
        score += filtered < 128 ? filtered : 256 - filtered;
      }
      if (score < bestScore) {
        bestScore = score;
        bestType = type;
        best.set(candidate);
      }
    }
    const offset = y * (stride + 1);
    out[offset] = bestType;
    out.set(best, offset + 1);
  }
  return out;
}

function reencode(bytes: Uint8Array): EncodedPng {
  let rgba: Uint8Array;
  let width: number;
  let height: number;
  try {
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const image = UPNG.decode(copy as ArrayBuffer);
    const frame = UPNG.toRGBA8(image)[0];
    if (!frame) throw new Error('no frame');
    rgba = new Uint8Array(frame);
    width = image.width;
    height = image.height;
  } catch (error) {
    throw new AppError('template-image-damaged', 'PNG decode', { cause: error });
  }
  const pixels = width * height;
  let opaque = true;
  let gray = true;
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 4;
    if (rgba[o + 3] !== 255) opaque = false;
    if (gray && (rgba[o] !== rgba[o + 1] || rgba[o] !== rgba[o + 2])) gray = false;
    if (!opaque && !gray) break;
  }
  const colors = gray ? 1 : 3;
  const color = new Uint8Array(pixels * colors);
  const alpha = opaque ? null : new Uint8Array(pixels);
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 4;
    if (gray) color[i] = rgba[o] ?? 0;
    else {
      color[i * 3] = rgba[o] ?? 0;
      color[i * 3 + 1] = rgba[o + 1] ?? 0;
      color[i * 3 + 2] = rgba[o + 2] ?? 0;
    }
    if (alpha) alpha[i] = rgba[o + 3] ?? 0;
  }
  const compress = (data: Uint8Array, bpp: number) =>
    zlibSync(filterRows(data, width, height, bpp), { level: 9 });
  return {
    width,
    height,
    color: {
      data: compress(color, colors),
      colorSpace: gray ? 'DeviceGray' : 'DeviceRGB',
      bitsPerComponent: 8,
      colors,
    },
    alpha: alpha
      ? { data: compress(alpha, 1), colorSpace: 'DeviceGray', bitsPerComponent: 8, colors: 1 }
      : null,
    hasTransparency: !opaque,
    passthrough: false,
  };
}

export function encodePngForPdf(bytes: Uint8Array): EncodedPng {
  const header = readPngHeader(bytes);
  return tryPassthrough(bytes, header) ?? reencode(bytes);
}

/** True when the PNG contains a chunk of the given type (e.g. tRNS). */
export function hasPngChunk(bytes: Uint8Array, type: string): boolean {
  for (const chunk of readChunks(bytes)) {
    if (chunk.type === type) return true;
  }
  return false;
}
