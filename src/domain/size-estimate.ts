export type OutputMode = 'zip' | 'merged' | 'both';

export interface SizeSample {
  /** Bytes of single-certificate PDFs generated as a sample. */
  readonly individualSizes: readonly number[];
  /**
   * Two merged PDFs of different page counts. The marginal size per page is taken between them,
   * once the font subset has most of its glyphs (a 1-page baseline overestimates it).
   */
  readonly mergedSmall: { readonly pages: number; readonly bytes: number };
  readonly mergedLarge: { readonly pages: number; readonly bytes: number };
}

export interface SizeEstimate {
  readonly zipBytes: number | null;
  readonly mergedBytes: number | null;
}

/** Local file header + central directory entry + file name, per ZIP entry (STORE). */
const ZIP_ENTRY_OVERHEAD = 30 + 46 + 2 * 40;
const ZIP_END_OVERHEAD = 22;
/** reporte.csv: roughly one line per participant. */
const REPORT_BYTES_PER_ROW = 110;

export function estimateOutputSize(
  sample: SizeSample,
  total: number,
  mode: OutputMode,
): SizeEstimate {
  const average =
    sample.individualSizes.length === 0
      ? 0
      : sample.individualSizes.reduce((sum, value) => sum + value, 0) /
        sample.individualSizes.length;
  const zipBytes =
    mode === 'merged'
      ? null
      : Math.round(
          total * (average + ZIP_ENTRY_OVERHEAD) +
            total * REPORT_BYTES_PER_ROW +
            ZIP_ENTRY_OVERHEAD +
            ZIP_END_OVERHEAD,
        );
  let mergedBytes: number | null = null;
  if (mode !== 'zip') {
    const { mergedSmall: small, mergedLarge: large } = sample;
    const extraPages = large.pages - small.pages;
    const perPage = extraPages > 0 ? Math.max(0, (large.bytes - small.bytes) / extraPages) : 0;
    mergedBytes = Math.max(0, Math.round(large.bytes + perPage * (total - large.pages)));
  }
  return { zipBytes, mergedBytes };
}

/** Above this the ZIP is considered "very large" and the UI suggests optimizing the image. */
export const LARGE_OUTPUT_BYTES = 500 * 1024 * 1024;
