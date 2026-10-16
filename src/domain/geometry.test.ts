import { describe, expect, it } from 'vitest';
import {
  canvasToRelative,
  exifImageMatrix,
  orientedSize,
  normalizeRotation,
  pdfToRelative,
  placeText,
  placeTextOnCanvas,
  relativeToCanvas,
  relativeToPdf,
  uprightTransform,
  visibleSize,
} from './geometry';

const A4_LANDSCAPE = { width: 841.89, height: 595.28 };

describe('relativeToPdf (canvas origin top-left → PDF origin bottom-left)', () => {
  it('maps the four corners', () => {
    expect(relativeToPdf({ x: 0, y: 0 }, A4_LANDSCAPE)).toEqual({ x: 0, y: 595.28 });
    expect(relativeToPdf({ x: 1, y: 0 }, A4_LANDSCAPE)).toEqual({ x: 841.89, y: 595.28 });
    expect(relativeToPdf({ x: 0, y: 1 }, A4_LANDSCAPE)).toEqual({ x: 0, y: 0 });
    expect(relativeToPdf({ x: 1, y: 1 }, A4_LANDSCAPE)).toEqual({ x: 841.89, y: 0 });
  });

  it('maps the center and flips the vertical axis', () => {
    const center = relativeToPdf({ x: 0.5, y: 0.5 }, A4_LANDSCAPE);
    expect(center.x).toBeCloseTo(420.945);
    expect(center.y).toBeCloseTo(297.64);
    const nearTop = relativeToPdf({ x: 0.25, y: 0.1 }, { width: 100, height: 200 });
    expect(nearTop).toEqual({ x: 25, y: 180 });
  });

  it('round-trips with pdfToRelative', () => {
    for (const point of [
      { x: 0, y: 0 },
      { x: 0.33, y: 0.71 },
      { x: 1, y: 1 },
    ]) {
      const back = pdfToRelative(relativeToPdf(point, A4_LANDSCAPE), A4_LANDSCAPE);
      expect(back.x).toBeCloseTo(point.x, 10);
      expect(back.y).toBeCloseTo(point.y, 10);
    }
  });
});

describe('relativeToCanvas / canvasToRelative', () => {
  it('keeps the top-left origin and scales', () => {
    expect(relativeToCanvas({ x: 0.5, y: 0.25 }, { width: 800, height: 400 })).toEqual({
      x: 400,
      y: 100,
    });
    expect(canvasToRelative({ x: 400, y: 100 }, { width: 800, height: 400 })).toEqual({
      x: 0.5,
      y: 0.25,
    });
  });
});

describe('placeText', () => {
  const box = { x: 0.1, y: 0.5, width: 0.8 };
  const page = { width: 1000, height: 600 };

  it('centers the text horizontally and the cap height vertically', () => {
    const placement = placeText({ box, page, size: 40, textWidth: 300, align: 'center' });
    expect(placement.boxLeft).toBe(100);
    expect(placement.boxWidth).toBe(800);
    expect(placement.x).toBe(100 + (800 - 300) / 2);
    // center 300 from bottom, cap height 0.7 × 40 = 28 → baseline 14 below the center
    expect(placement.baseline).toBe(286);
  });

  it('aligns left and right inside the box', () => {
    expect(placeText({ box, page, size: 20, textWidth: 300, align: 'left' }).x).toBe(100);
    expect(placeText({ box, page, size: 20, textWidth: 300, align: 'right' }).x).toBe(600);
  });

  it('uses the font cap height when given', () => {
    const placement = placeText({
      box,
      page,
      size: 20,
      textWidth: 0,
      align: 'left',
      capHeight: 0.5,
    });
    expect(placement.baseline).toBe(295);
  });

  it('places boxes at the page edges', () => {
    const top = placeText({
      box: { x: 0, y: 0, width: 1 },
      page,
      size: 10,
      textWidth: 1000,
      align: 'center',
    });
    expect(top).toMatchObject({ x: 0, baseline: 596.5 });
    const bottom = placeText({
      box: { x: 0, y: 1, width: 1 },
      page,
      size: 10,
      textWidth: 0,
      align: 'right',
    });
    expect(bottom).toMatchObject({ x: 1000, baseline: -3.5 });
  });
});

describe('placeTextOnCanvas', () => {
  it('converts the placement to canvas pixels', () => {
    const result = placeTextOnCanvas({
      box: { x: 0.1, y: 0.5, width: 0.8 },
      canvas: { width: 500, height: 300 },
      page: { width: 1000, height: 600 },
      size: 40,
      textWidth: 300,
      align: 'center',
    });
    expect(result.scale).toBe(0.5);
    expect(result.fontSizePx).toBe(20);
    expect(result.x).toBe(175);
    // baseline 286 pt from bottom → 314 pt from top → 157 px
    expect(result.baseline).toBe(157);
  });
});

describe('rotation', () => {
  it('normalizes any multiple of 90', () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(180)).toBe(180);
    expect(normalizeRotation(89)).toBe(90);
  });

  it('swaps the visible size for 90 and 270', () => {
    const portrait = { width: 595, height: 842 };
    expect(visibleSize(portrait, 0)).toEqual(portrait);
    expect(visibleSize(portrait, 180)).toEqual(portrait);
    expect(visibleSize(portrait, 90)).toEqual({ width: 842, height: 595 });
    expect(visibleSize(portrait, 270)).toEqual({ width: 842, height: 595 });
  });

  /** Applies drawPage's transform (rotate CCW around origin, then translate). */
  function apply(t: { x: number; y: number; rotate: number }, p: { x: number; y: number }) {
    const r = (t.rotate * Math.PI) / 180;
    return {
      x: Math.round(t.x + p.x * Math.cos(r) - p.y * Math.sin(r)) + 0,
      y: Math.round(t.y + p.x * Math.sin(r) + p.y * Math.cos(r)) + 0,
    };
  }

  it('maps the original page onto the upright visible page', () => {
    const size = { width: 595, height: 842 };
    for (const rotation of [0, 90, 180, 270] as const) {
      const t = uprightTransform(size, rotation);
      const visible = visibleSize(size, rotation);
      const corners = [
        { x: 0, y: 0 },
        { x: size.width, y: 0 },
        { x: 0, y: size.height },
        { x: size.width, y: size.height },
      ].map((corner) => apply(t, corner));
      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      expect([Math.min(...xs), Math.max(...xs)]).toEqual([0, visible.width]);
      expect([Math.min(...ys), Math.max(...ys)]).toEqual([0, visible.height]);
    }
  });

  it('turns the original top-left corner the way viewers rotate clockwise', () => {
    const size = { width: 595, height: 842 };
    // /Rotate 90: the original top-left corner ends at the visible top-right corner.
    expect(apply(uprightTransform(size, 90), { x: 0, y: 842 })).toEqual({ x: 842, y: 595 });
    // /Rotate 270: the original top-left corner ends at the visible bottom-left corner.
    expect(apply(uprightTransform(size, 270), { x: 0, y: 842 })).toEqual({ x: 0, y: 0 });
    // /Rotate 180: top-left ends bottom-right.
    expect(apply(uprightTransform(size, 180), { x: 0, y: 842 })).toEqual({ x: 595, y: 0 });
  });
});

describe('EXIF orientation', () => {
  const stored = { width: 400, height: 300 };

  it('swaps the displayed size for orientations 5 to 8', () => {
    expect(orientedSize(stored, 1)).toEqual(stored);
    expect(orientedSize(stored, 3)).toEqual(stored);
    expect(orientedSize(stored, 6)).toEqual({ width: 300, height: 400 });
    expect(orientedSize(stored, 8)).toEqual({ width: 300, height: 400 });
  });

  /** Where a stored pixel (column, row from the top), normalized, ends up on the page. */
  function project(orientation: number, c: number, r: number) {
    const page = orientedSize(stored, orientation);
    const [a, b, cc, d, e, f] = exifImageMatrix(orientation, page);
    const u = c;
    const v = 1 - r;
    return { x: a * u + cc * v + e, y: b * u + d * v + f, page };
  }

  it('is the identity scale for orientation 1', () => {
    expect(exifImageMatrix(1, stored)).toEqual([400, 0, 0, 300, 0, 0]);
    expect(exifImageMatrix(0, stored)).toEqual([400, 0, 0, 300, 0, 0]);
  });

  it.each([
    // [orientation, expected page corner of the stored top-left pixel]
    [1, 'top-left'],
    [2, 'top-right'],
    [3, 'bottom-right'],
    [4, 'bottom-left'],
    [5, 'top-left'],
    [6, 'top-right'],
    [7, 'bottom-right'],
    [8, 'bottom-left'],
  ] as const)('orientation %i puts the stored top-left corner at the %s', (orientation, corner) => {
    const { x, y, page } = project(orientation, 0, 0);
    const expected = {
      'top-left': { x: 0, y: page.height },
      'top-right': { x: page.width, y: page.height },
      'bottom-right': { x: page.width, y: 0 },
      'bottom-left': { x: 0, y: 0 },
    }[corner];
    expect({ x, y }).toEqual(expected);
  });

  it('orientation 6 sends the stored top row to the right edge (rotate 90° clockwise)', () => {
    const topRight = project(6, 1, 0);
    expect(topRight).toMatchObject({ x: 300, y: 0 });
    const bottomLeft = project(6, 0, 1);
    expect(bottomLeft).toMatchObject({ x: 0, y: 400 });
  });
});
