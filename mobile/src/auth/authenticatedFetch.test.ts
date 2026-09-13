import { createAuthenticatedFetch } from './authenticatedFetch';
import { getAuthSessionRevision, setAuthSession } from './session';

afterEach(() => setAuthSession(null));

test('refreshes the same owner without changing revision and preserves Request behavior', async () => {
  setAuthSession({ credential: 'old-token', nativeUid: 'owner-a' });
  const revision = getAuthSessionRevision();
  const raw = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(
    async () => new Response(null, { status: 204 }),
  );
  const guarded = createAuthenticatedFetch({
    getCurrentUser: () => ({
      uid: 'owner-a',
      getIdTokenResult: async () => ({
        token: 'replace-with-provider-value',
        claims: { sub: 'owner-a' },
      }),
    }),
    getAppCheckToken: async () => 'app-check',
    fetchImplementation: raw as unknown as typeof fetch,
  });
  await guarded(
    new Request('https://api.example.test/v1/wallet', {
      method: 'POST',
      headers: { Authorization: 'Bearer old-token', 'X-Custom': 'kept' },
      body: '{}',
    }),
  );
  const request = raw.mock.calls[0]?.[0];
  expect(request).toBeInstanceOf(Request);
  if (!(request instanceof Request)) throw new Error('Expected Request.');
  expect(request.method).toBe('POST');
  expect(request.headers.get('Authorization')).toBe('Bearer replace-with-provider-value');
  expect(request.headers.get('X-Firebase-AppCheck')).toBe('app-check');
  expect(request.headers.get('X-Custom')).toBe('kept');
  expect(getAuthSessionRevision()).toBe(revision);
});

test('rejects stale headers and changed native owners before sending', async () => {
  setAuthSession({ credential: 'current-token', nativeUid: 'owner-a' });
  const raw = jest.fn();
  const stale = createAuthenticatedFetch({
    getCurrentUser: () => ({
      uid: 'owner-a',
      getIdTokenResult: async () => ({ token: 'fresh', claims: { sub: 'owner-a' } }),
    }),
    fetchImplementation: raw as unknown as typeof fetch,
  });
  await expect(
    stale('https://api.example.test/v1/wallet', {
      headers: { Authorization: 'Bearer stale-token' },
    }),
  ).rejects.toThrow('Authentication is unavailable.');

  const changed = createAuthenticatedFetch({
    getCurrentUser: () => ({
      uid: 'owner-b',
      getIdTokenResult: async () => ({
        token: 'replace-with-provider-value',
        claims: { sub: 'owner-b' },
      }),
    }),
    fetchImplementation: raw as unknown as typeof fetch,
  });
  await expect(
    changed('https://api.example.test/v1/wallet', {
      headers: { Authorization: 'Bearer current-token' },
    }),
  ).rejects.toThrow('Authentication is unavailable.');
  expect(raw).not.toHaveBeenCalled();
});

test('does not dispatch when sign-out happens during delayed App Check', async () => {
  setAuthSession({ credential: 'old-token', nativeUid: 'owner-a' });
  let resolveAppCheck!: (token: string) => void;
  const raw = jest.fn();
  const guarded = createAuthenticatedFetch({
    getCurrentUser: () => ({
      uid: 'owner-a',
      getIdTokenResult: async () => ({
        token: 'replace-with-provider-value',
        claims: { sub: 'owner-a' },
      }),
    }),
    getAppCheckToken: () => new Promise((resolve) => (resolveAppCheck = resolve)),
    fetchImplementation: raw as unknown as typeof fetch,
  });
  const request = guarded('https://api.example.test/v1/wallet', {
    headers: { Authorization: 'Bearer old-token' },
  });
  await Promise.resolve();
  setAuthSession(null);
  resolveAppCheck('app-check');
  await expect(request).rejects.toThrow('Authentication is unavailable.');
  expect(raw).not.toHaveBeenCalled();
});

test('keeps requests without Authorization anonymous', async () => {
  setAuthSession({ credential: 'old-token', nativeUid: 'owner-a' });
  const getIdTokenResult = jest.fn(async () => ({
    token: 'replace-with-provider-value',
    claims: { sub: 'owner-a' },
  }));
  const raw = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(
    async () => new Response(null, { status: 204 }),
  );
  const guarded = createAuthenticatedFetch({
    getCurrentUser: () => ({ uid: 'owner-a', getIdTokenResult }),
    fetchImplementation: raw as unknown as typeof fetch,
  });
  await guarded('https://api.example.test/v1/catalog/home');
  expect(getIdTokenResult).not.toHaveBeenCalled();
  expect(raw).toHaveBeenCalledTimes(1);
});

test('rejects a refreshed token whose same-result subject belongs to another owner', async () => {
  setAuthSession({ credential: 'owner-a-token', nativeUid: 'owner-a' });
  const raw = jest.fn();
  const guarded = createAuthenticatedFetch({
    getCurrentUser: () => ({
      uid: 'owner-a',
      getIdTokenResult: async () => ({
        token: 'replace-with-provider-value',
        claims: { sub: 'owner-b' },
      }),
    }),
    fetchImplementation: raw as unknown as typeof fetch,
  });
  await expect(
    guarded('https://api.example.test/v1/wallet', {
      headers: { Authorization: 'Bearer owner-a-token' },
    }),
  ).rejects.toThrow('Authentication is unavailable.');
  expect(raw).not.toHaveBeenCalled();
});

test('honors RequestInit header replacement and stays anonymous through App Check', async () => {
  setAuthSession({ credential: 'owner-a-token', nativeUid: 'owner-a' });
  const getIdTokenResult = jest.fn();
  const raw = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(
    async () => new Response(null, { status: 204 }),
  );
  const guarded = createAuthenticatedFetch({
    getCurrentUser: () => ({ uid: 'owner-a', getIdTokenResult }),
    getAppCheckToken: async () => 'app-check',
    fetchImplementation: raw as unknown as typeof fetch,
  });
  await guarded(
    new Request('https://api.example.test/v1/catalog/home', {
      headers: { Authorization: 'Bearer owner-a-token' },
    }),
    { headers: { 'X-Probe': 'replacement' } },
  );
  expect(getIdTokenResult).not.toHaveBeenCalled();
  const request = raw.mock.calls[0]?.[0];
  expect(request).toBeInstanceOf(Request);
  if (!(request instanceof Request)) throw new Error('Expected Request.');
  expect(request.headers.get('Authorization')).toBeNull();
  expect(request.headers.get('X-Probe')).toBe('replacement');
  expect(request.headers.get('X-Firebase-AppCheck')).toBe('app-check');
});
