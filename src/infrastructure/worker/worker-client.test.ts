import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GenerateRequest } from '../../application/ports';
import type { WorkerRequest, WorkerResponse } from '../../workers/protocol';
import { CANCEL_GRACE_MS, createWorkerEngine } from './worker-client';

type Behaviour = (message: WorkerRequest, reply: (response: WorkerResponse) => void) => void;

class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = [];
  terminated = false;
  received: WorkerRequest[] = [];

  private readonly behaviour: Behaviour;

  constructor(behaviour: Behaviour) {
    super();
    this.behaviour = behaviour;
    FakeWorker.instances.push(this);
  }

  postMessage(message: WorkerRequest) {
    this.received.push(message);
    queueMicrotask(() => {
      this.behaviour(message, (response) => {
        if (!this.terminated) this.dispatchEvent(new MessageEvent('message', { data: response }));
      });
    });
  }

  terminate() {
    this.terminated = true;
  }

  fail(message: string) {
    const event = new Event('error') as Event & { message: string };
    event.message = message;
    this.dispatchEvent(event);
  }
}

function engineWith(behaviour: Behaviour) {
  return createWorkerEngine(() => new FakeWorker(behaviour) as unknown as Worker);
}

const request = { participants: [], mode: 'zip' } as unknown as GenerateRequest;
const file = { name: 'a.pdf', bytes: new Uint8Array() };

afterEach(() => {
  FakeWorker.instances = [];
  vi.useRealTimers();
});

describe('createWorkerEngine', () => {
  it('reuses one service worker for quick requests', async () => {
    const engine = engineWith((message, reply) => {
      reply({ id: message.id, type: 'result', result: { echo: message.type } as never });
    });
    await expect(engine.loadTemplate(file)).resolves.toEqual({ echo: 'load-template' });
    await expect(engine.inspectFont(file)).resolves.toEqual({ echo: 'inspect-font' });
    await engine.measure({ fields: [], fonts: [], participants: [] });
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it('turns error responses into AppError', async () => {
    const engine = engineWith((message, reply) => {
      reply({
        id: message.id,
        type: 'error',
        code: 'template-pdf-damaged',
        detail: 'x',
        message: '',
      });
    });
    await expect(engine.loadTemplate(file)).rejects.toMatchObject({
      code: 'template-pdf-damaged',
      detail: 'x',
    });
  });

  it('rejects pending requests and recreates the service worker after a crash', async () => {
    const engine = engineWith(() => undefined);
    const pending = engine.loadTemplate(file);
    await Promise.resolve();
    FakeWorker.instances[0]?.fail('script error');
    await expect(pending).rejects.toMatchObject({ code: 'worker-unavailable' });
    void engine.loadTemplate(file).catch(() => undefined);
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it('uses a fresh worker per generation, forwards progress and terminates it', async () => {
    const engine = engineWith((message, reply) => {
      if (message.type !== 'generate') return;
      reply({
        id: message.id,
        type: 'progress',
        progress: { phase: 'rendering', done: 5, total: 10, elapsedMs: 1 },
      });
      reply({ id: message.id, type: 'result', result: { ok: true } as never });
    });
    const progress = vi.fn();
    await expect(engine.generate(request, progress, new AbortController().signal)).resolves.toEqual(
      { ok: true },
    );
    expect(progress).toHaveBeenCalledWith({ phase: 'rendering', done: 5, total: 10, elapsedMs: 1 });
    expect(FakeWorker.instances[0]?.terminated).toBe(true);
  });

  it('cancels cooperatively when the worker answers in time', async () => {
    let generateId = 0;
    const engine = engineWith((message, reply) => {
      if (message.type === 'generate') generateId = message.id;
      if (message.type === 'cancel') {
        reply({
          id: generateId,
          type: 'error',
          code: 'generation-cancelled',
          detail: undefined,
          message: '',
        });
      }
    });
    const controller = new AbortController();
    const running = engine.generate(request, () => undefined, controller.signal);
    const instance = FakeWorker.instances[0];
    controller.abort();
    await expect(running).rejects.toMatchObject({ code: 'generation-cancelled' });
    expect(instance?.received.map((m) => m.type)).toEqual(['generate', 'cancel']);
    expect(instance?.terminated).toBe(true);
  });

  it('terminates the worker when it does not stop within the grace period', async () => {
    vi.useFakeTimers();
    const engine = engineWith(() => undefined);
    const controller = new AbortController();
    const running = engine.generate(request, () => undefined, controller.signal);
    controller.abort();
    const assertion = expect(running).rejects.toMatchObject({ code: 'generation-cancelled' });
    await vi.advanceTimersByTimeAsync(CANCEL_GRACE_MS + 10);
    await assertion;
    expect(FakeWorker.instances[0]?.terminated).toBe(true);
  });

  it('rejects immediately when already aborted', async () => {
    const engine = engineWith(() => undefined);
    const controller = new AbortController();
    controller.abort();
    await expect(
      engine.generate(request, () => undefined, controller.signal),
    ).rejects.toMatchObject({ code: 'generation-cancelled' });
    expect(FakeWorker.instances).toHaveLength(0);
  });
});
