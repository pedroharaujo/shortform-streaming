/**
 * Anonymous catalog reads mapped through the generated OpenAPI client.
 *
 * Context headers are explicit: X-Territory from public config, X-Language
 * frozen to English (D-002), X-Platform from the native OS. They are never
 * taken from Accept-Language or device locale. Catalog calls are unauthenticated.
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
import type {
  CatalogClient,
  CatalogEpisodeDetail,
  CatalogHome,
  CatalogPlatform,
  CatalogRequestOutcome,
  CatalogSeriesDetail,
} from './types';
import { CATALOG_LANGUAGE } from './types';

const UNKNOWN_MESSAGE = 'Catalog request failed.';

export interface CatalogClientOptions {
  readonly baseUrl: string;
  readonly territory: string;
  readonly platform: CatalogPlatform;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
}

export function createCatalogClient(options: CatalogClientOptions): CatalogClient {
  const { baseUrl, territory, platform, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const contextHeaders = {
    'X-Language': CATALOG_LANGUAGE,
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
  ): Promise<CatalogRequestOutcome<T>> {
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
    getHome() {
      return request<CatalogHome>((signal) =>
        api.GET('/v1/catalog/home' satisfies keyof paths, {
          params: { header: contextHeaders },
          signal,
        }),
      );
    },
    getSeries(publicId: string) {
      return request<CatalogSeriesDetail>((signal) =>
        api.GET('/v1/series/{public_id}' satisfies keyof paths, {
          params: { path: { public_id: publicId }, header: contextHeaders },
          signal,
        }),
      );
    },
    getEpisode(publicId: string) {
      return request<CatalogEpisodeDetail>((signal) =>
        api.GET('/v1/episodes/{public_id}' satisfies keyof paths, {
          params: { path: { public_id: publicId }, header: contextHeaders },
          signal,
        }),
      );
    },
  };
}
