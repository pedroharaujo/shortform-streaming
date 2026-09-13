import { getAuthSession, getAuthSessionRevision, setAuthSession } from './session';
import { createSessionLifecycle, type NativeSessionUser } from './sessionLifecycle';

afterEach(() => {
  jest.useRealTimers();
  setAuthSession(null);
});

test('restores the initial native owner without changing the account revision', async () => {
  let observer!: (user: NativeSessionUser | null) => void;
  let uid: string | null = 'native-owner';
  const lifecycle = createSessionLifecycle({
    observe: (listener) => {
      observer = listener;
      return () => undefined;
    },
    getCurrentUid: () => uid,
    clearConsent: async () => undefined,
  });
  const revision = getAuthSessionRevision();
  lifecycle.start();
  observer({
    uid: 'native-owner',
    getIdTokenResult: async () => ({
      token: 'replace-with-provider-value',
      claims: { sub: 'native-owner' },
    }),
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(lifecycle.getSnapshot()).toBe(true);
  expect(getAuthSession()).toEqual({
    credential: 'replace-with-provider-value',
    nativeUid: 'native-owner',
  });
  expect(getAuthSessionRevision()).toBe(revision);
  uid = null;
});

test('initial null and timeout allow anonymous browsing and late restoration cannot overwrite', async () => {
  jest.useFakeTimers();
  let observer!: (user: NativeSessionUser | null) => void;
  let resolveToken!: (token: string) => void;
  const lifecycle = createSessionLifecycle({
    observe: (listener) => {
      observer = listener;
      return () => undefined;
    },
    getCurrentUid: () => 'old-owner',
    clearConsent: async () => undefined,
    timeoutMs: 10,
  });
  const revision = getAuthSessionRevision();
  lifecycle.start();
  observer({
    uid: 'old-owner',
    getIdTokenResult: () =>
      new Promise(
        (resolve) => (resolveToken = (token) => resolve({ token, claims: { sub: 'old-owner' } })),
      ),
  });
  jest.advanceTimersByTime(10);
  expect(lifecycle.getSnapshot()).toBe(true);
  expect(getAuthSessionRevision()).toBe(revision);
  setAuthSession({ credential: 'manual', nativeUid: 'new-owner' });
  resolveToken('late-token');
  await Promise.resolve();
  expect(getAuthSession()).toEqual({ credential: 'manual', nativeUid: 'new-owner' });

  setAuthSession(null);
  const nullLifecycle = createSessionLifecycle({
    observe: (listener) => {
      listener(null);
      return () => undefined;
    },
    getCurrentUid: () => null,
    clearConsent: async () => undefined,
  });
  const nullRevision = getAuthSessionRevision();
  nullLifecycle.start();
  expect(nullLifecycle.getSnapshot()).toBe(true);
  expect(getAuthSessionRevision()).toBe(nullRevision);
});

test('post-ready native null clears an active session and consent, while non-null is ignored', async () => {
  let observer!: (user: NativeSessionUser | null) => void;
  const clearConsent = jest.fn(async () => undefined);
  const lifecycle = createSessionLifecycle({
    observe: (listener) => {
      observer = listener;
      return () => undefined;
    },
    getCurrentUid: () => null,
    clearConsent,
  });
  lifecycle.start();
  observer(null);
  observer({
    uid: 'manual-owner',
    getIdTokenResult: async () => ({ token: 'ignored', claims: { sub: 'manual-owner' } }),
  });
  expect(getAuthSession()).toBeNull();
  setAuthSession({ credential: 'active', nativeUid: 'manual-owner' });
  observer(null);
  await Promise.resolve();
  expect(getAuthSession()).toBeNull();
  expect(clearConsent).toHaveBeenCalledTimes(1);
});

test('starts its process observer once across effect cleanup and remount', () => {
  const observe = jest.fn((listener: (user: NativeSessionUser | null) => void) => {
    listener(null);
    return jest.fn();
  });
  const lifecycle = createSessionLifecycle({
    observe,
    getCurrentUid: () => null,
    clearConsent: async () => undefined,
  });
  const firstCleanup = lifecycle.start();
  firstCleanup();
  const secondCleanup = lifecycle.start();
  secondCleanup();
  expect(observe).toHaveBeenCalledTimes(1);
  expect(lifecycle.getSnapshot()).toBe(true);
});

test('ignores a delayed native null callback after the SDK already has a new owner', async () => {
  let observer!: (user: NativeSessionUser | null) => void;
  const clearConsent = jest.fn(async () => undefined);
  const lifecycle = createSessionLifecycle({
    observe: (listener) => {
      observer = listener;
      return () => undefined;
    },
    getCurrentUid: () => 'owner-b',
    clearConsent,
  });
  lifecycle.start();
  observer(null);
  setAuthSession({ credential: 'owner-b-token', nativeUid: 'owner-b' });
  observer(null);
  await Promise.resolve();
  expect(getAuthSession()).toEqual({ credential: 'owner-b-token', nativeUid: 'owner-b' });
  expect(clearConsent).not.toHaveBeenCalled();
});

test('does not bind a token whose same-result subject belongs to another native owner', async () => {
  let observer!: (user: NativeSessionUser | null) => void;
  const lifecycle = createSessionLifecycle({
    observe: (listener) => {
      observer = listener;
      return () => undefined;
    },
    getCurrentUid: () => 'owner-a',
    clearConsent: async () => undefined,
  });
  lifecycle.start();
  observer({
    uid: 'owner-a',
    getIdTokenResult: async () => ({
      token: 'replace-with-provider-value',
      claims: { sub: 'owner-b' },
    }),
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(lifecycle.getSnapshot()).toBe(true);
  expect(getAuthSession()).toBeNull();
});
