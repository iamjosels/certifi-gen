/**
 * Generates certificates for the hardest names and renders them to PNG (pdf.js +
 * @napi-rs/canvas, since pdftoppm is not available) into docs/verification/:
 * the full page and a zoomed crop of the name box, to check position, alignment, clipping
 * and accents by eye.
 *
 *   npm run verify:render
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateCertificates } from '../src/application/generate-certificates';
import { parseParticipants } from '../src/application/parse-participants';
import type { FontAsset, LoadedTemplate } from '../src/application/ports';
import { createNameField, type FieldConfig } from '../src/domain/field';
import type { Participant } from '../src/domain/participant';
import { jszipArchiver } from '../src/infrastructure/archive/jszip-archiver';
import { BUNDLED_FONTS } from '../src/infrastructure/fonts/bundled-fonts';
import { createParserRegistry } from '../src/infrastructure/parsers/registry';
import { pdfLibRenderer } from '../src/infrastructure/pdf/pdf-lib-renderer';
import { templateLoader } from '../src/infrastructure/pdf/template-loader';
import { renderPdfPage } from './lib/pdf-node';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'verification');
const FIXTURES = join(ROOT, 'fixtures');

interface Expected {
  samples: Record<'longest' | 'withEnye' | 'withApostrophe' | 'normal' | 'withHyphen', string>;
}

async function load(name: string) {
  return { name, bytes: new Uint8Array(await readFile(join(FIXTURES, name))) };
}

async function render(
  template: LoadedTemplate,
  participant: Participant,
  fonts: FontAsset[],
  field: FieldConfig,
): Promise<Uint8Array> {
  const output = await generateCertificates(
    { template, participants: [participant], fields: [field], fonts, mode: 'merged' },
    { renderer: pdfLibRenderer, archiver: jszipArchiver },
    {
      now: () => performance.now(),
      onProgress: () => undefined,
      checkpoint: () => Promise.resolve(),
    },
  );
  if (!output.merged) throw new Error('no output');
  return new Uint8Array(await output.merged.arrayBuffer());
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const expected = JSON.parse(await readFile(join(FIXTURES, 'expected.json'), 'utf8')) as Expected;
  const { list } = await parseParticipants(
    await load('participantes-360.txt'),
    createParserRegistry(),
  );
  const find = (name: string) => {
    const participant = list.participants.find((p) => p.name === name);
    if (!participant) throw new Error(`missing ${name}`);
    return participant;
  };
  const fonts = await Promise.all(
    BUNDLED_FONTS.map(async (font) => ({
      id: font.id,
      subset: font.subset,
      bytes: new Uint8Array(await readFile(join(ROOT, 'public', font.path))),
    })),
  );
  const landscape = await templateLoader.load(await load('plantilla-horizontal.pdf'));
  const portrait = await templateLoader.load(await load('plantilla-vertical.pdf'));
  const field = createNameField();

  const cases: { slug: string; template: LoadedTemplate; name: string; field: FieldConfig }[] = [
    { slug: '1-mas-largo', template: landscape, name: expected.samples.longest, field },
    { slug: '2-con-enie', template: landscape, name: expected.samples.withEnye, field },
    { slug: '3-con-apostrofe', template: landscape, name: expected.samples.withApostrophe, field },
    { slug: '4-normal', template: landscape, name: expected.samples.normal, field },
    { slug: '5-vertical-mas-largo', template: portrait, name: expected.samples.longest, field },
    {
      slug: '6-caligrafica-guion',
      template: landscape,
      name: expected.samples.withHyphen,
      field: { ...field, fontId: 'great-vibes', maxSize: 54 },
    },
  ];

  const lines: string[] = [];
  for (const item of cases) {
    const pdf = await render(item.template, find(item.name), fonts, item.field);
    const page = item.template.info.page;
    const scale = 2;
    await writeFile(join(OUT, `${item.slug}.png`), await renderPdfPage(pdf, { scale }));
    const zoom = 4;
    const box = item.field.box;
    const height = item.field.maxSize * 2.2;
    await writeFile(
      join(OUT, `${item.slug}-zoom.png`),
      await renderPdfPage(pdf, {
        scale: zoom,
        crop: {
          x: Math.max(0, (box.x - 0.02) * page.width * zoom),
          y: Math.max(0, (box.y * page.height - height / 2) * zoom),
          width: (box.width + 0.04) * page.width * zoom,
          height: height * zoom,
        },
      }),
    );
    lines.push(`- ${item.slug}: "${item.name}"`);
    console.log(`✓ ${item.slug}: ${item.name}`);
  }
  await writeFile(
    join(OUT, 'README.md'),
    [
      '# Verificación visual',
      '',
      'Generado con `npm run verify:render` (pdf.js + @napi-rs/canvas; `pdftoppm` no está disponible).',
      'Cada caso tiene la página completa (`N-*.png`, 144 DPI) y un recorte ampliado de la caja del nombre (`N-*-zoom.png`, 288 DPI).',
      '',
      ...lines,
      '',
    ].join('\n'),
  );
}

await main();
