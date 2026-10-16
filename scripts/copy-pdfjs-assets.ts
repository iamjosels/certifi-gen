/**
 * Copies the pdf.js runtime assets (standard fonts, CMaps, wasm decoders and ICC profiles)
 * into public/pdfjs/ so the browser preview never falls back to warnings about missing data.
 */
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'node_modules', 'pdfjs-dist');
const TARGET = join(ROOT, 'public', 'pdfjs');
const FOLDERS = ['standard_fonts', 'cmaps', 'wasm', 'iccs'] as const;

await rm(TARGET, { recursive: true, force: true });
await mkdir(TARGET, { recursive: true });
for (const folder of FOLDERS) {
  await cp(join(SOURCE, folder), join(TARGET, folder), { recursive: true });
}
console.log(`pdf.js assets copied to ${TARGET}`);
