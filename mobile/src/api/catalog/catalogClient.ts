/**
 * Anonymous catalog reads mapped through the generated OpenAPI client.
 *
 * Context headers are explicit: X-Territory from public config, X-Language
 * frozen to English (D-002), X-Platform from the native OS. They are never
 * taken from Accept-Language or device locale. Catalog calls are unauthenticated.
 */

import { createApiClient } from '@shortform/api-client';
import type { paths } from '@shortform/api-client';

import { DEFAULT_TIMEOUT_MS, mapJsonRequest } from '../http';
import type {
  CatalogClient,
  CatalogEpisodeDetail,
  CatalogHome,
  CatalogPlatform,
  CatalogRequestOutcome,
  CatalogSeriesDetail,
} from './types';
import { CATALOG_LANGUAGE, CatalogPlatformError } from './types';

const UNKNOWN_MESSAGE = 'Catalog request failed.';

export interface CatalogClientOptions {
  readonly baseUrl: string;
  readonly territory: string;
  readonly platform: CatalogPlatform;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
}

export function resolveCatalogPlatform(os: string): CatalogPlatform {
  if (os === 'ios' || os === 'android') {
    return os;
  }
  throw new CatalogPlatformError(
    `Catalog requests require ios or android; received ${JSON.stringify(os)}.`,
  );
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
    return {
      outcome: 'error',
      httpStatus: result.status,
      code: result.envelope.code,
      message: result.envelope.message,
    };
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
