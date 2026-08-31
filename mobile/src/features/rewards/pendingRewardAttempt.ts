import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'shortform.pending_reward_attempt.v1';
const RECORD_VERSION = 1;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export interface PendingRewardAttempt {
  readonly version: typeof RECORD_VERSION;
  readonly profileId: string;
  readonly episodeId: string;
  readonly requestId: string;
  readonly intentId?: string;
}

function isPendingRewardAttempt(value: unknown): value is PendingRewardAttempt {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    row.version === RECORD_VERSION &&
    typeof row.profileId === 'string' &&
    PUBLIC_ID_PATTERN.test(row.profileId) &&
    typeof row.episodeId === 'string' &&
    PUBLIC_ID_PATTERN.test(row.episodeId) &&
    typeof row.requestId === 'string' &&
    UUID_PATTERN.test(row.requestId) &&
    (row.intentId === undefined ||
      (typeof row.intentId === 'string' && UUID_PATTERN.test(row.intentId))) &&
    Object.keys(row).every((key) =>
      ['version', 'profileId', 'episodeId', 'requestId', 'intentId'].includes(key),
    )
  );
}

export async function readPendingRewardAttempt(
  profileId: string,
  episodeId: string,
): Promise<PendingRewardAttempt | null> {
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isPendingRewardAttempt(value) || value.profileId !== profileId) {
      await clearPendingRewardAttempt();
      return null;
    }
    if (value.episodeId === episodeId) {
      return value;
    }
    // Opening a different episode does not adopt or erase this account's active attempt.
    return null;
  } catch {
    // Malformed local state is never used as an account or reward authority.
  }
  await clearPendingRewardAttempt();
  return null;
}

export async function writePendingRewardAttempt(attempt: PendingRewardAttempt): Promise<void> {
  if (!isPendingRewardAttempt(attempt)) {
    throw new Error('Invalid pending reward attempt');
  }
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(attempt));
}

export async function clearPendingRewardAttempt(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch {
    // Cleanup is best effort. Owner checks still prevent cross-account recovery.
  }
}

export function newPendingRewardAttempt(
  profileId: string,
  episodeId: string,
  requestId: string,
): PendingRewardAttempt {
  const attempt = { version: RECORD_VERSION, profileId, episodeId, requestId } as const;
  if (!isPendingRewardAttempt(attempt)) {
    throw new Error('Invalid pending reward attempt');
  }
  return attempt;
}
