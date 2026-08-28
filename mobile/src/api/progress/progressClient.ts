/**
 * Progress GET/PUT mapped through the generated OpenAPI client.
 *
 * Optional Firebase credential matches playback. Null/empty omits Authorization
 * and sends X-Device-Id. Django remains the authorizer; this client never
 * holds a playback URL on the progress resource.
 */

import { createApiClient } from '@shortform/api-client';
import type { paths } from '@shortform/api-client';

import type { CatalogPlatform } from '../catalog/types';
import { DEFAULT_TIMEOUT_MS, mapJsonRequest } from '../http';
import type {
  ProgressClient,
  ProgressRequestOutcome,
  WatchProgress,
  WatchProgressWrite,
} from './types';
import { PROGRESS_LANGUAGE } from './types';

const UNKNOWN_MESSAGE = 'Progress request failed.';

export interface ProgressClientOptions {
  readonly baseUrl: string;
  readonly territory: string;
  readonly platform: CatalogPlatform;
  readonly getDeviceId: () => Promise<string>;
  readonly getCredential?: () => string | null;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
}

function mapOutcome(
  result: Awaited<ReturnType<typeof mapJsonRequest<WatchProgress>>>,
): ProgressRequestOutcome {
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
  if (result.status === 403) {
    return {
      outcome: 'locked',
      httpStatus: 403,
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
  return {
    outcome: 'error',
    httpStatus: result.status,
    code: result.envelope.code,
    message: result.envelope.message,
  };
}

export function createProgressClient(options: ProgressClientOptions): ProgressClient {
  const { baseUrl, territory, platform, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const contextHeaders = {
    'X-Language': PROGRESS_LANGUAGE,
    'X-Platform': platform,
    'X-Territory': territory,
  } as const;

  const api = createApiClient({
    baseUrl,
    headers: contextHeaders,
    ...(options.fetchImplementation === undefined ? {} : { fetch: options.fetchImplementation }),
  });

  async function requestAuth(): Promise<{
    readonly header: typeof contextHeaders & { readonly 'X-Device-Id'?: string };
    readonly headers: Record<string, string>;
  }> {
    const bearer = options.getCredential === undefined ? null : options.getCredential();
    if (bearer !== null && bearer !== '') {
      return { header: contextHeaders, headers: { Authorization: `Bearer ${bearer}` } };
    }
    const deviceId = await options.getDeviceId();
    return {
      header: { ...contextHeaders, 'X-Device-Id': deviceId },
      headers: { 'X-Device-Id': deviceId },
    };
  }

  return {
    async get(episodeId: string): Promise<ProgressRequestOutcome> {
      const auth = await requestAuth();
      const result = await mapJsonRequest<WatchProgress>(timeoutMs, UNKNOWN_MESSAGE, (signal) =>
        api.GET('/v1/progress/{episode_id}' satisfies keyof paths, {
          params: { path: { episode_id: episodeId }, header: auth.header },
          headers: auth.headers,
          signal,
        }),
      );
      return mapOutcome(result);
    },
    async put(episodeId: string, body: WatchProgressWrite): Promise<ProgressRequestOutcome> {
      const auth = await requestAuth();
      const result = await mapJsonRequest<WatchProgress>(timeoutMs, UNKNOWN_MESSAGE, (signal) =>
        api.PUT('/v1/progress/{episode_id}' satisfies keyof paths, {
          params: { path: { episode_id: episodeId }, header: auth.header },
          headers: auth.headers,
          body: { position_seconds: body.position_seconds, completed: body.completed ?? false },
          signal,
        }),
      );
      return mapOutcome(result);
    },
  };
}
