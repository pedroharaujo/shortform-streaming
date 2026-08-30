/**
 * Playback authorize mapped through the generated OpenAPI client.
 *
 * Optional Firebase credential matches meClient. Null/empty omits Authorization.
 * HTTP 200 is narrowed on `decision`. Django remains the authorizer; this client
 * never holds Bunny keys.
 */

import type { paths } from '@shortform/api-client';

import type { CatalogPlatform } from '../catalog/types';
import { bearerHeaders, catalogContextHeaders, createOpenApiClient } from '../context';
import { DEFAULT_TIMEOUT_MS, mapJsonDomain, mapJsonRequest } from '../http';
import type {
  PlaybackAuthorizeGranted,
  PlaybackAuthorizeResponse,
  PlaybackClient,
  PlaybackRequestOutcome,
} from './types';

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
  const contextHeaders = catalogContextHeaders(territory, platform);
  const api = createOpenApiClient({
    baseUrl,
    headers: { ...contextHeaders },
    fetchImplementation: options.fetchImplementation,
  });

  return {
    async authorize(episodeId: string): Promise<PlaybackRequestOutcome> {
      const result = await mapJsonRequest<PlaybackAuthorizeResponse>(
        timeoutMs,
        UNKNOWN_MESSAGE,
        (signal) =>
          api.POST('/v1/playback/{episode_id}/authorize' satisfies keyof paths, {
            params: { path: { episode_id: episodeId }, header: contextHeaders },
            headers: bearerHeaders(options.getCredential),
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
        return { outcome: 'error', httpStatus: 200, code: 'unknown', message: UNKNOWN_MESSAGE };
      }
      return mapJsonDomain(result, {
        401: 'unauthenticated',
        404: 'not-found',
        503: 'unavailable',
      });
    },
  };
}
