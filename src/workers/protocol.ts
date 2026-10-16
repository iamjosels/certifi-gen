import type {
  FontInfo,
  GenerateRequest,
  GenerationOutput,
  GenerationProgress,
  LoadedTemplate,
  MeasureRequest,
  MeasureResponse,
  RenderRequest,
  SourceFile,
} from '../application/ports';
import type { AppErrorCode } from '../domain/errors';
import type { Participant } from '../domain/participant';
import type { SizeSample } from '../domain/size-estimate';

/** Messages from the main thread to the worker. Every request has an id. */
export type WorkerRequest =
  | { readonly id: number; readonly type: 'load-template'; readonly file: SourceFile }
  | { readonly id: number; readonly type: 'inspect-font'; readonly file: SourceFile }
  | { readonly id: number; readonly type: 'measure'; readonly request: MeasureRequest }
  | {
      readonly id: number;
      readonly type: 'preview';
      readonly request: RenderRequest & { readonly participant: Participant };
    }
  | {
      readonly id: number;
      readonly type: 'estimate';
      readonly request: RenderRequest & { readonly participants: readonly Participant[] };
    }
  | { readonly id: number; readonly type: 'generate'; readonly request: GenerateRequest }
  /** Cancels the generation with this id. */
  | { readonly id: number; readonly type: 'cancel' };

export interface WorkerResults {
  readonly 'load-template': LoadedTemplate;
  readonly 'inspect-font': FontInfo;
  readonly measure: MeasureResponse;
  readonly preview: Uint8Array;
  readonly estimate: SizeSample;
  readonly generate: GenerationOutput;
}

/** Messages from the worker to the main thread. */
export type WorkerResponse =
  | {
      readonly id: number;
      readonly type: 'result';
      readonly result: WorkerResults[keyof WorkerResults];
    }
  | { readonly id: number; readonly type: 'progress'; readonly progress: GenerationProgress }
  | {
      readonly id: number;
      readonly type: 'error';
      readonly code: AppErrorCode;
      readonly detail: string | undefined;
      readonly message: string;
    };
