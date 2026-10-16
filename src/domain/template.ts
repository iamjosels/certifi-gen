import type { PageRotation, Size } from './geometry';

export type TemplateKind = 'pdf' | 'png' | 'jpg';
export type Orientation = 'landscape' | 'portrait' | 'square';

export type TemplateWarning =
  /** The PDF has more pages; only the first one is used. */
  | { readonly kind: 'extra-pages'; readonly pageCount: number }
  /** The image is heavy and could be converted to JPG to make the output lighter. */
  | { readonly kind: 'heavy-image'; readonly bytes: number }
  /** The JPG has an EXIF orientation that was applied to make it upright. */
  | { readonly kind: 'exif-rotated'; readonly orientation: number };

export interface TemplateInfo {
  readonly kind: TemplateKind;
  readonly fileName: string;
  /** Bytes of the template as it will be embedded. */
  readonly fileSize: number;
  /** Visible page size in PDF points (after /Rotate for PDFs). */
  readonly page: Size;
  readonly orientation: Orientation;
  /** /Rotate of the original PDF page; 0 for images. */
  readonly rotation: PageRotation;
  /** Pixel size of image templates. */
  readonly pixels?: Size;
  readonly hasTransparency?: boolean;
  readonly warnings: readonly TemplateWarning[];
}

/** Long side of an A4 page, in points. Image templates get this long side. */
export const A4_LONG_SIDE = 841.89;
export const A4_SHORT_SIDE = 595.28;

/** Images heavier than this get the "optimize" offer. */
export const HEAVY_IMAGE_BYTES = 1024 * 1024;
export const OPTIMIZED_JPEG_QUALITY = 0.85;

export function orientationOf(size: Size): Orientation {
  if (Math.abs(size.width - size.height) < 0.5) return 'square';
  return size.width > size.height ? 'landscape' : 'portrait';
}

/** PDF page for an image: same aspect ratio, long side = A4 long side. */
export function imagePageSize(pixels: Size): Size {
  const longest = Math.max(pixels.width, pixels.height);
  const scale = A4_LONG_SIDE / longest;
  return {
    width: Math.round(pixels.width * scale * 100) / 100,
    height: Math.round(pixels.height * scale * 100) / 100,
  };
}

/** Detects the template type from the file signature (the extension is not trusted). */
export function detectTemplateKind(bytes: Uint8Array): TemplateKind | null {
  const head = String.fromCharCode(...bytes.subarray(0, 1024));
  if (head.includes('%PDF-')) return 'pdf';
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, i) => bytes[i] === value)
  ) {
    return 'png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  return null;
}

export function isHeavyImage(kind: TemplateKind, bytes: number): boolean {
  return kind !== 'pdf' && bytes > HEAVY_IMAGE_BYTES;
}

/**
 * Reads the EXIF Orientation (1..8) of a JPEG, or 1 when absent.
 * Only the APP1 "Exif" segment is inspected.
 */
export function readJpegOrientation(bytes: Uint8Array): number {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  let offset = 2;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return 1;
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xda || marker === 0xd9) return 1;
    const length = view.getUint16(offset + 2);
    if (marker === 0xe1 && offset + 10 <= bytes.length) {
      const id = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (id === 'Exif') return readTiffOrientation(view, offset + 10, offset + 2 + length);
    }
    offset += 2 + length;
  }
  return 1;
}

function readTiffOrientation(view: DataView, start: number, end: number): number {
  if (start + 8 > end || end > view.byteLength) return 1;
  const order = view.getUint16(start);
  const little = order === 0x4949;
  if (!little && order !== 0x4d4d) return 1;
  const ifd = start + view.getUint32(start + 4, little);
  if (ifd + 2 > end) return 1;
  const entries = view.getUint16(ifd, little);
  for (let i = 0; i < entries; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > end) return 1;
    if (view.getUint16(entry, little) === 0x0112) {
      const value = view.getUint16(entry + 8, little);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}
