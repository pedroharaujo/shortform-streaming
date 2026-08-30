/**
 * Shared timeout, envelope, and HTTP-status mapping for OpenAPI fetch wrappers.
 * Domain outcome unions stay in each client.
 */

import type { EnvelopeOutcome, UnreachableOutcome } from './outcomes';

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

export type JsonRequestResult<T> =
  | { readonly outcome: 'ok'; readonly data: T }
  | {
      readonly outcome: 'http';
      readonly status: number;
      readonly envelope: { readonly code: string; readonly message: string };
    }
  | UnreachableOutcome;

export async function mapJsonRequest<T>(
  timeoutMs: number,
  fallbackMessage: string,
  perform: (signal: AbortSignal) => Promise<{
    data?: T;
    error?: unknown;
    response: Response;
  }>,
): Promise<JsonRequestResult<T>> {
  try {
    const { data, error, response } = await withTimeout(timeoutMs, perform);
    if (!response.ok) {
      return {
        outcome: 'http',
        status: response.status,
        envelope: readEnvelope(error ?? data, fallbackMessage),
      };
    }
    if (data === undefined) {
      return {
        outcome: 'http',
        status: response.status,
        envelope: { code: UNKNOWN_CODE, message: fallbackMessage },
      };
    }
    return { outcome: 'ok', data };
  } catch (caught: unknown) {
    return { outcome: 'unreachable', reason: describeFailure(caught) };
  }
}

export function mapJsonDomain<T, TStatus extends string>(
  result: JsonRequestResult<T>,
  byStatus: Readonly<Partial<Record<number, TStatus>>>,
):
  | { readonly outcome: 'ok'; readonly data: T }
  | UnreachableOutcome
  | EnvelopeOutcome<TStatus | 'error'> {
  if (result.outcome === 'ok' || result.outcome === 'unreachable') {
    return result;
  }
  return {
    outcome: byStatus[result.status] ?? 'error',
    httpStatus: result.status,
    code: result.envelope.code,
    message: result.envelope.message,
  };
}
