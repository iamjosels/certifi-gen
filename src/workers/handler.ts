import { buildPreview } from '../application/build-preview';
import { estimateOutput } from '../application/estimate-output';
import { generateCertificates } from '../application/generate-certificates';
import { measureFields } from '../application/measure-fields';
import type {
  Archiver,
  CertificateRenderer,
  FontInfo,
  SourceFile,
  TemplateLoader,
} from '../application/ports';
import { AppError, isAppError } from '../domain/errors';
import type { WorkerRequest, WorkerResponse } from './protocol';

export interface WorkerDependencies {
  readonly renderer: CertificateRenderer;
  readonly archiver: Archiver;
  readonly templateLoader: TemplateLoader;
  readonly inspectFont: (file: SourceFile) => FontInfo;
  readonly post: (message: WorkerResponse, transfer?: Transferable[]) => void;
  readonly now?: () => number;
}

const yieldToEventLoop = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

/**
 * Message handler of the generation worker. Kept independent from the Worker global so it
 * can be unit-tested in Node.
 */
export function createWorkerHandler(deps: WorkerDependencies) {
  const cancelled = new Set<number>();
  const now = deps.now ?? (() => performance.now());

  async function run(message: WorkerRequest): Promise<void> {
    switch (message.type) {
      case 'cancel':
        cancelled.add(message.id);
        return;
      case 'load-template': {
        const result = await deps.templateLoader.load(message.file);
        deps.post({ id: message.id, type: 'result', result });
        return;
      }
      case 'inspect-font':
        deps.post({ id: message.id, type: 'result', result: deps.inspectFont(message.file) });
        return;
      case 'measure': {
        const result = await measureFields(message.request, deps.renderer);
        deps.post({ id: message.id, type: 'result', result });
        return;
      }
      case 'preview': {
        const result = await buildPreview(message.request, deps.renderer);
        deps.post({ id: message.id, type: 'result', result }, [result.buffer]);
        return;
      }
      case 'estimate': {
        const result = await estimateOutput(message.request, deps.renderer);
        deps.post({ id: message.id, type: 'result', result });
        return;
      }
      case 'generate': {
        const { id } = message;
        const result = await generateCertificates(message.request, deps, {
          now,
          onProgress: (progress) => {
            deps.post({ id, type: 'progress', progress });
          },
          checkpoint: async () => {
            await yieldToEventLoop();
            if (cancelled.has(id)) throw new AppError('generation-cancelled');
          },
        });
        cancelled.delete(id);
        deps.post({ id, type: 'result', result });
        return;
      }
    }
  }

  return async function handle(message: WorkerRequest): Promise<void> {
    try {
      await run(message);
    } catch (error) {
      if (message.type === 'generate') cancelled.delete(message.id);
      const appError = isAppError(error)
        ? error
        : new AppError(
            message.type === 'generate' ? 'generation-failed' : 'worker-unavailable',
            error instanceof Error ? error.message : String(error),
            { cause: error },
          );
      deps.post({
        id: message.id,
        type: 'error',
        code: appError.code,
        detail: appError.detail,
        message: appError.message,
      });
    }
  };
}
