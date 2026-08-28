import { jsonResponse, requestHeaders, requestUrl } from '../fetchTestUtils';
import { createPlaybackClient } from './playbackClient';

const BASE_URL = 'http://10.0.2.2:8000';
const TERRITORY = 'FR';
const PLATFORM = 'android' as const;

describe('createPlaybackClient', () => {
  it('posts authorize with catalog context headers and no Authorization', async () => {
    const performRequest = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(
        {
          decision: 'granted',
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

  it('attaches Bearer when getCredential returns a token', async () => {
    const performRequest = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(
        {
          decision: 'granted',
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
      getCredential: () => 'mock.firebase-user-1',
      fetchImplementation: performRequest as unknown as typeof fetch,
    });

    await client.authorize('ep_harbor_1');

    const [input, init] = performRequest.mock.calls[0] ?? [];
    const headers = requestHeaders(input as RequestInfo | URL, init);
    expect(headers.get('Authorization')).toBe('Bearer mock.firebase-user-1');
  });

  it('maps 200 locked to locked, not ok', async () => {
    const performRequest = jest.fn(async () =>
      jsonResponse({ decision: 'locked', lock_reasons: ['login_required'] }, 200),
    );
    const client = createPlaybackClient({
      baseUrl: BASE_URL,
      territory: TERRITORY,
      platform: PLATFORM,
      fetchImplementation: performRequest as unknown as typeof fetch,
    });

    const result = await client.authorize('ep_harbor_6');
    expect(result).toEqual({ outcome: 'locked', lockReasons: ['login_required'] });
  });

  it('maps 200 granted to ok', async () => {
    const performRequest = jest.fn(async () =>
      jsonResponse(
        {
          decision: 'granted',
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
    if (result.outcome === 'ok') {
      expect(result.data.playback_url).toContain('.m3u8');
    }
  });

  it('maps 401 to unauthenticated', async () => {
    const performRequest = jest.fn(async () =>
      jsonResponse(
        { code: 'authentication_required', message: 'Authentication is required.', request_id: 'r0' },
        401,
      ),
    );
    const client = createPlaybackClient({
      baseUrl: BASE_URL,
      territory: TERRITORY,
      platform: PLATFORM,
      getCredential: () => 'not-a-token',
      fetchImplementation: performRequest as unknown as typeof fetch,
    });

    await expect(client.authorize('ep_harbor_6')).resolves.toEqual({
      outcome: 'unauthenticated',
      httpStatus: 401,
      code: 'authentication_required',
      message: 'Authentication is required.',
    });
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
