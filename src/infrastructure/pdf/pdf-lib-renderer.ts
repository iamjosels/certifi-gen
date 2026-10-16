import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type {
  CertificateRenderer,
  FieldMeasure,
  FontAsset,
  LoadedTemplate,
  MergedDocumentBuilder,
  RenderSession,
  RenderSetup,
  TextMeasurer,
} from '../../application/ports';
import { AppError } from '../../domain/errors';
import { resolveFieldText, type FieldConfig } from '../../domain/field';
import {
  exifImageMatrix,
  placeText,
  uprightTransform,
  type Matrix,
  type Size,
} from '../../domain/geometry';
import type { Participant } from '../../domain/participant';
import { readJpegOrientation } from '../../domain/template';
import { fitText } from '../../domain/text-fit';
import { capHeightRatio, missingChars, openFont } from '../fonts/font-tools';
import { drawImageWithMatrix, jpgTemplateImage, pngTemplateImage } from './image-embedder';
import { encodePngForPdf, type EncodedPng } from './png';
import { openTemplatePdf } from './template-loader';

/** Draws the template on a page of a given document (embedding happens once per document). */
type TemplateDrawer = (page: PDFPage) => void;

interface TemplateEmbedding {
  readonly page: Size;
  embed(doc: PDFDocument): Promise<TemplateDrawer>;
}

/** Fingerprint of a byte array (length + sampled FNV-1a), to cache expensive PNG encodings. */
function fingerprint(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  const step = Math.max(1, Math.floor(bytes.length / 8192));
  for (let i = 0; i < bytes.length; i += step) {
    hash = Math.imul(hash ^ (bytes[i] ?? 0), 0x01000193) >>> 0;
  }
  return `${bytes.length.toString(36)}-${hash.toString(36)}`;
}

const pngCache = new Map<string, EncodedPng>();

function encodedPng(bytes: Uint8Array): EncodedPng {
  const key = fingerprint(bytes);
  let encoded = pngCache.get(key);
  if (!encoded) {
    encoded = encodePngForPdf(bytes);
    if (pngCache.size >= 2) pngCache.clear();
    pngCache.set(key, encoded);
  }
  return encoded;
}

async function prepareTemplate(template: LoadedTemplate): Promise<TemplateEmbedding> {
  const { info, bytes } = template;
  const page = info.page;
  if (info.kind === 'pdf') {
    const source = await openTemplatePdf(bytes);
    const sourcePage = source.getPage(0);
    const crop = sourcePage.getCropBox();
    const transform = uprightTransform({ width: crop.width, height: crop.height }, info.rotation);
    return {
      page,
      async embed(doc) {
        const embedded = await doc.embedPage(sourcePage, {
          left: crop.x,
          bottom: crop.y,
          right: crop.x + crop.width,
          top: crop.y + crop.height,
        });
        return (target) => {
          target.drawPage(embedded, {
            x: transform.x,
            y: transform.y,
            rotate: degrees(transform.rotate),
          });
        };
      },
    };
  }
  let image;
  let matrix: Matrix;
  if (info.kind === 'png') {
    image = pngTemplateImage(encodedPng(bytes));
    matrix = [page.width, 0, 0, page.height, 0, 0];
  } else {
    image = jpgTemplateImage(bytes);
    matrix = exifImageMatrix(readJpegOrientation(bytes), page);
  }
  return {
    page,
    async embed(doc) {
      const ref = await image.embed(doc);
      return (target) => {
        drawImageWithMatrix(target, ref, matrix);
      };
    },
  };
}

function hexToRgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return rgb(((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255);
}

interface PreparedFont {
  readonly asset: FontAsset;
  readonly capHeight: number;
  readonly measureFont: PDFFont;
  readonly glyphs: ReturnType<typeof openFont>;
}

function setMetadata(doc: PDFDocument, title: string): void {
  const now = new Date();
  doc.setTitle(title, { showInWindowTitleBar: true });
  doc.setCreator('Certifica');
  doc.setProducer('Certifica (pdf-lib)');
  doc.setLanguage('es');
  doc.setCreationDate(now);
  doc.setModificationDate(now);
}

function documentTitle(participant: Participant): string {
  return `Certificado - ${participant.name}`;
}

/**
 * pdf-lib's full (non-subset) embedding writes widths only for glyphs reachable from the cmap,
 * so glyphs produced by contextual alternates or ligatures (Great Vibes, "fl" in DM Serif) get
 * a wrong advance and the text looks badly spaced. Fonts embedded complete (CFF fonts uploaded
 * by the user) therefore disable glyph substitutions; subset fonts keep them.
 */
const NO_SUBSTITUTIONS = {
  liga: false,
  clig: false,
  calt: false,
  dlig: false,
  rlig: false,
  rclt: false,
  ccmp: false,
};

export function embedOptions(asset: FontAsset) {
  return asset.subset ? { subset: true } : { subset: false, features: NO_SUBSTITUTIONS };
}

/** Parses each font used by the fields once (fontkit + a scratch document for measuring). */
async function prepareFonts(assets: readonly FontAsset[], fields: readonly FieldConfig[]) {
  const usedFontIds = new Set(fields.map((field) => field.fontId));
  const measureDoc = await PDFDocument.create();
  measureDoc.registerFontkit(fontkit);
  const fonts = new Map<string, PreparedFont>();
  for (const asset of assets) {
    if (!usedFontIds.has(asset.id) || fonts.has(asset.id)) continue;
    const glyphs = openFont(asset.bytes);
    const measureFont = await measureDoc.embedFont(asset.bytes, embedOptions(asset));
    fonts.set(asset.id, { asset, glyphs, measureFont, capHeight: capHeightRatio(glyphs) });
  }
  for (const id of usedFontIds) {
    if (!fonts.has(id)) throw new AppError('font-invalid', `font ${id} not provided`);
  }
  const fontFor = (field: FieldConfig): PreparedFont => {
    const font = fonts.get(field.fontId);
    if (!font) throw new AppError('font-invalid', field.fontId);
    return font;
  };
  const measure = (field: FieldConfig, texts: readonly string[]): FieldMeasure => {
    const font = fontFor(field);
    return {
      unitWidths: texts.map((text) => font.measureFont.widthOfTextAtSize(text, 1)),
      missingChars: texts.map((text) => missingChars(font.glyphs, text)),
      capHeight: font.capHeight,
    };
  };
  return { fonts, fontFor, measure };
}

export const pdfLibRenderer: CertificateRenderer = {
  async prepare(setup: RenderSetup): Promise<RenderSession> {
    const template = await prepareTemplate(setup.template);
    const fields = setup.fields;
    const { fonts, fontFor, measure } = await prepareFonts(setup.fonts, fields);

    async function embedFonts(doc: PDFDocument): Promise<Map<string, PDFFont>> {
      doc.registerFontkit(fontkit);
      const embedded = new Map<string, PDFFont>();
      for (const [id, font] of fonts) {
        embedded.set(id, await doc.embedFont(font.asset.bytes, embedOptions(font.asset)));
      }
      return embedded;
    }

    function drawFields(
      page: PDFPage,
      embedded: ReadonlyMap<string, PDFFont>,
      participant: Participant,
    ): string[] {
      const overflow: string[] = [];
      for (const field of fields) {
        const text = resolveFieldText(field, participant);
        if (text.length === 0) continue;
        const font = embedded.get(field.fontId);
        if (!font) throw new AppError('font-invalid', field.fontId);
        const fit = fitText(
          text,
          (value, size) => font.widthOfTextAtSize(value, size),
          field.box.width * template.page.width,
          field.maxSize,
          field.minSize,
        );
        const placement = placeText({
          box: field.box,
          page: template.page,
          size: fit.size,
          textWidth: fit.width,
          align: field.align,
          capHeight: fontFor(field).capHeight,
        });
        page.drawText(text, {
          x: placement.x,
          y: placement.baseline,
          size: fit.size,
          font,
          color: hexToRgb(field.color),
        });
        if (fit.overflow) overflow.push(field.label);
      }
      return overflow;
    }

    const pageSize: [number, number] = [template.page.width, template.page.height];

    return {
      async renderDocument(participant) {
        const doc = await PDFDocument.create({ updateMetadata: false });
        setMetadata(doc, documentTitle(participant));
        const drawTemplate = await template.embed(doc);
        const embedded = await embedFonts(doc);
        const page = doc.addPage(pageSize);
        drawTemplate(page);
        const overflowFields = drawFields(page, embedded, participant);
        const bytes = await doc.save({ objectsPerTick: Number.POSITIVE_INFINITY });
        return { bytes, overflowFields };
      },

      async createMergedDocument(): Promise<MergedDocumentBuilder> {
        const doc = await PDFDocument.create({ updateMetadata: false });
        setMetadata(doc, 'Certificados');
        const drawTemplate = await template.embed(doc);
        const embedded = await embedFonts(doc);
        return {
          addPage(participant) {
            const page = doc.addPage(pageSize);
            drawTemplate(page);
            return { overflowFields: drawFields(page, embedded, participant) };
          },
          save() {
            return doc.save({ objectsPerTick: Number.POSITIVE_INFINITY });
          },
        };
      },

      measure,
    };
  },

  async prepareMeasurer(fonts, fields): Promise<TextMeasurer> {
    const { measure } = await prepareFonts(fonts, fields);
    return { measure };
  },
};
