/**
 * Certificate template fixtures drawn with pdf-lib and the bundled OFL fonts.
 * The name area is intentionally left blank, vertically centered at 50% of the page height,
 * which matches the default "Nombre" field of the app.
 */
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const A4 = { width: 841.89, height: 595.28 } as const;

const NAVY = rgb(0.122, 0.165, 0.267);
const GOLD = rgb(0.722, 0.569, 0.227);
const INK = rgb(0.29, 0.31, 0.36);
const PAPER = rgb(0.984, 0.973, 0.945);

interface Fonts {
  title: PDFFont;
  body: PDFFont;
}

async function loadFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const [titleBytes, bodyBytes] = await Promise.all([
    readFile(join(ROOT, 'public/fonts/dm-serif-display/DMSerifDisplay-Regular.ttf')),
    readFile(join(ROOT, 'public/fonts/poppins/Poppins-Medium.ttf')),
  ]);
  return {
    title: await doc.embedFont(titleBytes, { subset: true }),
    body: await doc.embedFont(bodyBytes, { subset: true }),
  };
}

function centered(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  yFromTop: number,
  color = INK,
  letterSpacing = 0,
): void {
  const { width, height } = page.getSize();
  if (letterSpacing === 0) {
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: (width - textWidth) / 2,
      y: height * (1 - yFromTop),
      size,
      font,
      color,
    });
    return;
  }
  const chars = Array.from(text);
  const total =
    chars.reduce((sum, ch) => sum + font.widthOfTextAtSize(ch, size), 0) +
    letterSpacing * (chars.length - 1);
  let x = (width - total) / 2;
  for (const ch of chars) {
    page.drawText(ch, { x, y: height * (1 - yFromTop), size, font, color });
    x += font.widthOfTextAtSize(ch, size) + letterSpacing;
  }
}

interface Layout {
  title: number;
  subtitle: number;
  intro: number;
  nameLine: number;
  course1: number;
  course2: number;
  signatures: number;
  titleSize: number;
}

const LANDSCAPE_LAYOUT: Layout = {
  title: 0.215,
  subtitle: 0.285,
  intro: 0.39,
  nameLine: 0.57,
  course1: 0.645,
  course2: 0.71,
  signatures: 0.83,
  titleSize: 50,
};

const PORTRAIT_LAYOUT: Layout = {
  title: 0.2,
  subtitle: 0.245,
  intro: 0.4,
  nameLine: 0.555,
  course1: 0.62,
  course2: 0.665,
  signatures: 0.82,
  titleSize: 44,
};

function drawCertificate(page: PDFPage, fonts: Fonts, layout: Layout): void {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width, height, color: PAPER });
  page.drawRectangle({
    x: 22,
    y: 22,
    width: width - 44,
    height: height - 44,
    borderColor: NAVY,
    borderWidth: 3,
  });
  page.drawRectangle({
    x: 32,
    y: 32,
    width: width - 64,
    height: height - 64,
    borderColor: GOLD,
    borderWidth: 1.2,
  });
  for (const [cx, cy] of [
    [32, 32],
    [width - 32, 32],
    [32, height - 32],
    [width - 32, height - 32],
  ] as const) {
    page.drawSquare({
      x: cx,
      y: cy - 6,
      size: 8.5,
      rotate: degrees(45),
      color: GOLD,
    });
  }

  centered(page, 'CERTIFICADO', fonts.title, layout.titleSize, layout.title, NAVY);
  centered(page, 'DE PARTICIPACIÓN', fonts.body, 13, layout.subtitle, GOLD, 4);
  centered(page, 'Se otorga el presente certificado a', fonts.body, 12, layout.intro, INK);

  const lineY = height * (1 - layout.nameLine);
  page.drawLine({
    start: { x: width * 0.2, y: lineY },
    end: { x: width * 0.8, y: lineY },
    thickness: 0.8,
    color: GOLD,
  });

  centered(
    page,
    'por haber completado satisfactoriamente el curso',
    fonts.body,
    11.5,
    layout.course1,
    INK,
  );
  centered(page, 'Gestión de Proyectos Ágiles', fonts.title, 19, layout.course2, NAVY);

  const sigY = height * (1 - layout.signatures);
  for (const [from, to, label] of [
    [0.16, 0.38, 'Directora Académica'],
    [0.62, 0.84, 'Coordinador del Programa'],
  ] as const) {
    page.drawLine({
      start: { x: width * from, y: sigY },
      end: { x: width * to, y: sigY },
      thickness: 0.7,
      color: INK,
    });
    const labelWidth = fonts.body.widthOfTextAtSize(label, 9.5);
    page.drawText(label, {
      x: width * ((from + to) / 2) - labelWidth / 2,
      y: sigY - 15,
      size: 9.5,
      font: fonts.body,
      color: INK,
    });
  }
  page.drawCircle({ x: width / 2, y: sigY + 4, size: 24, borderColor: GOLD, borderWidth: 1.5 });
  const seal = '2026';
  page.drawText(seal, {
    x: width / 2 - fonts.title.widthOfTextAtSize(seal, 13) / 2,
    y: sigY,
    size: 13,
    font: fonts.title,
    color: GOLD,
  });
}

async function createCertificateDoc(orientation: 'landscape' | 'portrait'): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  doc.setTitle('Plantilla de certificado');
  doc.setCreator('certifi-gen fixtures');
  doc.setProducer('pdf-lib');
  doc.setCreationDate(new Date('2026-01-01T00:00:00Z'));
  doc.setModificationDate(new Date('2026-01-01T00:00:00Z'));
  const fonts = await loadFonts(doc);
  const size: [number, number] =
    orientation === 'landscape' ? [A4.width, A4.height] : [A4.height, A4.width];
  const page = doc.addPage(size);
  drawCertificate(page, fonts, orientation === 'landscape' ? LANDSCAPE_LAYOUT : PORTRAIT_LAYOUT);
  return doc;
}

export async function landscapeTemplate(): Promise<Uint8Array> {
  return (await createCertificateDoc('landscape')).save();
}

export async function portraitTemplate(): Promise<Uint8Array> {
  return (await createCertificateDoc('portrait')).save();
}

/** Landscape template with a second page, to test the "only the first page is used" warning. */
export async function twoPageTemplate(): Promise<Uint8Array> {
  const doc = await createCertificateDoc('landscape');
  const fonts = await loadFonts(doc);
  const extra = doc.addPage([A4.width, A4.height]);
  centered(extra, 'Página de reverso', fonts.title, 30, 0.5, NAVY);
  return doc.save();
}

/**
 * Portrait MediaBox with /Rotate 90 whose content is drawn rotated, so viewers show an upright
 * landscape certificate.
 */
export async function rotatedTemplate(): Promise<Uint8Array> {
  const source = await PDFDocument.load(await landscapeTemplate());
  const doc = await PDFDocument.create();
  const [embedded] = await doc.embedPdf(source, [0]);
  if (!embedded) throw new Error('embed failed');
  const page = doc.addPage([A4.height, A4.width]);
  page.drawPage(embedded, { x: A4.height, y: 0, rotate: degrees(90) });
  page.setRotation(degrees(90));
  return doc.save();
}

/** MediaBox with 36 pt of bleed and crop marks; the CropBox is the real A4 certificate. */
export async function croppedTemplate(): Promise<Uint8Array> {
  const bleed = 36;
  const source = await PDFDocument.load(await landscapeTemplate());
  const doc = await PDFDocument.create();
  const [embedded] = await doc.embedPdf(source, [0]);
  if (!embedded) throw new Error('embed failed');
  const page = doc.addPage([A4.width + bleed * 2, A4.height + bleed * 2]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: A4.width + bleed * 2,
    height: A4.height + bleed * 2,
    color: rgb(0.85, 0.2, 0.2),
  });
  page.drawPage(embedded, { x: bleed, y: bleed });
  page.setCropBox(bleed, bleed, A4.width, A4.height);
  return doc.save();
}

/**
 * A PDF whose trailer declares an /Encrypt dictionary (standard security handler).
 * pdf-lib refuses to edit it, exactly like a real password-protected file.
 */
export async function encryptedTemplate(): Promise<Uint8Array> {
  const doc = await createCertificateDoc('landscape');
  const encrypt = doc.context.obj({
    Filter: PDFName.of('Standard'),
    V: PDFNumber.of(1),
    R: PDFNumber.of(2),
    Length: PDFNumber.of(40),
    O: PDFHexString.of('7a'.repeat(32)),
    U: PDFHexString.of('3c'.repeat(32)),
    P: PDFNumber.of(-3904),
  });
  doc.context.trailerInfo.Encrypt = doc.context.register(encrypt);
  return doc.save({ useObjectStreams: false });
}

/** Header of a PDF followed by garbage and a truncated body. */
export function damagedTemplate(valid: Uint8Array): Uint8Array {
  const head = new TextEncoder().encode('%PDF-1.7\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R');
  const body = valid.slice(Math.floor(valid.length * 0.35), Math.floor(valid.length * 0.55));
  const out = new Uint8Array(head.length + body.length);
  out.set(head, 0);
  out.set(body.reverse(), head.length);
  return out;
}
