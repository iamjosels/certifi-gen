/**
 * Measures generation time and output sizes for the 360 fixture participants in Node
 * (same adapters as the worker) and writes docs/verification/metrics-node.json.
 *
 *   npm run metrics
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateCertificates } from '../src/application/generate-certificates';
import { parseParticipants } from '../src/application/parse-participants';
import { createNameField } from '../src/domain/field';
import { jszipArchiver } from '../src/infrastructure/archive/jszip-archiver';
import { BUNDLED_FONTS } from '../src/infrastructure/fonts/bundled-fonts';
import { createParserRegistry } from '../src/infrastructure/parsers/registry';
import { pdfLibRenderer } from '../src/infrastructure/pdf/pdf-lib-renderer';
import { templateLoader } from '../src/infrastructure/pdf/template-loader';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(ROOT, 'fixtures');
const RUNS = 3;

async function load(name: string) {
  return { name, bytes: new Uint8Array(await readFile(join(FIXTURES, name))) };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function main(): Promise<void> {
  const { list } = await parseParticipants(
    await load('participantes-360.txt'),
    createParserRegistry(),
  );
  const fonts = await Promise.all(
    BUNDLED_FONTS.map(async (font) => ({
      id: font.id,
      subset: font.subset,
      bytes: new Uint8Array(await readFile(join(ROOT, 'public', font.path))),
    })),
  );
  const results = [];
  for (const file of [
    'plantilla-horizontal.pdf',
    'plantilla-vertical.pdf',
    'plantilla-horizontal.png',
    'plantilla-horizontal.jpg',
    'plantilla-pesada.png',
  ]) {
    const template = await templateLoader.load(await load(file));
    const times: number[] = [];
    let zipBytes = 0;
    let mergedBytes = 0;
    const runs = file === 'plantilla-pesada.png' ? 1 : RUNS;
    for (let run = 0; run < runs; run += 1) {
      const output = await generateCertificates(
        {
          template,
          participants: list.participants,
          fields: [createNameField()],
          fonts,
          mode: 'both',
        },
        { renderer: pdfLibRenderer, archiver: jszipArchiver },
        {
          now: () => performance.now(),
          onProgress: () => undefined,
          checkpoint: () => Promise.resolve(),
        },
      );
      times.push(output.elapsedMs);
      zipBytes = output.zip?.size ?? 0;
      mergedBytes = output.merged?.size ?? 0;
    }
    const result = {
      template: file,
      templateBytes: template.bytes.length,
      participants: list.participants.length,
      mode: 'both',
      runs,
      medianMs: Math.round(median(times)),
      zipBytes,
      mergedBytes,
      averageIndividualBytes: Math.round(zipBytes / list.participants.length),
    };
    results.push(result);
    console.log(JSON.stringify(result));
  }
  await mkdir(join(ROOT, 'docs', 'verification'), { recursive: true });
  await writeFile(
    join(ROOT, 'docs', 'verification', 'metrics-node.json'),
    `${JSON.stringify({ node: process.version, platform: process.platform, results }, null, 2)}\n`,
  );
}

await main();
