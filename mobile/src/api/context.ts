import { createApiClient } from '@shortform/api-client';

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
