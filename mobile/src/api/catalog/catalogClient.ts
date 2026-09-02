/**
 * Anonymous catalog reads mapped through the generated OpenAPI client.
 */

import type { paths } from '@shortform/api-client';

import { createOpenApiClient } from '../context';
import { DEFAULT_TIMEOUT_MS, mapJsonDomain, mapJsonRequest } from '../http';
import type {
  CatalogClient,
  CatalogEpisodeDetail,
  CatalogHome,
  CatalogRequestOutcome,
  CatalogSeriesDetail,
} from './types';

const UNKNOWN_MESSAGE = 'Catalog request failed.';

export interface CatalogClientOptions {
  readonly baseUrl: string;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
}

export function createCatalogClient(options: CatalogClientOptions): CatalogClient {
  const { baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const api = createOpenApiClient({
    baseUrl,
    fetchImplementation: options.fetchImplementation,
  });

  function request<T>(
    perform: (signal: AbortSignal) => Promise<{
      data?: T;
      error?: unknown;
      response: Response;
    }>,
  ): Promise<CatalogRequestOutcome<T>> {
    return mapJsonRequest(timeoutMs, UNKNOWN_MESSAGE, perform).then((result) =>
      mapJsonDomain(result, { 404: 'not-found' }),
    );
  }

  return {
    getHome() {
      return request<CatalogHome>((signal) =>
        api.GET('/v1/catalog/home' satisfies keyof paths, {
          signal,
        }),
      );
    },
    getSeries(publicId: string) {
      return request<CatalogSeriesDetail>((signal) =>
        api.GET('/v1/series/{public_id}' satisfies keyof paths, {
          params: { path: { public_id: publicId } },
          signal,
        }),
      );
    },
    getEpisode(publicId: string) {
      return request<CatalogEpisodeDetail>((signal) =>
        api.GET('/v1/episodes/{public_id}' satisfies keyof paths, {
          params: { path: { public_id: publicId } },
          signal,
        }),
      );
    },
  };
}
