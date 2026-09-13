import * as SecureStore from 'expo-secure-store';
import {
  clearPendingCoinUnlock,
  readPendingCoinUnlock,
  readPendingCoinUnlockForProfile,
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

it('keeps different accounts separate and blocks a second episode for one account', async () => {
  const otherAccount = { ...attempt, profileId: 'profile-two' };
  const otherEpisode = {
    ...attempt,
    request: { ...attempt.request, episode_id: 'episode-two' },
  };
  await Promise.all([writePendingCoinUnlock(attempt), writePendingCoinUnlock(otherAccount)]);
  await expect(writePendingCoinUnlock(otherEpisode)).rejects.toThrow();

  expect(mockStore.size).toBe(4);
  await clearPendingCoinUnlock(otherAccount);
  await expect(readPendingCoinUnlock('profile-one', 'episode-one')).resolves.toEqual(attempt);
  await expect(readPendingCoinUnlock('profile-one', 'episode-two')).rejects.toThrow();
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
  await expect(clearPendingCoinUnlock(attempt)).rejects.toThrow();

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
  await expect(clearPendingCoinUnlock(changed)).rejects.toThrow();
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

it('recovers a journal-only attempt without requiring another write', async () => {
  jest
    .mocked(SecureStore.setItemAsync)
    .mockImplementationOnce(async (key, value) => {
      mockStore.set(key, value);
    })
    .mockRejectedValueOnce(new Error('legacy unavailable'));
  await expect(writePendingCoinUnlock(attempt)).rejects.toThrow();
  expect(mockStore.size).toBe(1);
  await expect(readPendingCoinUnlockForProfile('profile-one')).resolves.toEqual(attempt);
  const writes = jest.mocked(SecureStore.setItemAsync).mock.calls.length;
  await expect(readPendingCoinUnlock('profile-one', 'episode-one')).resolves.toEqual(attempt);
  expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(writes);
  expect(mockStore.size).toBe(1);
});

it('blocks another episode while an account journal is unresolved', async () => {
  await writePendingCoinUnlock(attempt);
  const otherEpisode = {
    ...attempt,
    request: { ...attempt.request, episode_id: 'episode-two' },
  };
  await expect(writePendingCoinUnlock(otherEpisode)).rejects.toThrow();
  await expect(readPendingCoinUnlockForProfile('profile-one')).resolves.toEqual(attempt);
});

it('keeps the journal when legacy cleanup fails', async () => {
  await writePendingCoinUnlock(attempt);
  jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('delete failed'));
  await expect(clearPendingCoinUnlock(attempt)).rejects.toThrow();
  await expect(readPendingCoinUnlockForProfile('profile-one')).resolves.toEqual(attempt);
});

it('keeps journal recovery when its cleanup fails after deleting the legacy marker', async () => {
  await writePendingCoinUnlock(attempt);
  jest
    .mocked(SecureStore.deleteItemAsync)
    .mockImplementationOnce(async (key) => {
      mockStore.delete(key);
    })
    .mockRejectedValueOnce(new Error('journal delete failed'));
  await expect(clearPendingCoinUnlock(attempt)).rejects.toThrow();
  await expect(readPendingCoinUnlockForProfile('profile-one')).resolves.toEqual(attempt);
});

it('stops cleanup between deletes when the owner changes', async () => {
  await writePendingCoinUnlock(attempt);
  let current = true;
  jest.mocked(SecureStore.deleteItemAsync).mockImplementationOnce(async (key) => {
    mockStore.delete(key);
    current = false;
  });
  await clearPendingCoinUnlock(attempt, () => current);
  await expect(readPendingCoinUnlockForProfile('profile-one')).resolves.toEqual(attempt);
});

it('imports a known legacy marker into the account journal', async () => {
  await writePendingCoinUnlock(attempt);
  const journal = [...mockStore.keys()].find((key) => key.includes('journal'))!;
  mockStore.delete(journal);
  await expect(readPendingCoinUnlock('profile-one', 'episode-one')).resolves.toEqual(attempt);
  await expect(readPendingCoinUnlockForProfile('profile-one')).resolves.toEqual(attempt);
});

it('keeps known-route legacy recovery available when journal import fails', async () => {
  await writePendingCoinUnlock(attempt);
  const journal = [...mockStore.keys()].find((key) => key.includes('journal'))!;
  mockStore.delete(journal);
  jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('journal unavailable'));
  await expect(readPendingCoinUnlock('profile-one', 'episode-one')).resolves.toEqual(attempt);
  await expect(readPendingCoinUnlockForProfile('profile-one')).resolves.toBeNull();
});

it('rejects conflicting journal and legacy attempts', async () => {
  await writePendingCoinUnlock(attempt);
  const legacy = [...mockStore.keys()].find((key) => !key.includes('journal'))!;
  mockStore.set(
    legacy,
    JSON.stringify({
      ...attempt,
      request: { ...attempt.request, request_id: '22222222-2222-4222-8222-222222222222' },
    }),
  );
  await expect(readPendingCoinUnlock('profile-one', 'episode-one')).rejects.toThrow();
});

it('rejects an oversized account journal before parsing it', async () => {
  await writePendingCoinUnlock(attempt);
  const journal = [...mockStore.keys()].find((key) => key.includes('journal'))!;
  mockStore.set(journal, 'x'.repeat(1025));
  await expect(readPendingCoinUnlockForProfile('profile-one')).rejects.toThrow();
});
