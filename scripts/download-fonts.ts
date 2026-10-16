/**
 * Downloads the bundled OFL fonts (static TTF) from the google/fonts repository
 * into public/fonts/<id>/ together with their OFL license.
 *
 * Run once with `npm run fonts`; the files are committed to the repository.
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl';

interface FontSource {
  id: string;
  repoDir: string;
  file: string;
}

export const FONT_SOURCES: readonly FontSource[] = [
  { id: 'dm-serif-display', repoDir: 'dmserifdisplay', file: 'DMSerifDisplay-Regular.ttf' },
  { id: 'poppins', repoDir: 'poppins', file: 'Poppins-Medium.ttf' },
  { id: 'great-vibes', repoDir: 'greatvibes', file: 'GreatVibes-Regular.ttf' },
  { id: 'barlow-condensed', repoDir: 'barlowcondensed', file: 'BarlowCondensed-Medium.ttf' },
  { id: 'marcellus', repoDir: 'marcellus', file: 'Marcellus-Regular.ttf' },
];

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${String(response.status)}): ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  for (const font of FONT_SOURCES) {
    const targetDir = join(ROOT, 'public', 'fonts', font.id);
    await mkdir(targetDir, { recursive: true });
    const fontPath = join(targetDir, font.file);
    const licensePath = join(targetDir, 'OFL.txt');
    if (!force && (await exists(fontPath)) && (await exists(licensePath))) {
      console.log(`✓ ${font.id} (already present)`);
      continue;
    }
    const [fontBytes, licenseBytes] = await Promise.all([
      download(`${BASE_URL}/${font.repoDir}/${font.file}`),
      download(`${BASE_URL}/${font.repoDir}/OFL.txt`),
    ]);
    await writeFile(fontPath, fontBytes);
    await writeFile(licensePath, licenseBytes);
    console.log(`↓ ${font.id}: ${font.file} (${String(Math.round(fontBytes.length / 1024))} KB)`);
  }
}

await main();
