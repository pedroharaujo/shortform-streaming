import { getNativeAppCheckToken } from '../appCheck/nativeAppCheck';
import { setAuthSession } from '../auth/session';
import { getApiConfiguration, getAppCheckConfiguration } from '../config/appConfiguration';
import { createAppCatalogClient, createAppWalletClient } from './createAppClients';
import { jsonResponse, requestHeaders, requestUrl } from './fetchTestUtils';

jest.mock('../appCheck/nativeAppCheck', () => ({
  getNativeAppCheckToken: jest.fn(async () => 'synthetic.app-check-token'),
}));
jest.mock('../config/appConfiguration', () => ({
  getApiConfiguration: jest.fn(() => ({
    environment: 'local',
    baseUrl: 'http://10.0.2.2:8000',
  })),
  getAppCheckConfiguration: jest.fn(() => ({ mode: 'enforce' })),
}));

describe('app API clients', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setAuthSession(null);
  });

  it('attaches App Check even to anonymous catalog requests', async () => {
    const performRequest = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ rails: [] }, 200),
    );
    globalThis.fetch = performRequest as unknown as typeof fetch;

    const result = await createAppCatalogClient().getHome();

    expect(result).toEqual({ outcome: 'ok', data: { rails: [] } });
    expect(getApiConfiguration).toHaveBeenCalled();
    expect(getAppCheckConfiguration).toHaveBeenCalled();
    expect(getNativeAppCheckToken).toHaveBeenCalledTimes(1);
    const call = performRequest.mock.calls[0];
    expect(call).toBeDefined();
    if (call === undefined) throw new Error('Expected a backend request.');
    const [input, init] = call;
    expect(requestHeaders(input, init).get('X-Firebase-AppCheck')).toBe(
      'synthetic.app-check-token',
    );
  });

  it('does not initialize the private provider while rollout is disabled', async () => {
    jest.clearAllMocks();
    jest.mocked(getAppCheckConfiguration).mockReturnValueOnce({ mode: 'disabled' });
    const performRequest = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ rails: [] }, 200),
    );
    globalThis.fetch = performRequest as unknown as typeof fetch;

    await expect(createAppCatalogClient().getHome()).resolves.toEqual({
      outcome: 'ok',
      data: { rails: [] },
    });

    expect(getNativeAppCheckToken).not.toHaveBeenCalled();
    const call = performRequest.mock.calls[0];
    expect(call).toBeDefined();
    if (call === undefined) throw new Error('Expected a backend request.');
    expect(requestHeaders(call[0], call[1]).has('X-Firebase-AppCheck')).toBe(false);
  });

  it('authenticates wallet requests, sends only unlock terms, and verifies financial responses', async () => {
    jest.clearAllMocks();
    setAuthSession({ credential: 'synthetic.firebase-token' });
    const request = {
      episode_id: 'episode-one',
      request_id: '11111111-1111-4111-8111-111111111111',
      expected_policy_version: 'a'.repeat(64),
      expected_coin_price: 10,
    };
    const wallet = { balance: 30, spending_available: true };
    const unlock = {
      episode_id: request.episode_id,
      request_id: request.request_id,
      charged_coins: 10,
      balance: 20,
    };
    const performRequest = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
    globalThis.fetch = performRequest as unknown as typeof fetch;
    const client = createAppWalletClient();

    performRequest.mockResolvedValueOnce(jsonResponse(wallet, 200));
    await expect(client.getWallet()).resolves.toEqual({ outcome: 'ok', data: wallet });
    performRequest.mockResolvedValueOnce(jsonResponse(unlock, 200));
    await expect(client.unlock(request)).resolves.toEqual({ outcome: 'ok', data: unlock });

    for (const invalid of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, '20']) {
      performRequest.mockResolvedValueOnce(jsonResponse({ ...wallet, balance: invalid }, 200));
      await expect(client.getWallet()).resolves.toMatchObject({
        outcome: 'error',
        code: 'invalid_response',
      });
      performRequest.mockResolvedValueOnce(
        jsonResponse({ ...unlock, charged_coins: invalid }, 200),
      );
      await expect(client.unlock(request)).resolves.toMatchObject({
        outcome: 'error',
        code: 'invalid_response',
      });
    }
    performRequest.mockResolvedValueOnce(
      jsonResponse({ ...unlock, charged_coins: 2147483648 }, 200),
    );
    await expect(client.unlock(request)).resolves.toMatchObject({
      outcome: 'error',
      code: 'invalid_response',
    });
    performRequest.mockResolvedValueOnce(
      jsonResponse({ code: 'offer_changed', message: 'Refresh this episode offer.' }, 409),
    );
    await expect(client.unlock(request)).resolves.toMatchObject({
      outcome: 'unavailable',
      httpStatus: 409,
      code: 'offer_changed',
    });

    expect(getNativeAppCheckToken).toHaveBeenCalledTimes(performRequest.mock.calls.length);
    for (const [input, init] of performRequest.mock.calls) {
      const headers = requestHeaders(input, init);
      expect(headers.get('Authorization')).toBe('Bearer synthetic.firebase-token');
      expect(headers.get('X-Firebase-AppCheck')).toBe('synthetic.app-check-token');
      const method = input instanceof Request ? input.method : init?.method;
      if (method === 'POST') {
        expect(requestUrl(input)).toBe('http://10.0.2.2:8000/v1/coins/unlock');
        const body =
          input instanceof Request ? await input.clone().json() : JSON.parse(String(init?.body));
        expect(body).toEqual(request);
      } else {
        expect(method).toBe('GET');
        expect(requestUrl(input)).toBe('http://10.0.2.2:8000/v1/wallet');
      }
    }
  });
});
