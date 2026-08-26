/**
 * Anonymous playback authorize mapped through the generated OpenAPI client.
 *
 * Context headers match catalog. The app plays the returned opaque HLS URL in
 * expo-video and never embeds Bunny's web player.
 */

import { createApiClient } from '@shortform/api-client';
import type { paths } from '@shortform/api-client';

import type { CatalogPlatform } from '../catalog/types';
import type {
  ErrorEnvelope,
  PlaybackAuthorizeResponse,
  PlaybackClient,
  PlaybackRequestOutcome,
} from './types';
import { PLAYBACK_LANGUAGE } from './types';

const DEFAULT_TIMEOUT_MS = 5_000;
const UNKNOWN_CODE = 'unknown';
const UNKNOWN_MESSAGE = 'Playback request failed.';

export interface PlaybackClientOptions {
  readonly baseUrl: string;
  readonly territory: string;
  readonly platform: CatalogPlatform;
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const { data, error, response } = await perform(controller.signal);
      const envelope = readEnvelope(error ?? data);

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
    } finally {
      clearTimeout(timeout);
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
