/**
 * Shared timeout, envelope, and failure helpers for OpenAPI fetch wrappers.
 *
 * Domain outcome unions stay in each client. This module does not unify
 * catalog, playback, me, or health mapping.
 */

export const DEFAULT_TIMEOUT_MS = 5_000;
export const UNKNOWN_CODE = 'unknown';

export function describeFailure(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') {
    return 'timeout';
  }
  if (error instanceof Error && error.message !== '') {
    return error.message;
  }
  return 'network request failed';
}

export function readEnvelope(
  payload: unknown,
  fallbackMessage: string,
): { code: string; message: string } {
  if (typeof payload === 'object' && payload !== null) {
    const { code, message } = payload as { code?: unknown; message?: unknown };
    return {
      code: typeof code === 'string' && code !== '' ? code : UNKNOWN_CODE,
      message: typeof message === 'string' && message !== '' ? message : fallbackMessage,
    };
  }
  return { code: UNKNOWN_CODE, message: fallbackMessage };
}

export async function withTimeout<T>(
  timeoutMs: number,
  perform: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await perform(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}
