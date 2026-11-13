export type Ok<T> = { readonly ok: true; readonly data: T };
export type Err = { readonly ok: false; readonly error: string; readonly code: string };
export type Result<T> = Ok<T> | Err;

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}

export function err(code: string, error: string): Err {
  return { ok: false, code, error };
}

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, status = 400, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function toResult<T>(work: () => Promise<T> | T, fallbackCode = "INTERNAL_ERROR"): Promise<Result<T>> {
  try {
    return ok(await work());
  } catch (error: unknown) {
    if (error instanceof AppError) return err(error.code, error.message);
    if (error instanceof Error) return err(fallbackCode, error.message);
    return err(fallbackCode, "Terjadi kesalahan tak dikenal.");
  }
}

export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new AppError(result.code, result.error);
  return result.data;
}

export function isErr<T>(result: Result<T>): result is Err {
  return !result.ok;
}
