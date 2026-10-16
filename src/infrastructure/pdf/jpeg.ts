import { AppError } from '../../domain/errors';

export interface JpegInfo {
  readonly width: number;
  readonly height: number;
  readonly components: number;
}

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/** Reads the frame header (SOFn) of a JPEG without decoding it. */
export function readJpegInfo(bytes: Uint8Array): JpegInfo {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new AppError('template-image-damaged', 'JPEG signature');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    if (SOF_MARKERS.has(marker) && offset + 9 < bytes.length) {
      const height = view.getUint16(offset + 5);
      const width = view.getUint16(offset + 7);
      const components = bytes[offset + 9] ?? 0;
      if (width === 0 || height === 0) break;
      return { width, height, components };
    }
    if (marker === 0xd9 || marker === 0xda) break;
    offset += 2 + length;
  }
  throw new AppError('template-image-damaged', 'JPEG frame header not found');
}
