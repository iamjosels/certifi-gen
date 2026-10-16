import { AppError } from '../domain/errors';
import { codeFieldOf, invalidFields, resolveFieldText } from '../domain/field';
import { certificateFileName } from '../domain/filename';
import { batchRanges } from '../domain/progress';
import { buildReportCsv, REPORT_FILE_NAME, type ReportRow } from '../domain/report';
import type {
  Archiver,
  CertificateRenderer,
  GenerateRequest,
  GenerationOutput,
  GenerationProgress,
} from './ports';

export interface GenerationHooks {
  onProgress(progress: GenerationProgress): void;
  /**
   * Called between batches: yields to the event loop (so a cancel message can arrive) and
   * throws AppError('generation-cancelled') when the job was cancelled.
   */
  checkpoint(): Promise<void>;
  now(): number;
}

export const DEFAULT_BATCH_SIZE = 10;

/**
 * Generates every certificate: one PDF per participant inside a ZIP (with reporte.csv), a
 * single PDF that embeds the template once, or both, reporting progress by batches.
 */
export async function generateCertificates(
  request: GenerateRequest,
  deps: { renderer: CertificateRenderer; archiver: Archiver },
  hooks: GenerationHooks,
): Promise<GenerationOutput> {
  const started = hooks.now();
  const { participants, fields, mode } = request;
  const total = participants.length;
  if (total === 0) throw new AppError('list-empty');
  const invalid = invalidFields(fields)[0];
  if (invalid) throw new AppError('code-pattern-invalid', invalid.label);

  const session = await deps.renderer.prepare(request);
  const archive = mode === 'merged' ? null : deps.archiver.create();
  const merged = mode === 'zip' ? null : await session.createMergedDocument();
  const codeField = codeFieldOf(fields);
  const report: ReportRow[] = [];
  let overflowCount = 0;

  const progress = (phase: GenerationProgress['phase'], done: number) => {
    hooks.onProgress({ phase, done, total, elapsedMs: hooks.now() - started });
  };
  progress('rendering', 0);

  for (const { start, end } of batchRanges(total, request.batchSize ?? DEFAULT_BATCH_SIZE)) {
    for (let i = start; i < end; i += 1) {
      const participant = participants[i];
      if (!participant) continue;
      const fileName = certificateFileName(i, total, participant.name);
      const overflow = new Set<string>();
      if (archive) {
        const rendered = await session.renderDocument(participant);
        archive.add(fileName, rendered.bytes);
        for (const label of rendered.overflowFields) overflow.add(label);
      }
      if (merged) {
        for (const label of merged.addPage(participant).overflowFields) overflow.add(label);
      }
      if (overflow.size > 0) overflowCount += 1;
      report.push({
        index: i + 1,
        name: participant.name,
        fileName: archive ? fileName : '',
        code: codeField ? resolveFieldText(codeField, participant) : '',
        overflowFields: [...overflow],
      });
    }
    progress('rendering', end);
    await hooks.checkpoint();
  }

  progress('packaging', total);
  let zip: Blob | null = null;
  if (archive) {
    archive.add(REPORT_FILE_NAME, buildReportCsv(report));
    zip = await archive.finish();
    await hooks.checkpoint();
  }
  let mergedBlob: Blob | null = null;
  if (merged) {
    const bytes = await merged.save();
    mergedBlob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
  }

  return {
    zip,
    merged: mergedBlob,
    report,
    overflowCount,
    elapsedMs: hooks.now() - started,
  };
}
