/**
 * Authenticated current-user client. Attaches a Firebase ID token as Bearer
 * on GET /v1/me only. Never sends a backend user id, public_id, or firebase_uid.
 */

import { createApiClient } from '@shortform/api-client';
import type { paths } from '@shortform/api-client';

import { DEFAULT_TIMEOUT_MS, mapJsonRequest } from '../http';
import type { CurrentUserProfile, MeClient, MeRequestOutcome } from './types';

const UNKNOWN_MESSAGE = 'Account request failed.';

export interface MeClientOptions {
  readonly baseUrl: string;
  readonly getCredential: () => string | null;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
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

      const result = await mapJsonRequest<CurrentUserProfile>(
        timeoutMs,
        UNKNOWN_MESSAGE,
        (signal) =>
          api.GET('/v1/me' satisfies keyof paths, {
            headers: { Authorization: `Bearer ${bearer}` },
            signal,
          }),
      );
      if (result.outcome === 'ok') {
        return { outcome: 'ok', data: result.data };
      }
      if (result.outcome === 'unreachable') {
        return { outcome: 'unreachable', reason: result.reason };
      }
      if (result.status === 401) {
        return {
          outcome: 'unauthenticated',
          httpStatus: 401,
          code: result.envelope.code,
          message: result.envelope.message,
        };
      }
      return {
        outcome: 'error',
        httpStatus: result.status,
        code: result.envelope.code,
        message: result.envelope.message,
      };
    },
  };
}
