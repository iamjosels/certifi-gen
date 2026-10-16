import { describe, expect, it } from 'vitest';
import {
  A4_LONG_SIDE,
  detectTemplateKind,
  imagePageSize,
  isHeavyImage,
  orientationOf,
  readJpegOrientation,
} from './template';

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new TextEncoder().encode(text);

describe('detectTemplateKind', () => {
  it('detects PDF, PNG and JPG by signature', () => {
    expect(detectTemplateKind(ascii('%PDF-1.7\n...'))).toBe('pdf');
    expect(detectTemplateKind(ascii('\n\n  %PDF-1.4'))).toBe('pdf');
    expect(detectTemplateKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(
      'png',
    );
    expect(detectTemplateKind(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpg');
  });

  it('rejects other formats regardless of the extension', () => {
    expect(detectTemplateKind(ascii('GIF89a'))).toBeNull();
    expect(detectTemplateKind(bytes(0x89, 0x50))).toBeNull();
    expect(detectTemplateKind(new Uint8Array())).toBeNull();
  });
});

describe('orientationOf', () => {
  it('classifies landscape, portrait and square', () => {
    expect(orientationOf({ width: 842, height: 595 })).toBe('landscape');
    expect(orientationOf({ width: 595, height: 842 })).toBe('portrait');
    expect(orientationOf({ width: 500, height: 500.2 })).toBe('square');
  });
});

describe('imagePageSize', () => {
  it('keeps the aspect ratio with the A4 long side', () => {
    const landscape = imagePageSize({ width: 2339, height: 1654 });
    expect(landscape.width).toBe(A4_LONG_SIDE);
    expect(landscape.width / landscape.height).toBeCloseTo(2339 / 1654, 3);
    const portrait = imagePageSize({ width: 1080, height: 1920 });
    expect(portrait.height).toBe(A4_LONG_SIDE);
    expect(portrait.width).toBeCloseTo(473.56, 1);
  });
});

describe('isHeavyImage', () => {
  it('only applies to images over 1 MB', () => {
    expect(isHeavyImage('png', 2 * 1024 * 1024)).toBe(true);
    expect(isHeavyImage('jpg', 1024 * 1024)).toBe(false);
    expect(isHeavyImage('pdf', 9 * 1024 * 1024)).toBe(false);
  });
});

function jpegWithExif(orientation: number, littleEndian = false): Uint8Array {
  const u16 = (v: number) => (littleEndian ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) =>
    littleEndian
      ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24]
      : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
  const tiff = [
    ...(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d]),
    ...u16(0x2a),
    ...u32(8),
    ...u16(2),
    ...u16(0x010f), // Make (ignored)
    ...u16(2),
    ...u32(1),
    ...u32(0),
    ...u16(0x0112),
    ...u16(3),
    ...u32(1),
    ...u16(orientation),
    0,
    0,
    ...u32(0),
  ];
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const app0 = [0xff, 0xe0, 0x00, 0x04, 0x00, 0x00];
  return bytes(0xff, 0xd8, ...app0, 0xff, 0xe1, ...[0, app1.length + 2], ...app1, 0xff, 0xda);
}

describe('readJpegOrientation', () => {
  it('reads the EXIF orientation in both byte orders', () => {
    expect(readJpegOrientation(jpegWithExif(6))).toBe(6);
    expect(readJpegOrientation(jpegWithExif(3, true))).toBe(3);
  });

  it('returns 1 when there is no EXIF or the value is invalid', () => {
    expect(readJpegOrientation(bytes(0xff, 0xd8, 0xff, 0xda))).toBe(1);
    expect(readJpegOrientation(bytes(0x89, 0x50))).toBe(1);
    expect(readJpegOrientation(jpegWithExif(9))).toBe(1);
    expect(readJpegOrientation(bytes(0xff, 0xd8, 0x00, 0x00))).toBe(1);
    expect(readJpegOrientation(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0))).toBe(1);
  });

  it('ignores truncated or malformed EXIF blocks', () => {
    const exif = [0x45, 0x78, 0x69, 0x66, 0, 0];
    const badOrder = [...exif, 0x41, 0x41, 0, 0x2a, 0, 0, 0, 8];
    expect(
      readJpegOrientation(bytes(0xff, 0xd8, 0xff, 0xe1, 0, badOrder.length + 2, ...badOrder)),
    ).toBe(1);
    const shortTiff = [...exif, 0x4d, 0x4d];
    expect(
      readJpegOrientation(bytes(0xff, 0xd8, 0xff, 0xe1, 0, shortTiff.length + 2, ...shortTiff)),
    ).toBe(1);
    const ifdOut = [...exif, 0x4d, 0x4d, 0, 0x2a, 0, 0, 0x10, 0];
    expect(
      readJpegOrientation(bytes(0xff, 0xd8, 0xff, 0xe1, 0, ifdOut.length + 2, ...ifdOut)),
    ).toBe(1);
    const entriesOut = [...exif, 0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 5, 1, 0x12];
    expect(
      readJpegOrientation(bytes(0xff, 0xd8, 0xff, 0xe1, 0, entriesOut.length + 2, ...entriesOut)),
    ).toBe(1);
    const noOrientation = [...exif, 0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0];
    expect(
      readJpegOrientation(
        bytes(0xff, 0xd8, 0xff, 0xe1, 0, noOrientation.length + 2, ...noOrientation),
      ),
    ).toBe(1);
  });
});
