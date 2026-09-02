export const APP_CHECK_HEADER = 'X-Firebase-AppCheck';
const APP_CHECK_TOKEN_MAX_LENGTH = 4096;

export type GetAppCheckToken = () => Promise<string>;

function isSafeToken(token: string): boolean {
  return (
    token.length > 0 && token.length <= APP_CHECK_TOKEN_MAX_LENGTH && /^[\x21-\x7e]+$/.test(token)
  );
}

/** Attach an ephemeral App Check token to one backend request.
 *
 * The token is requested on demand, never stored by application code, and a
 * failure stops the request instead of silently reaching an enforced backend.
 */
export function createAppCheckFetch(
  getAppCheckToken: GetAppCheckToken,
  fetchImplementation: typeof fetch = globalThis.fetch,
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let token: string;
    try {
      token = await getAppCheckToken();
    } catch {
      throw new Error('App verification is unavailable.');
    }
    if (!isSafeToken(token)) {
      throw new Error('App verification is unavailable.');
    }

    const inputRequest =
      typeof Request !== 'undefined' && input instanceof Request ? input : undefined;
    const headers = new Headers(inputRequest?.headers);
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
    headers.set(APP_CHECK_HEADER, token);

    if (inputRequest !== undefined) {
      return fetchImplementation(new Request(inputRequest, { ...init, headers }));
    }
    return fetchImplementation(input, { ...init, headers });
  };
}
