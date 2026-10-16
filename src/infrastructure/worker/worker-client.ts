import type {
  GenerationEngine,
  GenerationOutput,
  GenerationProgress,
} from '../../application/ports';
import { AppError } from '../../domain/errors';
import type { WorkerRequest, WorkerResponse, WorkerResults } from '../../workers/protocol';

/** Time a cancelled worker gets to stop by itself before it is terminated. */
export const CANCEL_GRACE_MS = 500;

interface Pending {
  resolve: (value: never) => void;
  reject: (error: unknown) => void;
  onProgress?: (progress: GenerationProgress) => void;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type RequestBody = DistributiveOmit<Exclude<WorkerRequest, { type: 'cancel' }>, 'id'>;

/** A worker plus the bookkeeping of its in-flight requests. */
function connect(createWorker: () => Worker) {
  const worker = createWorker();
  const pending = new Map<number, Pending>();
  let nextId = 1;
  let broken: AppError | null = null;

  const failAll = (error: AppError) => {
    broken = error;
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  };

  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    const entry = pending.get(message.id);
    if (!entry) return;
    if (message.type === 'progress') {
      entry.onProgress?.(message.progress);
      return;
    }
    pending.delete(message.id);
    if (message.type === 'result') entry.resolve(message.result as never);
    else entry.reject(new AppError(message.code, message.detail));
  });
  worker.addEventListener('error', (event) => {
    event.preventDefault();
    failAll(new AppError('worker-unavailable', event.message || 'worker error'));
  });
  worker.addEventListener('messageerror', () => {
    failAll(new AppError('worker-unavailable', 'message could not be deserialized'));
  });

  return {
    worker,
    call<T extends RequestBody['type']>(
      body: Extract<RequestBody, { type: T }>,
      options: { transfer?: Transferable[]; onProgress?: (p: GenerationProgress) => void } = {},
    ): { id: number; promise: Promise<WorkerResults[T]> } {
      const id = nextId++;
      const promise = new Promise<WorkerResults[T]>((resolve, reject) => {
        if (broken) {
          reject(broken);
          return;
        }
        pending.set(id, {
          resolve,
          reject,
          ...(options.onProgress ? { onProgress: options.onProgress } : {}),
        });
        worker.postMessage({ ...body, id }, options.transfer ?? []);
      });
      return { id, promise };
    },
    cancel(id: number) {
      worker.postMessage({ id, type: 'cancel' } satisfies WorkerRequest);
    },
    rejectAll(error: AppError) {
      failAll(error);
    },
  };
}

/**
 * GenerationEngine backed by Web Workers: one long-lived worker for quick tasks (template
 * analysis, measurement, previews, estimates) and a fresh worker per generation, so
 * cancelling can always fall back to terminate().
 */
export function createWorkerEngine(createWorker: () => Worker): GenerationEngine {
  let service: ReturnType<typeof connect> | null = null;
  const serviceWorker = () => {
    service ??= connect(createWorker);
    return service;
  };
  const callService = async <T extends RequestBody['type']>(
    body: Extract<RequestBody, { type: T }>,
  ): Promise<WorkerResults[T]> => {
    const connection = serviceWorker();
    try {
      return await connection.call(body).promise;
    } catch (error) {
      if (error instanceof AppError && error.code === 'worker-unavailable') {
        connection.worker.terminate();
        service = null;
      }
      throw error;
    }
  };

  return {
    loadTemplate: (file) => callService({ type: 'load-template', file }),
    inspectFont: (file) => callService({ type: 'inspect-font', file }),
    measure: (request) => callService({ type: 'measure', request }),
    preview: (request) => callService({ type: 'preview', request }),
    estimate: (request) => callService({ type: 'estimate', request }),

    generate(request, onProgress, signal): Promise<GenerationOutput> {
      if (signal.aborted) return Promise.reject(new AppError('generation-cancelled'));
      const connection = connect(createWorker);
      const { id, promise } = connection.call({ type: 'generate', request }, { onProgress });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onAbort = () => {
        connection.cancel(id);
        timer = setTimeout(() => {
          connection.worker.terminate();
          connection.rejectAll(new AppError('generation-cancelled'));
        }, CANCEL_GRACE_MS);
      };
      signal.addEventListener('abort', onAbort, { once: true });
      return promise.finally(() => {
        signal.removeEventListener('abort', onAbort);
        if (timer) clearTimeout(timer);
        connection.worker.terminate();
      });
    },
  };
}
