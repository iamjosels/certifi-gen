/**
 * Generates every test fixture into fixtures/ deterministically.
 *
 *   npm run fixtures            (skips work when the generator sources did not change)
 *   npm run fixtures -- --force
 */
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  exifRotatedJpgFromPdf,
  heavyPngFromPdf,
  jpgFromPdf,
  pngFromPdf,
  transparentPngFromPdf,
} from './fixtures/images';
import {
  TOTAL_BLANKS,
  buildCsvUtf8,
  buildCsvWindows1252,
  buildDocx,
  buildEmptyTxt,
  buildTxt,
  buildXlsx,
} from './fixtures/lists';
import { TOTAL_VALID, buildNameList, fixtureDuplicateKey } from './fixtures/names';
import {
  croppedTemplate,
  damagedTemplate,
  encryptedTemplate,
  landscapeTemplate,
  portraitTemplate,
  rotatedTemplate,
  twoPageTemplate,
} from './fixtures/templates';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'fixtures');
const STAMP = join(OUT, '.stamp');

const OUTPUT_FILES = [
  'plantilla-horizontal.pdf',
  'plantilla-vertical.pdf',
  'plantilla-horizontal.png',
  'plantilla-horizontal.jpg',
  'plantilla-vertical.png',
  'plantilla-vertical.jpg',
  'plantilla-pesada.png',
  'plantilla-transparente.png',
  'plantilla-exif-rotada.jpg',
  'plantilla-2-paginas.pdf',
  'plantilla-rotada.pdf',
  'plantilla-recortada.pdf',
  'plantilla-protegida.pdf',
  'plantilla-danada.pdf',
  'formato-no-soportado.gif',
  'participantes-360.txt',
  'participantes-360.csv',
  'participantes-360-windows1252.csv',
  'participantes-360.xlsx',
  'participantes-360.docx',
  'lista-vacia.txt',
  'lista-no-soportada.json',
  'participantes-1000.txt',
  'expected.json',
] as const;

async function sourceHash(): Promise<string> {
  const hash = createHash('sha256');
  const files = [
    join(ROOT, 'scripts', 'generate-fixtures.ts'),
    join(ROOT, 'scripts', 'lib', 'pdf-node.ts'),
    ...(await readdir(join(ROOT, 'scripts', 'fixtures')))
      .sort()
      .map((f) => join(ROOT, 'scripts', 'fixtures', f)),
  ];
  for (const file of files) hash.update(await readFile(file));
  return hash.digest('hex');
}

async function isUpToDate(hash: string): Promise<boolean> {
  try {
    if ((await readFile(STAMP, 'utf8')).trim() !== hash) return false;
    await Promise.all(OUTPUT_FILES.map((file) => access(join(OUT, file))));
    return true;
  } catch {
    return false;
  }
}

async function write(
  name: (typeof OUTPUT_FILES)[number],
  data: Uint8Array | string,
): Promise<void> {
  await writeFile(join(OUT, name), data);
}

async function main(): Promise<void> {
  const hash = await sourceHash();
  if (!process.argv.includes('--force') && (await isUpToDate(hash))) {
    console.log('Fixtures up to date.');
    return;
  }
  const started = performance.now();
  await mkdir(OUT, { recursive: true });

  const landscape = await landscapeTemplate();
  const portrait = await portraitTemplate();
  await write('plantilla-horizontal.pdf', landscape);
  await write('plantilla-vertical.pdf', portrait);
  await write('plantilla-2-paginas.pdf', await twoPageTemplate());
  await write('plantilla-rotada.pdf', await rotatedTemplate());
  await write('plantilla-recortada.pdf', await croppedTemplate());
  await write('plantilla-protegida.pdf', await encryptedTemplate());
  await write('plantilla-danada.pdf', damagedTemplate(landscape));

  await write('plantilla-horizontal.png', await pngFromPdf(landscape));
  await write('plantilla-horizontal.jpg', await jpgFromPdf(landscape));
  await write('plantilla-vertical.png', await pngFromPdf(portrait));
  await write('plantilla-vertical.jpg', await jpgFromPdf(portrait));
  const heavy = await heavyPngFromPdf(landscape);
  if (heavy.length <= 3 * 1024 * 1024) {
    throw new Error(`plantilla-pesada.png must exceed 3 MB (got ${String(heavy.length)} bytes)`);
  }
  await write('plantilla-pesada.png', heavy);
  const transparent = await transparentPngFromPdf(landscape);
  if (transparent.length <= 1024 * 1024) {
    throw new Error('plantilla-transparente.png must exceed 1 MB');
  }
  await write('plantilla-transparente.png', transparent);
  await write('plantilla-exif-rotada.jpg', await exifRotatedJpgFromPdf(landscape));
  // GIF89a 1x1: a valid image in a format the app does not accept.
  await write(
    'formato-no-soportado.gif',
    Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64'),
  );

  const entries = buildNameList();
  if (entries.length !== TOTAL_VALID) throw new Error('Unexpected participant count');
  await write('participantes-360.txt', buildTxt(entries));
  await write('participantes-360.csv', buildCsvUtf8(entries));
  await write('participantes-360-windows1252.csv', buildCsvWindows1252(entries));
  await write('participantes-360.xlsx', buildXlsx(entries));
  await write('participantes-360.docx', await buildDocx(entries));
  await write('lista-vacia.txt', buildEmptyTxt());
  await write('lista-no-soportada.json', JSON.stringify({ participantes: ['Ana'] }));
  // Volume test: the same kind of names, 1000 of them.
  await write('participantes-1000.txt', buildTxt(buildNameList(1000, 1000)));

  const names = entries.map((entry) => entry.clean);
  const groups = new Map<string, number[]>();
  names.forEach((name, index) => {
    const key = fixtureDuplicateKey(name);
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });
  const duplicateGroups = [...groups.values()].filter((group) => group.length > 1);
  const longest = names.reduce((a, b) => (b.length > a.length ? b : a));
  const find = (predicate: (name: string) => boolean): string => {
    const found = names.find(predicate);
    if (found === undefined) throw new Error('Sample not found');
    return found;
  };
  const expected = {
    count: names.length,
    names,
    blankRows: TOTAL_BLANKS,
    columns: ['Nombre', 'Correo', 'Curso'],
    duplicateGroups,
    samples: {
      first: names[0],
      last: names[names.length - 1],
      longest,
      withEnye: find((n) => /ñ/i.test(n) && n !== longest),
      withApostrophe: find((n) => n.includes("O'Connor")),
      withHyphen: find((n) => n.includes('María-José')),
      withDiaeresis: find((n) => /ü/i.test(n)),
      normal: find((n) => /^[A-Za-z]+ [A-Za-z]+$/.test(n)),
      longNames: names.filter((n) => n.length > 45),
    },
  };
  await write('expected.json', `${JSON.stringify(expected, null, 2)}\n`);
  await writeFile(STAMP, hash);
  console.log(
    `Fixtures generated in ${String(Math.round(performance.now() - started))} ms ` +
      `(${String(names.length)} names, ${String(duplicateGroups.length)} duplicate groups, ` +
      `heavy PNG ${(heavy.length / 1024 / 1024).toFixed(1)} MB).`,
  );
}

await main();
