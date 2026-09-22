/**
 * Authenticated current-user client. Attaches a Firebase ID token as Bearer
 * on GET /v1/me only. Never sends a backend user id, public_id, or firebase_uid.
 */

import type { paths } from '@shortform/api-client';

import { bearerHeaders, createOpenApiClient } from '../context';
import { DEFAULT_TIMEOUT_MS, mapJsonDomain, mapJsonRequest } from '../http';
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
  const api = createOpenApiClient({
    baseUrl,
    fetchImplementation: options.fetchImplementation,
  });

  return {
    async getMe(): Promise<MeRequestOutcome> {
      const headers = bearerHeaders(getCredential);
      if (headers.Authorization === undefined) {
        return {
          outcome: 'unauthenticated',
          httpStatus: 401,
          code: 'authentication_required',
          message: 'Authentication is required.',
        };
      }

      return mapJsonDomain(
        await mapJsonRequest<CurrentUserProfile>(timeoutMs, UNKNOWN_MESSAGE, (signal) =>
          api.GET('/v1/me' satisfies keyof paths, { headers, signal }),
        ),
        { 401: 'unauthenticated' },
      );
    },
  };
}
