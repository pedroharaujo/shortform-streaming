import * as SecureStore from 'expo-secure-store';
import {
  clearPendingCoinUnlock,
  readPendingCoinUnlock,
  writePendingCoinUnlock,
  type PendingCoinUnlock,
} from './pendingCoinUnlock';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

const attempt: PendingCoinUnlock = {
  version: 1,
  profileId: 'profile-one',
  request: {
    episode_id: 'episode-one',
    request_id: '11111111-1111-4111-8111-111111111111',
    expected_policy_version: 'a'.repeat(64),
    expected_coin_price: 10,
  },
};

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
});

it('keeps different accounts and episodes separate without losing unresolved attempts', async () => {
  const otherAccount = { ...attempt, profileId: 'profile-two' };
  const otherEpisode = {
    ...attempt,
    request: { ...attempt.request, episode_id: 'episode-two' },
  };
  await Promise.all([
    writePendingCoinUnlock(attempt),
    writePendingCoinUnlock(otherAccount),
    writePendingCoinUnlock(otherEpisode),
  ]);

  expect(mockStore.size).toBe(3);
  await clearPendingCoinUnlock(otherAccount);
  await expect(readPendingCoinUnlock('profile-one', 'episode-one')).resolves.toEqual(attempt);
  await expect(readPendingCoinUnlock('profile-one', 'episode-two')).resolves.toEqual(otherEpisode);
  await expect(readPendingCoinUnlock('profile-two', 'episode-one')).resolves.toBeNull();
});

it('fails closed on storage failures and malformed or incorrectly owned records', async () => {
  jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('Storage unavailable'));
  await expect(readPendingCoinUnlock('profile-one', 'episode-one')).rejects.toThrow();

  await writePendingCoinUnlock(attempt);
  const key = [...mockStore.keys()][0];
  if (key === undefined) throw new Error('Expected a stored attempt');
  for (const raw of [
    'malformed',
    JSON.stringify({ ...attempt, profileId: 'profile-two' }),
    JSON.stringify({ ...attempt, request: { ...attempt.request, episode_id: 'episode-two' } }),
    JSON.stringify({ ...attempt, request: { ...attempt.request, expected_coin_price: 0 } }),
  ]) {
    mockStore.set(key, raw);
    await expect(readPendingCoinUnlock('profile-one', 'episode-one')).rejects.toThrow();
    await expect(writePendingCoinUnlock(attempt)).rejects.toThrow();
    await expect(clearPendingCoinUnlock(attempt)).rejects.toThrow();
    expect(mockStore.get(key)).toBe(raw);
  }
});

it('cannot replace an unresolved request or clear a newer request with a stale result', async () => {
  const newer: PendingCoinUnlock = {
    ...attempt,
    request: { ...attempt.request, request_id: '22222222-2222-4222-8222-222222222222' },
  };
  const results = await Promise.allSettled([
    writePendingCoinUnlock(attempt),
    writePendingCoinUnlock(newer),
  ]);
  expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
  await clearPendingCoinUnlock(attempt);
  await writePendingCoinUnlock(newer);
  await clearPendingCoinUnlock(attempt);

  await expect(readPendingCoinUnlock('profile-one', 'episode-one')).resolves.toEqual(newer);
});

it('preserves the originally accepted policy and amount for the same request id', async () => {
  await writePendingCoinUnlock(attempt);
  await writePendingCoinUnlock(attempt);
  const changed = {
    ...attempt,
    request: {
      ...attempt.request,
      expected_policy_version: 'b'.repeat(64),
      expected_coin_price: 20,
    },
  };
  await expect(writePendingCoinUnlock(changed)).rejects.toThrow();
  await clearPendingCoinUnlock(changed);
  await expect(readPendingCoinUnlock('profile-one', 'episode-one')).resolves.toEqual(attempt);
});

it('propagates write and cleanup failures without losing the saved request', async () => {
  jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('Storage unavailable'));
  await expect(writePendingCoinUnlock(attempt)).rejects.toThrow();
  await writePendingCoinUnlock(attempt);
  jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('Storage unavailable'));
  await expect(clearPendingCoinUnlock(attempt)).rejects.toThrow();
  await expect(readPendingCoinUnlock('profile-one', 'episode-one')).resolves.toEqual(attempt);
});
