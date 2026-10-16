export type OutputMode = 'zip' | 'merged' | 'both';

export interface SizeSample {
  /** Bytes of single-certificate PDFs generated as a sample. */
  readonly individualSizes: readonly number[];
  /** Bytes of a merged PDF with `mergedSamplePages` pages. */
  readonly mergedSampleSize: number;
  readonly mergedSamplePages: number;
  /** Bytes of a merged PDF with a single page (same participants' first). */
  readonly mergedSinglePageSize: number;
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
    const extraPages = Math.max(1, sample.mergedSamplePages - 1);
    const perPage = Math.max(
      0,
      (sample.mergedSampleSize - sample.mergedSinglePageSize) / extraPages,
    );
    mergedBytes = Math.round(sample.mergedSinglePageSize + perPage * Math.max(0, total - 1));
  }
  return { zipBytes, mergedBytes };
}

/** Above this the ZIP is considered "very large" and the UI suggests optimizing the image. */
export const LARGE_OUTPUT_BYTES = 500 * 1024 * 1024;
