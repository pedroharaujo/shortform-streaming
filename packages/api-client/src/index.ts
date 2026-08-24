/**
 * Typed fetch client for the Shortform Streaming API.
 *
 * Files under `./generated` are produced by `pnpm contract:generate`.
 * Do not edit generated output by hand.
 */
import createClient from 'openapi-fetch';

import type { components, paths } from './generated/schema';

export type { components, paths };

export type ApiClient = ReturnType<typeof createApiClient>;

export interface ApiClientOptions {
  readonly baseUrl: string;
  readonly fetch?: typeof fetch;
  readonly headers?: HeadersInit;
}

export function createApiClient(options: ApiClientOptions): ReturnType<typeof createClient<paths>> {
  return createClient<paths>({
    baseUrl: options.baseUrl,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.headers === undefined ? {} : { headers: options.headers }),
  });
}
