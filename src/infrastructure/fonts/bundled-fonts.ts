import type { FontDescriptor } from '../../application/ports';

export interface BundledFont extends FontDescriptor {
  /** Path under public/ (served from the site root). */
  readonly path: string;
}

/**
 * OFL fonts shipped in public/fonts (see each folder's OFL.txt). The `subset` flag is verified
 * by tests/integration/fonts.test.ts, which renders every Spanish character with and without
 * subsetting and compares the pixels and the extracted text.
 */
export const BUNDLED_FONTS: readonly BundledFont[] = [
  {
    id: 'dm-serif-display',
    name: 'DM Serif Display',
    category: 'serif',
    subset: true,
    source: 'bundled',
    path: 'fonts/dm-serif-display/DMSerifDisplay-Regular.ttf',
  },
  {
    id: 'poppins',
    name: 'Poppins',
    category: 'sans',
    subset: true,
    source: 'bundled',
    path: 'fonts/poppins/Poppins-Medium.ttf',
  },
  {
    id: 'great-vibes',
    name: 'Great Vibes',
    category: 'script',
    subset: true,
    source: 'bundled',
    path: 'fonts/great-vibes/GreatVibes-Regular.ttf',
  },
  {
    id: 'barlow-condensed',
    name: 'Barlow Condensed',
    category: 'condensed',
    subset: true,
    source: 'bundled',
    path: 'fonts/barlow-condensed/BarlowCondensed-Medium.ttf',
  },
  {
    id: 'marcellus',
    name: 'Marcellus',
    category: 'classic',
    subset: true,
    source: 'bundled',
    path: 'fonts/marcellus/Marcellus-Regular.ttf',
  },
];

/** Characters every bundled font must draw. */
export const SPANISH_CHARS = "ÁÉÍÓÚÜÑáéíóúüñ¿¡ÀÈÌÒÙàèìòùÇçÄËÏÖäëïöÂÊÎÔÛâêîôû’'-.,";
