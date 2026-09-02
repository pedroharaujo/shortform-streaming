import { createAppCheckFetch } from './appCheckFetch';

describe('createAppCheckFetch', () => {
  it('adds an ephemeral App Check token while preserving request authorization', async () => {
    const performRequest = jest.fn(
      async (_input: RequestInfo | URL) => new Response(null, { status: 204 }),
    );
    const fetchWithAppCheck = createAppCheckFetch(
      async () => 'synthetic.app-check-token',
      performRequest as unknown as typeof fetch,
    );

    await fetchWithAppCheck(
      new Request('https://api.example.test/v1/me', {
        headers: { Authorization: 'Bearer synthetic.firebase-token' },
      }),
    );

    const [request] = performRequest.mock.calls[0] ?? [];
    expect(request).toBeInstanceOf(Request);
    if (!(request instanceof Request)) throw new Error('Expected a Request instance.');
    expect(request.headers.get('Authorization')).toBe('Bearer synthetic.firebase-token');
    expect(request.headers.get('X-Firebase-AppCheck')).toBe('synthetic.app-check-token');
  });

  it.each(['', 'token with whitespace', 'x'.repeat(4097)])(
    'fails closed without sending malformed token %p',
    async (token) => {
      const performRequest = jest.fn();
      const fetchWithAppCheck = createAppCheckFetch(
        async () => token,
        performRequest as unknown as typeof fetch,
      );

      await expect(fetchWithAppCheck('https://api.example.test/v1/catalog/home')).rejects.toThrow(
        'App verification is unavailable.',
      );
      expect(performRequest).not.toHaveBeenCalled();
    },
  );

  it('does not send an unverified request when native token acquisition fails', async () => {
    const performRequest = jest.fn();
    const fetchWithAppCheck = createAppCheckFetch(
      async () => {
        throw new Error('synthetic provider detail');
      },
      performRequest as unknown as typeof fetch,
    );

    await expect(fetchWithAppCheck('https://api.example.test/v1/catalog/home')).rejects.toThrow(
      'App verification is unavailable.',
    );
    expect(performRequest).not.toHaveBeenCalled();
  });
});
