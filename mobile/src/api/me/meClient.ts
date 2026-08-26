/**
 * Authenticated current-user client. Attaches a Firebase ID token as Bearer
 * on GET /v1/me only. Never sends a backend user id, public_id, or firebase_uid.
 */

import { createApiClient } from '@shortform/api-client';
import type { paths } from '@shortform/api-client';

import type { CurrentUserProfile, ErrorEnvelope, MeClient, MeRequestOutcome } from './types';

const DEFAULT_TIMEOUT_MS = 5_000;
const UNKNOWN_CODE = 'unknown';
const UNKNOWN_MESSAGE = 'Account request failed.';

export interface MeClientOptions {
  readonly baseUrl: string;
  readonly getCredential: () => string | null;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
}

function describeFailure(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') {
    return 'timeout';
  }
  if (error instanceof Error && error.message !== '') {
    return error.message;
  }
  return 'network request failed';
}

function readEnvelope(payload: unknown): Pick<ErrorEnvelope, 'code' | 'message'> {
  if (typeof payload === 'object' && payload !== null) {
    const { code, message } = payload as Partial<ErrorEnvelope>;
    return {
      code: typeof code === 'string' && code !== '' ? code : UNKNOWN_CODE,
      message: typeof message === 'string' && message !== '' ? message : UNKNOWN_MESSAGE,
    };
  }
  return { code: UNKNOWN_CODE, message: UNKNOWN_MESSAGE };
}

export function createMeClient(options: MeClientOptions): MeClient {
  const { baseUrl, getCredential, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const api = createApiClient({
    baseUrl,
    ...(options.fetchImplementation === undefined ? {} : { fetch: options.fetchImplementation }),
  });

  return {
    async getMe(): Promise<MeRequestOutcome> {
      const bearer = getCredential();
      if (bearer === null || bearer === '') {
        return {
          outcome: 'unauthenticated',
          httpStatus: 401,
          code: 'authentication_required',
          message: 'Authentication is required.',
        };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const { data, error, response } = await api.GET('/v1/me' satisfies keyof paths, {
          headers: { Authorization: `Bearer ${bearer}` },
          signal: controller.signal,
        });
        const envelope = readEnvelope(error ?? data);
        if (response.status === 401) {
          return {
            outcome: 'unauthenticated',
            httpStatus: 401,
            code: envelope.code,
            message: envelope.message,
          };
        }
        if (!response.ok) {
          return {
            outcome: 'error',
            httpStatus: response.status,
            code: envelope.code,
            message: envelope.message,
          };
        }
        if (data === undefined) {
          return {
            outcome: 'error',
            httpStatus: response.status,
            code: UNKNOWN_CODE,
            message: UNKNOWN_MESSAGE,
          };
        }
        return { outcome: 'ok', data: data as CurrentUserProfile };
      } catch (caught: unknown) {
        return { outcome: 'unreachable', reason: describeFailure(caught) };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
