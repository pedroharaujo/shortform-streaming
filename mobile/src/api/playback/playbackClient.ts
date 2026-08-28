/**
 * Anonymous playback authorize mapped through the generated OpenAPI client.
 *
 * Context headers match catalog. The app plays the returned opaque HLS URL in
 * expo-video and never embeds Bunny's web player.
 */

import { createApiClient } from '@shortform/api-client';
import type { paths } from '@shortform/api-client';

import type { CatalogPlatform } from '../catalog/types';
import { DEFAULT_TIMEOUT_MS, mapJsonRequest } from '../http';
import type { PlaybackAuthorizeResponse, PlaybackClient, PlaybackRequestOutcome } from './types';
import { PLAYBACK_LANGUAGE } from './types';

const UNKNOWN_MESSAGE = 'Playback request failed.';

export interface PlaybackClientOptions {
  readonly baseUrl: string;
  readonly territory: string;
  readonly platform: CatalogPlatform;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
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

  async function request<T>(
    perform: (signal: AbortSignal) => Promise<{
      data?: T;
      error?: unknown;
      response: Response;
    }>,
  ): Promise<PlaybackRequestOutcome<T>> {
    const result = await mapJsonRequest(timeoutMs, UNKNOWN_MESSAGE, perform);
    if (result.outcome === 'ok') {
      return { outcome: 'ok', data: result.data };
    }
    if (result.outcome === 'unreachable') {
      return { outcome: 'unreachable', reason: result.reason };
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
  }

  return {
    authorize(episodeId: string) {
      return request<PlaybackAuthorizeResponse>((signal) =>
        api.POST('/v1/playback/{episode_id}/authorize' satisfies keyof paths, {
          params: { path: { episode_id: episodeId }, header: contextHeaders },
          signal,
        }),
      );
    },
  };
}
