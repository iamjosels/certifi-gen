/**
 * Deterministic participant list for fixtures.
 *
 * Every entry has the `clean` value (what the app must produce after normalization) and a
 * `raw` value (what is written to the files: extra spaces, tabs, NBSP, invisible characters).
 * Mixed case is part of the clean value: normalization never changes letter case.
 */

export interface NameEntry {
  clean: string;
  raw: string;
  /** Raw value restricted to characters representable in Windows-1252. */
  rawLatin: string;
}

export const TOTAL_VALID = 360;

/** Mulberry32: tiny deterministic PRNG. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  'José',
  'María',
  'Begoña',
  'Íñigo',
  'Ángela',
  'Raúl',
  'Martín',
  'Inés',
  'Sofía',
  'Lucía',
  'Andrés',
  'Jesús',
  'Ramón',
  'Óscar',
  'Adrián',
  'Nicolás',
  'Julián',
  'Simón',
  'Joaquín',
  'Germán',
  'Rubén',
  'Noemí',
  'Belén',
  'Mónica',
  'Verónica',
  'Ainhoa',
  'Iñaki',
  'Ignacio',
  'Camila',
  'Valentina',
  'Mateo',
  'Sebastián',
  'Agustín',
  'Tomás',
  'Benjamín',
  'Matías',
  'Facundo',
  'Lautaro',
  'Emilia',
  'Renata',
  'Antonella',
  'Martina',
  'Florencia',
  'Rocío',
  'Maite',
  'Nuria',
  'Montserrat',
  'Pilar',
  'Ana',
  'Luis',
  'Carlos',
  'Pedro',
  'Juan',
  'Diego',
  'Pablo',
  'Elena',
  'Clara',
  'Paula',
  'Marta',
  'Laura',
  'Carmen',
  'Rosa',
  'Teresa',
  'Isabel',
  'Beatriz',
  'Cristina',
  'Patricia',
  'Gloria',
  'Esteban',
  'Héctor',
  'Víctor',
  'Álvaro',
  'Fernando',
  'Gonzalo',
  'Rodrigo',
  'Hernán',
  'Ximena',
  'Xavier',
  'Yolanda',
  'Zoë',
  'Joël',
];

const LAST_NAMES = [
  'López',
  'García',
  'Martínez',
  'Rodríguez',
  'Fernández',
  'González',
  'Pérez',
  'Sánchez',
  'Ramírez',
  'Torres',
  'Flores',
  'Rivera',
  'Gómez',
  'Díaz',
  'Reyes',
  'Cruz',
  'Morales',
  'Ortiz',
  'Gutiérrez',
  'Chávez',
  'Ramos',
  'Ruiz',
  'Álvarez',
  'Jiménez',
  'Muñoz',
  'Núñez',
  'Ibáñez',
  'Peña',
  'Castañeda',
  'Zúñiga',
  'Montaño',
  'Güemes',
  'Argüello',
  'Agüero',
  'Müller',
  'Saldaña',
  'Olivares',
  'Herrera',
  'Medina',
  'Castro',
  'Vargas',
  'Romero',
  'Navarro',
  'Domínguez',
  'Vázquez',
  'Benítez',
  'Mejía',
  'Suárez',
  'Cáceres',
  'Quiñones',
  'Villalobos',
  'Echeverría',
  'Aranguren',
  'Etxeberria',
  'Bolaños',
  'Carreño',
  'Begué',
];

/** Hand-picked edge cases that must always be present. */
export const SPECIAL_NAMES: readonly string[] = [
  "Seán O'Connor",
  "Patrick O'Brien Núñez",
  'Liam O’Neill',
  "D'Angelo Rossi",
  'María-José López',
  'Jean-Pierre Dupont',
  'Ana-Lucía Peña Saldaña',
  'Juan de la Cruz',
  'Pedro del Valle',
  'Luis van der Berg',
  'Ana von Bismarck',
  'José da Silva',
  'Begoña Núñez Ibáñez',
  'Íñigo Muñoz Carreño',
  'Mario Güemes Argüello',
  'Jürgen Müller',
  'Zoë Agüero',
  'María de los Ángeles Fernández-Villaverde y Santisteban',
  'José Ignacio Rodríguez de la Fuente Echeverría Aranguren',
  'Ana Sofía Castañeda Zúñiga de Montaño y Olivares',
  'Francisco Javier Hernández-Quiñones de las Mercedes',
  'jUAN pérez rOJAS',
  'ANA GARCÍA LÓPEZ',
  'maría lópez',
  'pEdRo SÁNCHEZ díaz',
  'Ñuflo Peña',
];

/** Exact duplicates (same clean text) and accent/case-insensitive duplicates. */
export const DUPLICATE_PAIRS: readonly (readonly [string, string])[] = [
  ['Lucía Fernández', 'Lucía Fernández'],
  ['Juan Pérez', 'Juan Pérez'],
  ['Carmen Ruiz', 'Carmen Ruiz'],
  ['Andrés Gómez', 'ANDRES GOMEZ'],
  ['Inés Muñoz', 'ines muñoz'],
];

function duplicateKey(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/’/g, "'");
}

const DIRT_CHARS = {
  nbsp: '\u00a0',
  zeroWidth: '\u200b',
  softHyphen: '\u00ad',
};

/** Characters that Windows-1252 cannot represent (dropped for the CP1252 export). */
function toLatin(raw: string): string {
  return raw.replace(/\u200b/g, '');
}

function dirty(clean: string, random: () => number, index: number): string {
  const variant = index % 9;
  switch (variant) {
    case 0:
      return clean.replace(' ', '  ');
    case 1:
      return `  ${clean}   `;
    case 2:
      return clean.replace(' ', '\t');
    case 3:
      return clean.replace(' ', DIRT_CHARS.nbsp);
    case 4: {
      // Invisible character inside the first word.
      const cut = Math.max(1, Math.floor(random() * 3));
      return `${clean.slice(0, cut)}${DIRT_CHARS.zeroWidth}${clean.slice(cut)}`;
    }
    case 5: {
      const cut = Math.max(1, Math.min(clean.length - 1, 2));
      return `${clean.slice(0, cut)}${DIRT_CHARS.softHyphen}${clean.slice(cut)}`;
    }
    case 6:
      return clean.replace(/ /g, '   ');
    default:
      return clean;
  }
}

export function buildNameList(seed = 2026, total = TOTAL_VALID): NameEntry[] {
  const random = createRandom(seed);
  const pick = <T>(items: readonly T[]): T => {
    const item = items[Math.floor(random() * items.length)];
    if (item === undefined) throw new Error('empty list');
    return item;
  };

  const cleans: string[] = [];
  const usedKeys = new Set<string>();
  const add = (name: string, allowDuplicate = false): void => {
    const key = duplicateKey(name);
    if (!allowDuplicate && usedKeys.has(key)) throw new Error(`Unexpected duplicate: ${name}`);
    usedKeys.add(key);
    cleans.push(name);
  };

  for (const name of SPECIAL_NAMES) add(name);
  for (const [a, b] of DUPLICATE_PAIRS) {
    add(a);
    add(b, true);
  }

  while (cleans.length < total) {
    const parts = [pick(FIRST_NAMES)];
    if (random() < 0.35) parts.push(pick(FIRST_NAMES));
    parts.push(pick(LAST_NAMES));
    if (random() < 0.6) parts.push(pick(LAST_NAMES));
    const name = parts.join(' ');
    const key = duplicateKey(name);
    if (usedKeys.has(key) || new Set(parts).size !== parts.length) continue;
    usedKeys.add(key);
    cleans.push(name);
  }

  // Deterministic Fisher-Yates shuffle.
  for (let i = cleans.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = cleans[i];
    const b = cleans[j];
    if (a === undefined || b === undefined) throw new Error('shuffle out of range');
    cleans[i] = b;
    cleans[j] = a;
  }

  return cleans.map((clean, index) => {
    const raw = dirty(clean, random, index);
    return { clean, raw, rawLatin: toLatin(raw) };
  });
}

export { duplicateKey as fixtureDuplicateKey };
