import { EncryptedPDFError, PDFDocument } from 'pdf-lib';
import type { LoadedTemplate, SourceFile, TemplateLoader } from '../../application/ports';
import { AppError, isAppError } from '../../domain/errors';
import { normalizeRotation, orientedSize, visibleSize } from '../../domain/geometry';
import {
  imagePageSize,
  isHeavyImage,
  orientationOf,
  readJpegOrientation,
  detectTemplateKind,
  type TemplateInfo,
  type TemplateWarning,
} from '../../domain/template';
import { readJpegInfo } from './jpeg';
import { encodePngForPdf, hasPngChunk, readPngHeader } from './png';

export async function openTemplatePdf(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { throwOnInvalidObject: true, updateMetadata: false });
  } catch (error) {
    if (
      error instanceof EncryptedPDFError ||
      (error instanceof Error && error.message.includes('is encrypted'))
    ) {
      throw new AppError('template-pdf-encrypted', undefined, { cause: error });
    }
    throw new AppError('template-pdf-damaged', undefined, { cause: error });
  }
}

async function loadPdf(file: SourceFile): Promise<TemplateInfo> {
  const doc = await openTemplatePdf(file.bytes);
  const pageCount = doc.getPageCount();
  if (pageCount === 0) throw new AppError('template-pdf-empty');
  const page = doc.getPage(0);
  try {
    // Fails early on pages whose content cannot be embedded (broken content streams).
    const probe = await PDFDocument.create();
    await probe.embedPage(page);
  } catch (error) {
    throw new AppError('template-pdf-damaged', 'first page', { cause: error });
  }
  const crop = page.getCropBox();
  const rotation = normalizeRotation(page.getRotation().angle);
  const size = visibleSize({ width: crop.width, height: crop.height }, rotation);
  const warnings: TemplateWarning[] = [];
  if (pageCount > 1) warnings.push({ kind: 'extra-pages', pageCount });
  return {
    kind: 'pdf',
    fileName: file.name,
    fileSize: file.bytes.length,
    page: size,
    orientation: orientationOf(size),
    rotation,
    warnings,
  };
}

function loadPng(file: SourceFile): TemplateInfo {
  const header = readPngHeader(file.bytes);
  const hasAlphaChannel = header.colorType === 4 || header.colorType === 6;
  // Decoding is only needed to know whether the alpha channel is really used.
  const hasTransparency = hasAlphaChannel
    ? encodePngForPdf(file.bytes).hasTransparency
    : hasPngChunk(file.bytes, 'tRNS');
  const pixels = { width: header.width, height: header.height };
  const page = imagePageSize(pixels);
  const warnings: TemplateWarning[] = [];
  if (isHeavyImage('png', file.bytes.length)) {
    warnings.push({ kind: 'heavy-image', bytes: file.bytes.length });
  }
  return {
    kind: 'png',
    fileName: file.name,
    fileSize: file.bytes.length,
    page,
    orientation: orientationOf(page),
    rotation: 0,
    pixels,
    hasTransparency,
    warnings,
  };
}

function loadJpg(file: SourceFile): TemplateInfo {
  const info = readJpegInfo(file.bytes);
  const orientation = readJpegOrientation(file.bytes);
  const pixels = orientedSize({ width: info.width, height: info.height }, orientation);
  const page = imagePageSize(pixels);
  const warnings: TemplateWarning[] = [];
  if (orientation !== 1) warnings.push({ kind: 'exif-rotated', orientation });
  if (isHeavyImage('jpg', file.bytes.length)) {
    warnings.push({ kind: 'heavy-image', bytes: file.bytes.length });
  }
  return {
    kind: 'jpg',
    fileName: file.name,
    fileSize: file.bytes.length,
    page,
    orientation: orientationOf(page),
    rotation: 0,
    pixels,
    hasTransparency: false,
    warnings,
  };
}

/** Reads PDF, PNG and JPG templates (by signature, never by extension). */
export const templateLoader: TemplateLoader = {
  async load(file: SourceFile): Promise<LoadedTemplate> {
    const kind = detectTemplateKind(file.bytes);
    try {
      switch (kind) {
        case 'pdf':
          return { info: await loadPdf(file), bytes: file.bytes };
        case 'png':
          return { info: loadPng(file), bytes: file.bytes };
        case 'jpg':
          return { info: loadJpg(file), bytes: file.bytes };
        case null:
          throw new AppError('template-unsupported', file.name);
      }
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new AppError(
        kind === 'pdf' ? 'template-pdf-damaged' : 'template-image-damaged',
        file.name,
        {
          cause: error,
        },
      );
    }
  },
};
