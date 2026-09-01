import { jsonResponse, requestHeaders, requestUrl } from '../fetchTestUtils';
import { MVP_CLIENT_PLATFORM } from '../context';
import { createPlaybackClient, type PlaybackClientOptions } from './playbackClient';

const BASE_URL = 'http://10.0.2.2:8000';

const GRANTED = {
  decision: 'granted' as const,
  access_method: 'free' as const,
  playback_url: 'https://video.example.test/hls/a/playlist.m3u8',
  expires_at: '2026-08-25T12:10:00Z',
};

function client(performRequest: typeof fetch, extra?: Partial<PlaybackClientOptions>) {
  return createPlaybackClient({
    baseUrl: BASE_URL,
    territory: 'FR',
    platform: MVP_CLIENT_PLATFORM,
    fetchImplementation: performRequest,
    ...extra,
  });
}

describe('createPlaybackClient', () => {
  it('posts authorize with catalog context headers and no Authorization', async () => {
    const performRequest = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(GRANTED, 200),
    );

    const result = await client(performRequest as unknown as typeof fetch).authorize('ep_harbor_1');

    expect(result.outcome).toBe('ok');
    const [input, init] = performRequest.mock.calls[0] ?? [];
    expect(requestUrl(input as RequestInfo | URL)).toContain('/v1/playback/ep_harbor_1/authorize');
    const headers = requestHeaders(input as RequestInfo | URL, init);
    expect(headers.get('X-Territory')).toBe('FR');
    expect(headers.get('X-Platform')).toBe(MVP_CLIENT_PLATFORM);
    expect(headers.get('X-Language')).toBe('en');
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('Accept-Language')).toBeNull();
  });

  it('attaches Bearer when getCredential returns a token', async () => {
    const performRequest = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(GRANTED, 200),
    );
    await client(performRequest as unknown as typeof fetch, {
      getCredential: () => 'mock.firebase-user-1',
    }).authorize('ep_harbor_1');

    const [input, init] = performRequest.mock.calls[0] ?? [];
    expect(requestHeaders(input as RequestInfo | URL, init).get('Authorization')).toBe(
      'Bearer mock.firebase-user-1',
    );
  });

  it('maps 200 locked to locked, not ok', async () => {
    const result = await client((async () =>
      jsonResponse(
        { decision: 'locked', lock_reasons: ['login_required'] },
        200,
      )) as typeof fetch).authorize('ep_harbor_6');
    expect(result).toEqual({ outcome: 'locked', lockReasons: ['login_required'] });
  });

  it('maps 401 to unauthenticated', async () => {
    await expect(
      client(
        (async () =>
          jsonResponse(
            {
              code: 'authentication_required',
              message: 'Authentication is required.',
              request_id: 'r0',
            },
            401,
          )) as typeof fetch,
        { getCredential: () => 'not-a-token' },
      ).authorize('ep_harbor_6'),
    ).resolves.toEqual({
      outcome: 'unauthenticated',
      httpStatus: 401,
      code: 'authentication_required',
      message: 'Authentication is required.',
    });
  });

  it('maps 404 and 503 without treating them as success', async () => {
    const notFound = await client((async () =>
      jsonResponse(
        { code: 'not_found', message: 'Resource not found.', request_id: 'r1' },
        404,
      )) as typeof fetch).authorize('ep_missing');
    const down = await client((async () =>
      jsonResponse(
        {
          code: 'playback_unavailable',
          message: 'Playback is temporarily unavailable.',
          request_id: 'r2',
        },
        503,
      )) as typeof fetch).authorize('ep_harbor_1');
    expect(notFound.outcome).toBe('not-found');
    expect(down.outcome).toBe('unavailable');
  });
});
