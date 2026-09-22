import * as SecureStore from 'expo-secure-store';
import {
  isAndroidApplication,
  isAndroidProduct,
  isRecord,
  isSyntheticApplication,
  isSyntheticProduct,
  isUuid,
  isTransactionFingerprint,
} from '../../api/purchases/checkoutValidation';
export interface PendingPurchaseAttempt {
  readonly version: 1 | 2;
  readonly ownerId: string;
  readonly applicationId: string;
  readonly productId: string;
  readonly attemptId: string;
  readonly transactionFingerprint?: string;
}
export interface PendingPurchaseStorage {
  read(ownerId: string): Promise<PendingPurchaseAttempt | null>;
  write(attempt: PendingPurchaseAttempt, isCurrent: () => boolean): Promise<void>;
  clear(attempt: PendingPurchaseAttempt, isCurrent: () => boolean): Promise<void>;
  recordFingerprint(
    attempt: PendingPurchaseAttempt,
    fingerprint: string,
    isCurrent: () => boolean,
  ): Promise<PendingPurchaseAttempt>;
}
function valid(value: unknown): value is PendingPurchaseAttempt {
  return (
    isRecord(value) &&
    (value.version === 1 || value.version === 2) &&
    isUuid(value.ownerId) &&
    value.ownerId === value.ownerId.toLowerCase() &&
    (value.version === 1
      ? isSyntheticApplication(value.applicationId) && isSyntheticProduct(value.productId)
      : isAndroidApplication(value.applicationId) && isAndroidProduct(value.productId)) &&
    isUuid(value.attemptId) &&
    (value.transactionFingerprint === undefined ||
      (value.version === 2 && isTransactionFingerprint(value.transactionFingerprint))) &&
    Object.keys(value).length === (value.transactionFingerprint === undefined ? 5 : 6) &&
    Object.keys(value).every((key) =>
      [
        'version',
        'ownerId',
        'applicationId',
        'productId',
        'attemptId',
        'transactionFingerprint',
      ].includes(key),
    )
  );
}
function key(ownerId: string) {
  if (!isUuid(ownerId) || ownerId !== ownerId.toLowerCase())
    throw new Error('Invalid purchase owner.');
  return `stovio.pending_purchase.v1.${ownerId}`;
}
export function samePurchaseAttempt(
  left: PendingPurchaseAttempt,
  right: PendingPurchaseAttempt,
): boolean {
  return (
    left.version === right.version &&
    left.ownerId === right.ownerId &&
    left.applicationId === right.applicationId &&
    left.productId === right.productId &&
    left.attemptId === right.attemptId &&
    left.transactionFingerprint === right.transactionFingerprint
  );
}
let queue: Promise<void> = Promise.resolve();
function serialized<T>(run: () => Promise<T>): Promise<T> {
  const result = queue.then(run);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
async function read(ownerId: string): Promise<PendingPurchaseAttempt | null> {
  const raw = await SecureStore.getItemAsync(key(ownerId));
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (!valid(value) || value.ownerId !== ownerId)
    throw new Error('The saved purchase could not be verified.');
  return Object.freeze(value);
}
export const pendingPurchaseStorage: PendingPurchaseStorage = {
  read: (ownerId) => serialized(() => read(ownerId)),
  write: (input, isCurrent) => {
    const attempt = Object.freeze({ ...input });
    return serialized(async () => {
      if (!valid(attempt)) throw new Error('Invalid pending purchase.');
      if (!isCurrent()) throw new Error('Purchase session changed.');
      const existing = await read(attempt.ownerId);
      if (existing !== null) throw new Error('An unresolved purchase already exists.');
      if (!isCurrent()) throw new Error('Purchase session changed.');
      await SecureStore.setItemAsync(key(attempt.ownerId), JSON.stringify(attempt));
    });
  },
  recordFingerprint: (input, fingerprint, isCurrent) => {
    const original = Object.freeze({ ...input });
    return serialized(async () => {
      if (!valid(original) || original.version !== 2 || !isTransactionFingerprint(fingerprint))
        throw new Error('Invalid purchase fingerprint.');
      if (!isCurrent()) throw new Error('Purchase session changed.');
      const existing = await read(original.ownerId);
      if (
        !existing ||
        !samePurchaseAttempt(existing, original) ||
        (existing.transactionFingerprint !== undefined &&
          existing.transactionFingerprint !== fingerprint)
      )
        throw new Error('The saved purchase changed.');
      const updated = Object.freeze({ ...existing, transactionFingerprint: fingerprint });
      if (!isCurrent()) throw new Error('Purchase session changed.');
      await SecureStore.setItemAsync(key(original.ownerId), JSON.stringify(updated));
      return updated;
    });
  },
  clear: (input, isCurrent) => {
    const attempt = Object.freeze({ ...input });
    return serialized(async () => {
      if (!valid(attempt)) throw new Error('Invalid pending purchase.');
      if (!isCurrent()) return;
      const existing = await read(attempt.ownerId);
      if (existing && samePurchaseAttempt(existing, attempt) && isCurrent())
        await SecureStore.deleteItemAsync(key(attempt.ownerId));
    });
  },
};
