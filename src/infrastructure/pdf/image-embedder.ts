import {
  PDFHexString,
  PDFRawStream,
  concatTransformationMatrix,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
  type PDFContext,
  type PDFDocument,
  type PDFPage,
  type PDFRef,
} from 'pdf-lib';
import type { Matrix } from '../../domain/geometry';
import type { EncodedPng, ImageStream } from './png';

/** An image template that can be added to any number of PDF documents. */
export interface TemplateImage {
  /** Adds the image XObject to `doc` and returns its reference (once per document). */
  embed(doc: PDFDocument): Promise<PDFRef>;
}

function colorSpaceOf(context: PDFContext, stream: ImageStream) {
  if (typeof stream.colorSpace === 'string') return stream.colorSpace;
  const { palette } = stream.colorSpace;
  const hex = Array.from(palette, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return context.obj(['Indexed', 'DeviceRGB', palette.length / 3 - 1, PDFHexString.of(hex)]);
}

function imageStream(
  context: PDFContext,
  stream: ImageStream,
  size: { width: number; height: number },
  smask?: PDFRef,
): PDFRawStream {
  const dict = context.obj({
    Type: 'XObject',
    Subtype: 'Image',
    Width: size.width,
    Height: size.height,
    ColorSpace: colorSpaceOf(context, stream),
    BitsPerComponent: stream.bitsPerComponent,
    Filter: 'FlateDecode',
    DecodeParms: {
      Predictor: 15,
      Colors: stream.colors,
      BitsPerComponent: stream.bitsPerComponent,
      Columns: size.width,
    },
    ...(smask ? { SMask: smask } : {}),
  });
  return PDFRawStream.of(dict, stream.data);
}

/** PNG whose compressed streams were computed once (see png.ts). */
export function pngTemplateImage(encoded: EncodedPng): TemplateImage {
  return {
    embed(doc) {
      const { context } = doc;
      const size = { width: encoded.width, height: encoded.height };
      const smask = encoded.alpha
        ? context.register(imageStream(context, encoded.alpha, size))
        : undefined;
      return Promise.resolve(context.register(imageStream(context, encoded.color, size, smask)));
    },
  };
}

/** JPEG bytes are embedded as they are (DCTDecode), without decoding. */
export function jpgTemplateImage(bytes: Uint8Array): TemplateImage {
  return {
    async embed(doc) {
      const image = await doc.embedJpg(bytes);
      return image.ref;
    },
  };
}

/** Draws an image XObject with an arbitrary matrix (used for EXIF orientation). */
export function drawImageWithMatrix(page: PDFPage, ref: PDFRef, matrix: Matrix): void {
  const name = page.node.newXObject('Image', ref);
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(...matrix),
    drawObject(name),
    popGraphicsState(),
  );
}
