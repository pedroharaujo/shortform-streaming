import { setAuthSession } from '../../auth/session';
import { jsonResponse, requestHeaders, requestUrl } from '../fetchTestUtils';
import { createMeClient } from './meClient';

const BASE_URL = 'http://10.0.2.2:8000';

describe('createMeClient', () => {
  afterEach(() => {
    setAuthSession(null);
  });

  it('attaches Bearer from the session and never a backend user id', async () => {
    const performRequest = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(
        {
          public_id: 'usr_profile',
          created_at: '2026-08-25T00:00:00Z',
          updated_at: '2026-08-25T00:00:00Z',
        },
        200,
      ),
    );
    const client = createMeClient({
      baseUrl: BASE_URL,
      getCredential: () => 'mock.local_user',
      fetchImplementation: performRequest as unknown as typeof fetch,
    });

    await client.getMe();

    const [input, init] = performRequest.mock.calls[0] ?? [];
    const headers = requestHeaders(input as RequestInfo | URL, init);
    expect(headers.get('Authorization')).toBe('Bearer mock.local_user');
    expect(headers.get('X-User-Id')).toBeNull();
    expect(headers.get('X-Public-Id')).toBeNull();
    expect(headers.get('X-Firebase-Uid')).toBeNull();
    expect(requestUrl(input as RequestInfo | URL)).toBe(`${BASE_URL}/v1/me`);
    const authorization = headers.get('Authorization') ?? '';
    expect(authorization).not.toContain('usr_profile');
    expect(authorization).not.toContain('firebase-user');
  });

  it('does not call the network without a session token', async () => {
    const performRequest = jest.fn();
    const client = createMeClient({
      baseUrl: BASE_URL,
      getCredential: () => null,
      fetchImplementation: performRequest as unknown as typeof fetch,
    });

    await expect(client.getMe()).resolves.toEqual({
      outcome: 'unauthenticated',
      httpStatus: 401,
      code: 'authentication_required',
      message: 'Authentication is required.',
    });
    expect(performRequest).not.toHaveBeenCalled();
  });
});
