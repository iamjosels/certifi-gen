/**
 * Composition root: the only place that knows the concrete adapters. Swapping a library
 * (another PDF engine, another ZIP library, a backend for configurations) only changes this file.
 */
import type { AppServices } from './application/services';
import { createFontProvider } from './infrastructure/fonts/font-provider';
import { canvasImageOptimizer } from './infrastructure/image/canvas-optimizer';
import { createParserRegistry } from './infrastructure/parsers/registry';
import { createPdfjsRasterizer } from './infrastructure/pdf/pdfjs-rasterizer';
import { createLocalConfigStorage } from './infrastructure/storage/local-config-storage';
import { createWorkerEngine } from './infrastructure/worker/worker-client';

export function createServices(): AppServices {
  const baseUrl = import.meta.env.BASE_URL;
  return {
    engine: createWorkerEngine(
      () =>
        new Worker(new URL('./workers/generate.worker.ts', import.meta.url), {
          type: 'module',
          name: 'certifica-engine',
        }),
    ),
    parsers: createParserRegistry(),
    fonts: createFontProvider({ baseUrl }),
    rasterizer: createPdfjsRasterizer(baseUrl),
    imageOptimizer: canvasImageOptimizer,
    configStorage: createLocalConfigStorage(),
  };
}
