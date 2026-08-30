/**
 * Catalog context sent on Android ads-only requests (D-002, D-027).
 * Territory comes from public config. Language is frozen to English.
 * Platform is android. Never inferred from Accept-Language or device locale.
 */

import { createApiClient } from '@shortform/api-client';

import type { CatalogPlatform } from './catalog/types';

export const API_LANGUAGE = 'en';

/** Ads-only shipping client (D-027). The API still accepts `ios`. */
export const MVP_CLIENT_PLATFORM: CatalogPlatform = 'android';

export function catalogContextHeaders(
  territory: string,
  platform: CatalogPlatform = MVP_CLIENT_PLATFORM,
): {
  readonly 'X-Language': typeof API_LANGUAGE;
  readonly 'X-Platform': CatalogPlatform;
  readonly 'X-Territory': string;
} {
  return {
    'X-Language': API_LANGUAGE,
    'X-Platform': platform,
    'X-Territory': territory,
  };
}

export function createOpenApiClient(options: {
  readonly baseUrl: string;
  readonly headers?: Record<string, string> | undefined;
  readonly fetchImplementation?: typeof fetch | undefined;
}): ReturnType<typeof createApiClient> {
  return createApiClient({
    baseUrl: options.baseUrl,
    ...(options.headers === undefined ? {} : { headers: options.headers }),
    ...(options.fetchImplementation === undefined ? {} : { fetch: options.fetchImplementation }),
  });
}

export function bearerHeaders(getCredential?: () => string | null): Record<string, string> {
  const bearer = getCredential === undefined ? null : getCredential();
  if (bearer === null || bearer === '') {
    return {};
  }
  return { Authorization: `Bearer ${bearer}` };
}
