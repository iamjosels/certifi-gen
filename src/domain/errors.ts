/**
 * Expected failures of the app. Every layer throws AppError with a code; the UI maps codes to
 * user-facing Spanish messages, so domain and infrastructure stay free of UI copy.
 */
export type AppErrorCode =
  | 'template-unsupported'
  | 'template-pdf-encrypted'
  | 'template-pdf-damaged'
  | 'template-pdf-empty'
  | 'template-image-damaged'
  | 'list-unsupported'
  | 'list-empty'
  | 'list-damaged'
  | 'list-no-columns'
  | 'font-invalid'
  | 'font-unsupported'
  | 'config-invalid'
  | 'config-version'
  | 'code-pattern-invalid'
  | 'generation-failed'
  | 'generation-cancelled'
  | 'worker-unavailable'
  | 'storage-unavailable';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly detail: string | undefined;

  constructor(code: AppErrorCode, detail?: string, options?: { cause?: unknown }) {
    super(detail ? `${code}: ${detail}` : code, options);
    this.name = 'AppError';
    this.code = code;
    this.detail = detail;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
