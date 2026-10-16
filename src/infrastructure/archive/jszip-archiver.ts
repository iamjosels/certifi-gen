import JSZip from 'jszip';
import type { ArchiveBuilder, Archiver } from '../../application/ports';

/**
 * ZIP with JSZip. PDFs are already compressed, so entries are STOREd: much faster and the
 * archive is barely bigger.
 */
export const jszipArchiver: Archiver = {
  create(): ArchiveBuilder {
    const zip = new JSZip();
    const fixedDate = new Date();
    return {
      add(path, data) {
        zip.file(path, data, { binary: typeof data !== 'string', date: fixedDate });
      },
      async finish() {
        const bytes = await zip.generateAsync({
          type: 'uint8array',
          compression: 'STORE',
          platform: 'DOS',
          mimeType: 'application/zip',
        });
        return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
      },
    };
  },
};
