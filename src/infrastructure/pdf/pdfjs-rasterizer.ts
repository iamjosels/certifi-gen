import type * as Pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PreviewRasterizer, RasterImage } from '../../application/ports';
import { AppError } from '../../domain/errors';

/** pdf.js is loaded the first time a PDF has to be drawn, keeping it out of the initial bundle. */
let pdfjsModule: Promise<typeof Pdfjs> | null = null;

function loadPdfjs(): Promise<typeof Pdfjs> {
  pdfjsModule ??= import('pdfjs-dist').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
  });
  return pdfjsModule;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new AppError('template-pdf-damaged', 'canvas export'));
    }, 'image/png');
  });
}

/**
 * Renders PDF pages to images with pdf.js (template thumbnails and the real preview).
 * pdf.js assets are served from /pdfjs (copied by scripts/copy-pdfjs-assets.ts).
 */
export function createPdfjsRasterizer(baseUrl = '/'): PreviewRasterizer {
  const assets = `${baseUrl}pdfjs/`;
  return {
    async renderPdf(bytes, targetWidth): Promise<RasterImage> {
      const { VerbosityLevel, getDocument } = await loadPdfjs();
      const task = getDocument({
        data: bytes.slice(),
        standardFontDataUrl: `${assets}standard_fonts/`,
        cMapUrl: `${assets}cmaps/`,
        cMapPacked: true,
        wasmUrl: `${assets}wasm/`,
        iccUrl: `${assets}iccs/`,
        verbosity: VerbosityLevel.ERRORS,
      });
      try {
        const doc = await task.promise;
        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: targetWidth / base.width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        const url = URL.createObjectURL(await canvasToBlob(canvas));
        return {
          url,
          width: canvas.width,
          height: canvas.height,
          release: () => {
            URL.revokeObjectURL(url);
          },
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('template-pdf-damaged', 'preview', { cause: error });
      } finally {
        await task.destroy();
      }
    },
  };
}
