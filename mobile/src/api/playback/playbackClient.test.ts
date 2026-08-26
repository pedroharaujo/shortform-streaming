import { createPlaybackClient } from './playbackClient';

const BASE_URL = 'http://10.0.2.2:8000';
const TERRITORY = 'FR';
const PLATFORM = 'android' as const;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  });
}

function requestUrl(input: RequestInfo | URL): string {
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

function requestHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return new Headers(input.headers);
  }
  return new Headers(init?.headers);
}

describe('createPlaybackClient', () => {
  it('posts authorize with catalog context headers and no Authorization', async () => {
    const performRequest = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(
        {
          playback_url: 'https://video.example.test/hls/a/playlist.m3u8',
          expires_at: '2026-08-25T12:10:00Z',
        },
        200,
      ),
    );
    const client = createPlaybackClient({
      baseUrl: BASE_URL,
      territory: TERRITORY,
      platform: PLATFORM,
      fetchImplementation: performRequest as unknown as typeof fetch,
    });

    const result = await client.authorize('ep_harbor_1');

    expect(result.outcome).toBe('ok');
    expect(performRequest).toHaveBeenCalled();
    const [input, init] = performRequest.mock.calls[0] ?? [];
    expect(input).toBeDefined();
    expect(requestUrl(input as RequestInfo | URL)).toContain('/v1/playback/ep_harbor_1/authorize');
    const headers = requestHeaders(input as RequestInfo | URL, init);
    expect(headers.get('X-Territory')).toBe('FR');
    expect(headers.get('X-Platform')).toBe('android');
    expect(headers.get('X-Language')).toBe('en');
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('Accept-Language')).toBeNull();
  });

  it('maps 404 and 503 without treating them as success', async () => {
    const missing = jest.fn(async () =>
      jsonResponse({ code: 'not_found', message: 'Resource not found.', request_id: 'r1' }, 404),
    );
    const unavailable = jest.fn(async () =>
      jsonResponse(
        {
          code: 'playback_unavailable',
          message: 'Playback is temporarily unavailable.',
          request_id: 'r2',
        },
        503,
      ),
    );
    const missingClient = createPlaybackClient({
      baseUrl: BASE_URL,
      territory: TERRITORY,
      platform: PLATFORM,
      fetchImplementation: missing as unknown as typeof fetch,
    });
    const unavailableClient = createPlaybackClient({
      baseUrl: BASE_URL,
      territory: TERRITORY,
      platform: PLATFORM,
      fetchImplementation: unavailable as unknown as typeof fetch,
    });

    const notFound = await missingClient.authorize('ep_missing');
    const down = await unavailableClient.authorize('ep_harbor_1');
    expect(notFound.outcome).toBe('not-found');
    expect(down.outcome).toBe('unavailable');
  });
});
