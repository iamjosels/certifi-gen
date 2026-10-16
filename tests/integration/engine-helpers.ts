import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generateCertificates } from '../../src/application/generate-certificates';
import { parseParticipants } from '../../src/application/parse-participants';
import type {
  FontAsset,
  GenerationOutput,
  GenerationProgress,
  LoadedTemplate,
} from '../../src/application/ports';
import { createNameField, type FieldConfig } from '../../src/domain/field';
import type { Participant } from '../../src/domain/participant';
import type { OutputMode } from '../../src/domain/size-estimate';
import { jszipArchiver } from '../../src/infrastructure/archive/jszip-archiver';
import { BUNDLED_FONTS } from '../../src/infrastructure/fonts/bundled-fonts';
import { createParserRegistry } from '../../src/infrastructure/parsers/registry';
import { pdfLibRenderer } from '../../src/infrastructure/pdf/pdf-lib-renderer';
import { templateLoader } from '../../src/infrastructure/pdf/template-loader';
import { ROOT_DIR, readFixture } from './helpers';

export async function loadBundledFonts(): Promise<FontAsset[]> {
  return Promise.all(
    BUNDLED_FONTS.map(async (font) => ({
      id: font.id,
      subset: font.subset,
      bytes: new Uint8Array(await readFile(join(ROOT_DIR, 'public', font.path))),
    })),
  );
}

export async function loadTemplateFixture(name: string): Promise<LoadedTemplate> {
  return templateLoader.load(await readFixture(name));
}

export async function loadParticipants(name = 'participantes-360.txt'): Promise<Participant[]> {
  const result = await parseParticipants(await readFixture(name), createParserRegistry());
  return [...result.list.participants];
}

export async function runGeneration(params: {
  template: LoadedTemplate;
  participants: readonly Participant[];
  mode: OutputMode;
  fonts: readonly FontAsset[];
  fields?: readonly FieldConfig[];
  onProgress?: (progress: GenerationProgress) => void;
  checkpoint?: () => Promise<void>;
}): Promise<GenerationOutput> {
  return generateCertificates(
    {
      template: params.template,
      participants: params.participants,
      mode: params.mode,
      fonts: params.fonts,
      fields: params.fields ?? [createNameField()],
      batchSize: 20,
    },
    { renderer: pdfLibRenderer, archiver: jszipArchiver },
    {
      now: () => performance.now(),
      onProgress: params.onProgress ?? (() => undefined),
      checkpoint: params.checkpoint ?? (() => Promise.resolve()),
    },
  );
}

export async function blobBytes(blob: Blob | null): Promise<Uint8Array> {
  if (!blob) throw new Error('missing output');
  return new Uint8Array(await blob.arrayBuffer());
}
