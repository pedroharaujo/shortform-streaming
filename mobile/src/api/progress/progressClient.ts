/**
 * Progress GET/PUT mapped through the generated OpenAPI client.
 *
 * Optional Firebase credential matches playback. Null/empty omits Authorization
 * and sends X-Device-Id. Django remains the authorizer; this client never
 * holds a playback URL on the progress resource.
 */

import type { paths } from '@shortform/api-client';

import type { CatalogPlatform } from '../catalog/types';
import { bearerHeaders, catalogContextHeaders, createOpenApiClient } from '../context';
import { DEFAULT_TIMEOUT_MS, mapJsonDomain, mapJsonRequest } from '../http';
import type {
  ProgressClient,
  ProgressRequestOutcome,
  WatchProgress,
  WatchProgressWrite,
} from './types';

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

export function createProgressClient(options: ProgressClientOptions): ProgressClient {
  const { baseUrl, territory, platform, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const contextHeaders = catalogContextHeaders(territory, platform);
  const api = createOpenApiClient({
    baseUrl,
    headers: { ...contextHeaders },
    fetchImplementation: options.fetchImplementation,
  });

  async function requestAuth(): Promise<{
    readonly header: typeof contextHeaders & { readonly 'X-Device-Id'?: string };
    readonly headers: Record<string, string>;
  }> {
    const authorization = bearerHeaders(options.getCredential);
    if (authorization.Authorization !== undefined) {
      return { header: contextHeaders, headers: authorization };
    }
    const deviceId = await options.getDeviceId();
    return {
      header: { ...contextHeaders, 'X-Device-Id': deviceId },
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
