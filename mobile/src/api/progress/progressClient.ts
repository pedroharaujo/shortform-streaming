/**
 * Progress GET/PUT mapped through the generated OpenAPI client.
 *
 * Optional Firebase credential matches playback. Null/empty omits Authorization
 * and sends X-Device-Id. Django remains the authorizer; this client never
 * holds a playback URL on the progress resource.
 */

import type { paths } from '@stovio/api-client';

import { bearerHeaders, createOpenApiClient } from '../context';
import { DEFAULT_TIMEOUT_MS, mapJsonDomain, mapJsonRequest } from '../http';
import type {
  ContinueWatching,
  ContinueWatchingOutcome,
  ProgressClient,
  ProgressRequestOutcome,
  WatchProgress,
  WatchProgressWrite,
} from './types';

const UNKNOWN_MESSAGE = 'Progress request failed.';
const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isContinueItem(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const keys = [
    'series_id',
    'series_title',
    'artwork_url',
    'episode_id',
    'episode_title',
    'episode_order',
    'position_seconds',
    'duration_seconds',
  ];
  return (
    Object.keys(value).every((key) => keys.includes(key)) &&
    keys.every((key) => key in value) &&
    typeof value.series_id === 'string' &&
    PUBLIC_ID_PATTERN.test(value.series_id) &&
    typeof value.series_title === 'string' &&
    (value.artwork_url === null || typeof value.artwork_url === 'string') &&
    typeof value.episode_id === 'string' &&
    PUBLIC_ID_PATTERN.test(value.episode_id) &&
    typeof value.episode_title === 'string' &&
    typeof value.episode_order === 'number' &&
    Number.isSafeInteger(value.episode_order) &&
    value.episode_order >= 1 &&
    typeof value.position_seconds === 'number' &&
    Number.isSafeInteger(value.position_seconds) &&
    value.position_seconds >= 0 &&
    typeof value.duration_seconds === 'number' &&
    Number.isSafeInteger(value.duration_seconds) &&
    value.duration_seconds >= 0
  );
}

function isContinueWatching(value: unknown): value is ContinueWatching {
  return isRecord(value) && Array.isArray(value.items) && value.items.every(isContinueItem);
}

export interface ProgressClientOptions {
  readonly baseUrl: string;
  readonly getDeviceId: () => Promise<string>;
  readonly getCredential?: () => string | null;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
}

export function createProgressClient(options: ProgressClientOptions): ProgressClient {
  const { baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const api = createOpenApiClient({
    baseUrl,
    fetchImplementation: options.fetchImplementation,
  });

  async function requestAuth(): Promise<{
    readonly header: { readonly 'X-Device-Id'?: string };
    readonly headers: Record<string, string>;
  }> {
    const authorization = bearerHeaders(options.getCredential);
    if (authorization.Authorization !== undefined) {
      return { header: {}, headers: authorization };
    }
    const deviceId = await options.getDeviceId();
    return {
      header: { 'X-Device-Id': deviceId },
      headers: { 'X-Device-Id': deviceId },
    };
  }

  async function request(
    perform: (
      auth: Awaited<ReturnType<typeof requestAuth>>,
      signal: AbortSignal,
    ) => Promise<{ data?: WatchProgress; error?: unknown; response: Response }>,
  ): Promise<ProgressRequestOutcome> {
    const auth = await requestAuth();
    const result = await mapJsonRequest<WatchProgress>(timeoutMs, UNKNOWN_MESSAGE, (signal) =>
      perform(auth, signal),
    );
    return mapJsonDomain(result, { 401: 'unauthenticated', 403: 'locked', 404: 'not-found' });
  }

  return {
    async listContinue() {
      const auth = await requestAuth();
      const result = await mapJsonRequest<ContinueWatching>(timeoutMs, UNKNOWN_MESSAGE, (signal) =>
        api.GET('/v1/progress/continue', {
          params: { header: auth.header },
          headers: auth.headers,
          signal,
        }),
      );
      const mapped: ContinueWatchingOutcome = mapJsonDomain(result, { 401: 'unauthenticated' });
      if (mapped.outcome !== 'ok' || isContinueWatching(mapped.data)) return mapped;
      return {
        outcome: 'error',
        httpStatus: 200,
        code: 'invalid_response',
        message: UNKNOWN_MESSAGE,
      };
    },
    get(episodeId: string) {
      return request((auth, signal) =>
        api.GET('/v1/progress/{episode_id}' satisfies keyof paths, {
          params: { path: { episode_id: episodeId }, header: auth.header },
          headers: auth.headers,
          signal,
        }),
      );
    },
    put(episodeId: string, body: WatchProgressWrite) {
      return request((auth, signal) =>
        api.PUT('/v1/progress/{episode_id}' satisfies keyof paths, {
          params: { path: { episode_id: episodeId }, header: auth.header },
          headers: auth.headers,
          body: { position_seconds: body.position_seconds, completed: body.completed ?? false },
          signal,
        }),
      );
    },
  };
}
