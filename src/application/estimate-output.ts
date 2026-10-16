import type { Participant } from '../domain/participant';
import type { SizeSample } from '../domain/size-estimate';
import type { CertificateRenderer, RenderRequest } from './ports';

const INDIVIDUAL_SAMPLES = 3;
const MERGED_SMALL_PAGES = 10;
const MERGED_LARGE_PAGES = 20;

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
  const individualSizes: number[] = [];
  for (const participant of spread(request.participants, INDIVIDUAL_SAMPLES)) {
    individualSizes.push((await session.renderDocument(participant)).bytes.length);
  }

  const merged = async (count: number) => {
    const pages = spread(request.participants, count);
    const builder = await session.createMergedDocument();
    for (const participant of pages) builder.addPage(participant);
    return { pages: pages.length, bytes: (await builder.save()).length };
  };

  return {
    individualSizes,
    mergedSmall: await merged(MERGED_SMALL_PAGES),
    mergedLarge: await merged(MERGED_LARGE_PAGES),
  };
}
