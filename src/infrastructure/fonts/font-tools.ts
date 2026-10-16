import fontkit from '@pdf-lib/fontkit';
import type { FontInfo, SourceFile } from '../../application/ports';
import { AppError } from '../../domain/errors';
import { SPANISH_CHARS } from './bundled-fonts';

type FontkitFont = ReturnType<typeof fontkit.create>;

export function openFont(bytes: Uint8Array): FontkitFont {
  try {
    const font = fontkit.create(bytes);
    if (font.numGlyphs === 0) throw new Error('no glyphs');
    return font;
  } catch (error) {
    throw new AppError('font-invalid', undefined, { cause: error });
  }
}

/** Characters of `text` the font has no glyph for (whitespace is ignored). */
export function missingChars(font: FontkitFont, text: string): string[] {
  const missing = new Set<string>();
  for (const char of text) {
    if (/\s/u.test(char)) continue;
    const codePoint = char.codePointAt(0);
    if (codePoint !== undefined && !font.hasGlyphForCodePoint(codePoint)) missing.add(char);
  }
  return [...missing];
}

/** Cap height as a fraction of the em (0.7 when the font does not declare it). */
export function capHeightRatio(font: FontkitFont): number {
  const ratio = font.capHeight / font.unitsPerEm;
  return Number.isFinite(ratio) && ratio > 0.2 && ratio < 1.2 ? ratio : 0.7;
}

function isVariable(font: FontkitFont): boolean {
  const axes = (font as unknown as { variationAxes?: Record<string, unknown> }).variationAxes;
  return axes !== undefined && Object.keys(axes).length > 0;
}

const SIGNATURES: readonly (readonly number[])[] = [
  [0x00, 0x01, 0x00, 0x00], // TrueType
  [0x4f, 0x54, 0x54, 0x4f], // "OTTO" (CFF)
  [0x74, 0x72, 0x75, 0x65], // "true" (old Mac TrueType)
];

/** Validates an uploaded TTF/OTF and describes what the app can do with it. */
export function inspectFont(file: SourceFile): FontInfo {
  const isFontFile = SIGNATURES.some((signature) =>
    signature.every((value, index) => file.bytes[index] === value),
  );
  if (!isFontFile) throw new AppError('font-unsupported', file.name);
  const font = openFont(file.bytes);
  return {
    familyName: font.familyName ?? font.fullName ?? file.name.replace(/\.[^.]+$/u, ''),
    isCff: font.cff != null,
    isVariable: isVariable(font),
    missingSpanishChars: missingChars(font, SPANISH_CHARS),
  };
}
