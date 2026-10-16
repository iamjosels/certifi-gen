/// <reference lib="webworker" />
/**
 * Generation worker: template analysis, text measurement, previews, size estimates and the
 * generation itself run here, so the interface never freezes.
 */
import { jszipArchiver } from '../infrastructure/archive/jszip-archiver';
import { inspectFont } from '../infrastructure/fonts/font-tools';
import { pdfLibRenderer } from '../infrastructure/pdf/pdf-lib-renderer';
import { templateLoader } from '../infrastructure/pdf/template-loader';
import { createWorkerHandler } from './handler';
import type { WorkerRequest } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

const handle = createWorkerHandler({
  renderer: pdfLibRenderer,
  archiver: jszipArchiver,
  templateLoader,
  inspectFont,
  post: (message, transfer = []) => {
    self.postMessage(message, transfer);
  },
});

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  void handle(event.data);
});
