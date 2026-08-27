/**
 * Authenticated current-user client. Attaches a Firebase ID token as Bearer
 * on GET /v1/me only. Never sends a backend user id, public_id, or firebase_uid.
 */

import { createApiClient } from '@shortform/api-client';
import type { paths } from '@shortform/api-client';

import {
  DEFAULT_TIMEOUT_MS,
  UNKNOWN_CODE,
  describeFailure,
  readEnvelope,
  withTimeout,
} from '../http';
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

      try {
        const { data, error, response } = await withTimeout(timeoutMs, (signal) =>
          api.GET('/v1/me' satisfies keyof paths, {
            headers: { Authorization: `Bearer ${bearer}` },
            signal,
          }),
        );
        const envelope = readEnvelope(error ?? data, UNKNOWN_MESSAGE);
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
      }
    },
  };
}
