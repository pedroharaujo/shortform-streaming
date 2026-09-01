import { bearerHeaders, createOpenApiClient } from '../context';
import { DEFAULT_TIMEOUT_MS, mapJsonDomain, mapJsonRequest } from '../http';
import type { MeClientOptions } from '../me/meClient';
import type { AccountClient, AccountOutcome } from './types';

/** P2-T02: account identity and consent timestamps always come from the server. */
export function createAccountClient(options: MeClientOptions): AccountClient {
  const api = createOpenApiClient(options);

  async function request<T>(
    perform: (
      headers: Record<string, string>,
      signal: AbortSignal,
    ) => Promise<{
      data?: T;
      error?: unknown;
      response: Response;
    }>,
    timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  ): Promise<AccountOutcome<T>> {
    const headers = bearerHeaders(options.getCredential);
    if (headers.Authorization === undefined) {
      return {
        outcome: 'unauthenticated',
        httpStatus: 401,
        code: 'authentication_required',
        message: 'Sign in to manage your account.',
      };
    }
    return mapJsonDomain(
      await mapJsonRequest(timeoutMs, 'Account request failed.', (signal) =>
        perform(headers, signal),
      ),
      { 401: 'unauthenticated' },
    );
  }

  return {
    getProfile: () => request((headers, signal) => api.GET('/v1/me', { headers, signal })),
    updatePreferences: (body) =>
      request((headers, signal) => api.PATCH('/v1/me', { headers, signal, body })),
    deleteAccount: () =>
      request(
        (headers, signal) =>
          api.POST('/v1/me/deletion', { headers, signal, body: { confirmation: true } }),
        options.timeoutMs ?? 30_000,
      ),
  };
}
