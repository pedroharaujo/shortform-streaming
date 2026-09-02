import { getNativeAppCheckToken } from '../appCheck/nativeAppCheck';
import { getApiConfiguration, getAppCheckConfiguration } from '../config/appConfiguration';
import { createAppCatalogClient } from './createAppClients';
import { jsonResponse, requestHeaders } from './fetchTestUtils';

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
});
