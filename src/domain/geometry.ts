import type { FieldBox, TextAlign } from './field';

/**
 * Coordinate systems:
 * - Relative: 0..1 of the page, origin top-left (what the canvas and the config use).
 * - PDF: points, origin bottom-left (what pdf-lib uses).
 */
export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export function relativeToPdf(point: Point, page: Size): Point {
  return { x: point.x * page.width, y: (1 - point.y) * page.height };
}

export function pdfToRelative(point: Point, page: Size): Point {
  return { x: point.x / page.width, y: 1 - point.y / page.height };
}

/** Relative point → pixels of a canvas of the given size (both origins are top-left). */
export function relativeToCanvas(point: Point, canvas: Size): Point {
  return { x: point.x * canvas.width, y: point.y * canvas.height };
}

export function canvasToRelative(point: Point, canvas: Size): Point {
  return { x: point.x / canvas.width, y: point.y / canvas.height };
}

/** Cap height as a fraction of the font size, used to center text vertically. */
export const DEFAULT_CAP_HEIGHT = 0.7;

export interface TextPlacement {
  /** Left of the text run, in PDF points. */
  readonly x: number;
  /** Baseline, in PDF points from the bottom. */
  readonly baseline: number;
  /** Box in PDF points (bottom-left origin). */
  readonly boxLeft: number;
  readonly boxWidth: number;
}

/**
 * Where to draw a text run of `textWidth` points at `size` points inside `box`, so that its
 * capital letters are vertically centered on `box.y` and it is aligned inside the box width.
 */
export function placeText(params: {
  box: FieldBox;
  page: Size;
  size: number;
  textWidth: number;
  align: TextAlign;
  capHeight?: number;
}): TextPlacement {
  const { box, page, size, textWidth, align, capHeight = DEFAULT_CAP_HEIGHT } = params;
  const boxLeft = box.x * page.width;
  const boxWidth = box.width * page.width;
  const centerY = (1 - box.y) * page.height;
  let x = boxLeft;
  if (align === 'center') x = boxLeft + (boxWidth - textWidth) / 2;
  else if (align === 'right') x = boxLeft + boxWidth - textWidth;
  return { x, baseline: centerY - (capHeight * size) / 2, boxLeft, boxWidth };
}

/** Same placement as `placeText`, but in canvas pixels (top-left origin) for the overlay. */
export function placeTextOnCanvas(params: {
  box: FieldBox;
  canvas: Size;
  page: Size;
  size: number;
  textWidth: number;
  align: TextAlign;
  capHeight?: number;
}): { x: number; baseline: number; fontSizePx: number; scale: number } {
  const { canvas, page } = params;
  const placement = placeText(params);
  const scale = canvas.width / page.width;
  return {
    x: placement.x * scale,
    baseline: (page.height - placement.baseline) * scale,
    fontSizePx: params.size * scale,
    scale,
  };
}

export type PageRotation = 0 | 90 | 180 | 270;

export function normalizeRotation(degrees: number): PageRotation {
  const value = (((Math.round(degrees / 90) * 90) % 360) + 360) % 360;
  return value as PageRotation;
}

/** Size seen by the user once the page /Rotate is applied. */
export function visibleSize(size: Size, rotation: PageRotation): Size {
  return rotation === 90 || rotation === 270
    ? { width: size.height, height: size.width }
    : { width: size.width, height: size.height };
}

/**
 * How to draw an embedded page (of unrotated size `size`) on a new upright page of
 * `visibleSize(size, rotation)` so it looks like viewers show the rotated original.
 * `rotate` is counter-clockwise degrees around (x, y), as in pdf-lib's drawPage.
 */
export function uprightTransform(
  size: Size,
  rotation: PageRotation,
): { x: number; y: number; rotate: number } {
  switch (rotation) {
    case 0:
      return { x: 0, y: 0, rotate: 0 };
    case 90:
      return { x: 0, y: size.width, rotate: -90 };
    case 180:
      return { x: size.width, y: size.height, rotate: 180 };
    case 270:
      return { x: size.height, y: 0, rotate: 90 };
  }
}
