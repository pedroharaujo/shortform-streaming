/**
 * Playback authorize mapped through the generated OpenAPI client.
 *
 * Optional Firebase credential matches meClient. Null/empty omits Authorization.
 * HTTP 200 is narrowed on `decision`. Django remains the authorizer; this client
 * never holds Bunny keys.
 */

import { createApiClient } from '@shortform/api-client';
import type { paths } from '@shortform/api-client';

import type { CatalogPlatform } from '../catalog/types';
import { DEFAULT_TIMEOUT_MS, mapJsonRequest } from '../http';
import type {
  PlaybackAuthorizeGranted,
  PlaybackAuthorizeResponse,
  PlaybackClient,
  PlaybackRequestOutcome,
} from './types';
import { PLAYBACK_LANGUAGE } from './types';

const UNKNOWN_MESSAGE = 'Playback request failed.';

export interface PlaybackClientOptions {
  readonly baseUrl: string;
  readonly territory: string;
  readonly platform: CatalogPlatform;
  readonly getCredential?: () => string | null;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
}

function isGranted(body: PlaybackAuthorizeResponse): body is PlaybackAuthorizeGranted {
  return body.decision === 'granted';
}

export function createPlaybackClient(options: PlaybackClientOptions): PlaybackClient {
  const { baseUrl, territory, platform, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const contextHeaders = {
    'X-Language': PLAYBACK_LANGUAGE,
    'X-Platform': platform,
    'X-Territory': territory,
  } as const;

  const api = createApiClient({
    baseUrl,
    headers: contextHeaders,
    ...(options.fetchImplementation === undefined ? {} : { fetch: options.fetchImplementation }),
  });

  return {
    async authorize(episodeId: string): Promise<PlaybackRequestOutcome> {
      const bearer = options.getCredential === undefined ? null : options.getCredential();
      const authorizationHeaders =
        bearer === null || bearer === '' ? {} : { Authorization: `Bearer ${bearer}` };

      const result = await mapJsonRequest<PlaybackAuthorizeResponse>(
        timeoutMs,
        UNKNOWN_MESSAGE,
        (signal) =>
          api.POST('/v1/playback/{episode_id}/authorize' satisfies keyof paths, {
            params: { path: { episode_id: episodeId }, header: contextHeaders },
            headers: authorizationHeaders,
            signal,
          }),
      );
      if (result.outcome === 'ok') {
        const body = result.data;
        if (isGranted(body) && body.playback_url !== '') {
          return { outcome: 'ok', data: body };
        }
        if (body.decision === 'locked') {
          return { outcome: 'locked', lockReasons: body.lock_reasons };
        }
        return {
          outcome: 'error',
          httpStatus: 200,
          code: 'unknown',
          message: UNKNOWN_MESSAGE,
        };
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
      if (result.status === 404) {
        return {
          outcome: 'not-found',
          httpStatus: 404,
          code: result.envelope.code,
          message: result.envelope.message,
        };
      }
      if (result.status === 503) {
        return {
          outcome: 'unavailable',
          httpStatus: 503,
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
