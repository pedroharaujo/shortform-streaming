/**
 * Anonymous playback authorize mapped through the generated OpenAPI client.
 *
 * Context headers match catalog. The app plays the returned opaque HLS URL in
 * expo-video and never embeds Bunny's web player.
 */

import { createApiClient } from '@shortform/api-client';
import type { paths } from '@shortform/api-client';

import type { CatalogPlatform } from '../catalog/types';
import {
  DEFAULT_TIMEOUT_MS,
  UNKNOWN_CODE,
  describeFailure,
  readEnvelope,
  withTimeout,
} from '../http';
import type {
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
    try {
      const { data, error, response } = await withTimeout(timeoutMs, perform);
      const envelope = readEnvelope(error ?? data, UNKNOWN_MESSAGE);

      if (response.status === 404) {
        return {
          outcome: 'not-found',
          httpStatus: 404,
          code: envelope.code,
          message: envelope.message,
        };
      }
      if (response.status === 503) {
        return {
          outcome: 'unavailable',
          httpStatus: 503,
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
      return { outcome: 'ok', data };
    } catch (caught: unknown) {
      return { outcome: 'unreachable', reason: describeFailure(caught) };
    }
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
