import * as SecureStore from 'expo-secure-store';
import type { CoinUnlockRequest } from '../../api/wallet/types';

const STORAGE_PREFIX = 'shortform.pending_coin_unlock.v1';
const JOURNAL_PREFIX = 'shortform.pending_coin_unlock_journal.v1';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROFILE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const EPISODE_ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const POLICY_VERSION_PATTERN = /^[0-9a-f]{64}$/;
const MAX_STORED_ATTEMPT_LENGTH = 1024;

export interface PendingCoinUnlock {
  readonly version: 1;
  readonly profileId: string;
  readonly request: CoinUnlockRequest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPendingCoinUnlock(value: unknown): value is PendingCoinUnlock {
  if (!isRecord(value) || !isRecord(value.request)) return false;
  const request = value.request;
  return (
    value.version === 1 &&
    typeof value.profileId === 'string' &&
    PROFILE_ID_PATTERN.test(value.profileId) &&
    typeof request.episode_id === 'string' &&
    EPISODE_ID_PATTERN.test(request.episode_id) &&
    typeof request.request_id === 'string' &&
    UUID_PATTERN.test(request.request_id) &&
    typeof request.expected_policy_version === 'string' &&
    POLICY_VERSION_PATTERN.test(request.expected_policy_version) &&
    typeof request.expected_coin_price === 'number' &&
    Number.isSafeInteger(request.expected_coin_price) &&
    request.expected_coin_price >= 1 &&
    request.expected_coin_price <= 2147483647 &&
    Object.keys(value).every((key) => ['version', 'profileId', 'request'].includes(key)) &&
    Object.keys(request).every((key) =>
      ['episode_id', 'request_id', 'expected_policy_version', 'expected_coin_price'].includes(key),
    )
  );
}

function storageKey(profileId: string, episodeId: string): string {
  if (!PROFILE_ID_PATTERN.test(profileId) || !EPISODE_ID_PATTERN.test(episodeId)) {
    throw new Error('Invalid coin unlock owner or episode');
  }
  // Length prefixes keep account/episode pairs distinct using SecureStore-safe characters.
  return `${STORAGE_PREFIX}.${profileId.length}.${profileId}.${episodeId.length}.${episodeId}`;
}

function journalKey(profileId: string): string {
  if (!PROFILE_ID_PATTERN.test(profileId)) throw new Error('Invalid coin unlock owner');
  return `${JOURNAL_PREFIX}.${profileId.length}.${profileId}`;
}

// SecureStore has no compare-and-swap operation. Serialize this module's reads,
// writes and cleanup so a remounted screen cannot replace an unresolved request.
let storageOperation: Promise<void> = Promise.resolve();

function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageOperation.then(operation);
  storageOperation = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function readStoredAttempt(
  profileId: string,
  episodeId: string,
): Promise<PendingCoinUnlock | null> {
  const raw = await SecureStore.getItemAsync(storageKey(profileId, episodeId));
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (
    !isPendingCoinUnlock(value) ||
    value.profileId !== profileId ||
    value.request.episode_id !== episodeId
  ) {
    throw new Error('The saved coin unlock could not be verified');
  }
  return value;
}

async function readJournal(profileId: string): Promise<PendingCoinUnlock | null> {
  const raw = await SecureStore.getItemAsync(journalKey(profileId));
  if (raw === null) return null;
  if (raw.length > MAX_STORED_ATTEMPT_LENGTH)
    throw new Error('The saved coin unlock could not be verified');
  const value: unknown = JSON.parse(raw);
  if (!isPendingCoinUnlock(value) || value.profileId !== profileId) {
    throw new Error('The saved coin unlock could not be verified');
  }
  return value;
}

function sameAttempt(left: PendingCoinUnlock, right: PendingCoinUnlock): boolean {
  return (
    left.profileId === right.profileId &&
    left.request.episode_id === right.request.episode_id &&
    left.request.request_id === right.request.request_id &&
    left.request.expected_policy_version === right.request.expected_policy_version &&
    left.request.expected_coin_price === right.request.expected_coin_price
  );
}

export function readPendingCoinUnlock(
  profileId: string,
  episodeId: string,
  isCurrent: () => boolean = () => true,
): Promise<PendingCoinUnlock | null> {
  return serialized(async () => {
    const journal = await readJournal(profileId);
    const legacy = await readStoredAttempt(profileId, episodeId);
    if (journal !== null && journal.request.episode_id !== episodeId)
      throw new Error('Another coin unlock is unresolved');
    if (journal !== null && legacy !== null && !sameAttempt(journal, legacy)) {
      throw new Error('Conflicting pending coin unlocks');
    }
    const recovered = journal ?? legacy;
    if (recovered === null) return null;
    if (journal === null) {
      if (!isCurrent()) throw new Error('Coin unlock owner changed');
      try {
        await SecureStore.setItemAsync(journalKey(profileId), JSON.stringify(recovered));
      } catch {
        if (!isCurrent()) throw new Error('Coin unlock owner changed');
        // The known episode marker remains durable recovery evidence. A failed
        // best-effort journal import must not hide its existing resolver.
        return recovered;
      }
    }
    return recovered;
  });
}

export function readPendingCoinUnlockForProfile(
  profileId: string,
): Promise<PendingCoinUnlock | null> {
  return serialized(() => readJournal(profileId));
}

export function writePendingCoinUnlock(
  attempt: PendingCoinUnlock,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  return serialized(async () => {
    if (!isPendingCoinUnlock(attempt)) throw new Error('Invalid pending coin unlock');
    const journal = await readJournal(attempt.profileId);
    const existing = await readStoredAttempt(attempt.profileId, attempt.request.episode_id);
    if (journal !== null && !sameAttempt(journal, attempt)) {
      throw new Error('An unresolved coin unlock already exists');
    }
    if (existing !== null && !sameAttempt(existing, attempt)) {
      throw new Error('An unresolved coin unlock already exists');
    }
    if (!isCurrent()) throw new Error('Coin unlock owner changed');
    await SecureStore.setItemAsync(journalKey(attempt.profileId), JSON.stringify(attempt));
    if (!isCurrent()) throw new Error('Coin unlock owner changed');
    await SecureStore.setItemAsync(
      storageKey(attempt.profileId, attempt.request.episode_id),
      JSON.stringify(attempt),
    );
  });
}

export function clearPendingCoinUnlock(
  attempt: PendingCoinUnlock,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  return serialized(async () => {
    if (!isPendingCoinUnlock(attempt)) throw new Error('Invalid pending coin unlock');
    const journal = await readJournal(attempt.profileId);
    const existing = await readStoredAttempt(attempt.profileId, attempt.request.episode_id);
    if (
      (journal !== null && !sameAttempt(journal, attempt)) ||
      (existing !== null && !sameAttempt(existing, attempt))
    )
      throw new Error('Conflicting pending coin unlocks');
    if (existing !== null && isCurrent()) {
      await SecureStore.deleteItemAsync(storageKey(attempt.profileId, attempt.request.episode_id));
    }
    if (journal !== null && isCurrent()) {
      await SecureStore.deleteItemAsync(journalKey(attempt.profileId));
    }
  });
}
