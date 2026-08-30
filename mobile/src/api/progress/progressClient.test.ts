import { jsonResponse, requestHeaders, requestUrl } from '../fetchTestUtils';
import { MVP_CLIENT_PLATFORM } from '../context';
import { createProgressClient, type ProgressClientOptions } from './progressClient';

const BASE_URL = 'http://10.0.2.2:8000';
const DEVICE_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const PROGRESS_BODY = {
  episode_id: 'ep_harbor_1',
  position_seconds: 12,
  completed: false,
  updated_at: '2026-08-28T12:00:00Z',
};

function client(performRequest: typeof fetch, extra?: Partial<ProgressClientOptions>) {
  return createProgressClient({
    baseUrl: BASE_URL,
    territory: 'FR',
    platform: MVP_CLIENT_PLATFORM,
    getDeviceId: async () => DEVICE_ID,
    fetchImplementation: performRequest,
    ...extra,
  });
}

describe('createProgressClient', () => {
  it('sends catalog headers and X-Device-Id when anonymous', async () => {
    const performRequest = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(PROGRESS_BODY, 200),
    );
    const result = await client(performRequest as unknown as typeof fetch).put('ep_harbor_1', {
      position_seconds: 12,
    });

    expect(result.outcome).toBe('ok');
    if (result.outcome === 'ok') {
      expect('playback_url' in result.data).toBe(false);
    }
    const [input, init] = performRequest.mock.calls[0] ?? [];
    expect(requestUrl(input as RequestInfo | URL)).toContain('/v1/progress/ep_harbor_1');
    const headers = requestHeaders(input as RequestInfo | URL, init);
    expect(headers.get('X-Territory')).toBe('FR');
    expect(headers.get('X-Platform')).toBe(MVP_CLIENT_PLATFORM);
    expect(headers.get('X-Language')).toBe('en');
    expect(headers.get('X-Device-Id')).toBe(DEVICE_ID);
    expect(headers.get('Authorization')).toBeNull();
  });

  it('attaches Bearer and omits X-Device-Id when a credential is present', async () => {
    const performRequest = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(PROGRESS_BODY, 200),
    );
    await client(performRequest as unknown as typeof fetch, {
      getCredential: () => 'mock.firebase-user-1',
    }).get('ep_harbor_1');

    const [input, init] = performRequest.mock.calls[0] ?? [];
    const headers = requestHeaders(input as RequestInfo | URL, init);
    expect(headers.get('Authorization')).toBe('Bearer mock.firebase-user-1');
    expect(headers.get('X-Device-Id')).toBeNull();
  });

  it('maps 403 and 404 without a playback URL field', async () => {
    const locked = jest.fn(async () =>
      jsonResponse(
        { code: 'playback_locked', message: 'This episode is not playable.', request_id: 'r0' },
        403,
      ),
    );
    await expect(
      client(locked as unknown as typeof fetch).put('ep_harbor_6', { position_seconds: 1 }),
    ).resolves.toEqual({
      outcome: 'locked',
      httpStatus: 403,
      code: 'playback_locked',
      message: 'This episode is not playable.',
    });
    await expect(
      client((async () =>
        jsonResponse(
          { code: 'not_found', message: 'Resource not found.', request_id: 'r1' },
          404,
        )) as typeof fetch).get('ep_missing'),
    ).resolves.toMatchObject({ outcome: 'not-found', httpStatus: 404 });
    expect(JSON.stringify(await locked.mock.results[0]?.value)).not.toContain('playback_url');
  });
});
