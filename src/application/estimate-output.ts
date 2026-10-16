import type { Participant } from '../domain/participant';
import type { SizeSample } from '../domain/size-estimate';
import type { CertificateRenderer, RenderRequest } from './ports';

const INDIVIDUAL_SAMPLES = 3;
const MERGED_SAMPLE_PAGES = 5;

function spread<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];
  return Array.from({ length: count }, (_, i) => {
    const item = items[Math.round((i * (items.length - 1)) / (count - 1))];
    if (item === undefined) throw new Error('sample out of range');
    return item;
  });
}

/** Generates a few real certificates to estimate the final ZIP and merged PDF sizes. */
export async function estimateOutput(
  request: RenderRequest & { readonly participants: readonly Participant[] },
  renderer: CertificateRenderer,
): Promise<SizeSample> {
  const session = await renderer.prepare(request);
  const samples = spread(request.participants, INDIVIDUAL_SAMPLES);
  const individualSizes: number[] = [];
  for (const participant of samples) {
    individualSizes.push((await session.renderDocument(participant)).bytes.length);
  }

  const single = await session.createMergedDocument();
  const first = request.participants[0];
  if (first) single.addPage(first);
  const mergedSinglePageSize = (await single.save()).length;

  const pages = spread(request.participants, MERGED_SAMPLE_PAGES);
  const multi = await session.createMergedDocument();
  for (const participant of pages) multi.addPage(participant);
  const mergedSampleSize = (await multi.save()).length;

  return {
    individualSizes,
    mergedSinglePageSize,
    mergedSampleSize,
    mergedSamplePages: Math.max(1, pages.length),
  };
}
