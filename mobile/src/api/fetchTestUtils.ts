export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  });
}

export function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.url;
  }
  return String(input);
}

export function requestHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return new Headers(input.headers);
  }
  return new Headers(init?.headers);
}

export function abortSignal(
  input: unknown,
  init?: { signal?: AbortSignal },
): AbortSignal | undefined {
  if (init?.signal !== undefined) {
    return init.signal;
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.signal;
  }
  return undefined;
}
