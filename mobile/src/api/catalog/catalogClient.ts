/**
 * Anonymous catalog reads mapped through the generated OpenAPI client.
 *
 * Context headers are explicit: X-Territory from public config, X-Language
 * frozen to English (D-002), X-Platform from the native OS. They are never
 * taken from Accept-Language or device locale. Catalog calls are unauthenticated.
 */

import { createApiClient } from '@shortform/api-client';
import type { paths } from '@shortform/api-client';

import type {
  CatalogClient,
  CatalogEpisodeDetail,
  CatalogHome,
  CatalogPlatform,
  CatalogRequestOutcome,
  CatalogSeriesDetail,
  ErrorEnvelope,
} from './types';
import { CATALOG_LANGUAGE } from './types';

const DEFAULT_TIMEOUT_MS = 5_000;
const UNKNOWN_CODE = 'unknown';
const UNKNOWN_MESSAGE = 'Catalog request failed.';

export interface CatalogClientOptions {
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
