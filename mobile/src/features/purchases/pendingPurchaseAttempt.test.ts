import * as SecureStore from 'expo-secure-store';
import { pendingPurchaseStorage } from './pendingPurchaseAttempt';
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
const attempt = {
  version: 1 as const,
  ownerId: '11111111-1111-4111-8111-111111111111',
  applicationId: 'test.synthetic.shortform',
  productId: 'synthetic_consumable',
  attemptId: '33333333-3333-4333-8333-333333333333',
};
const replacement = { ...attempt, attemptId: '44444444-4444-4444-8444-444444444444' };
let stored: string | null;
beforeEach(() => {
  jest.resetAllMocks();
  stored = null;
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async () => stored);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (_key, value) => {
    stored = value;
  });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async () => {
    stored = null;
  });
});
test('serializes competing writes without replacing an unresolved attempt', async () => {
  const results = await Promise.allSettled([
    pendingPurchaseStorage.write(attempt, () => true),
    pendingPurchaseStorage.write(replacement, () => true),
  ]);
  expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
  expect(JSON.parse(stored!)).toEqual(attempt);
});
test('conditional cleanup cannot erase another attempt or a replaced session', async () => {
  await pendingPurchaseStorage.write(replacement, () => true);
  await pendingPurchaseStorage.clear(attempt, () => true);
  expect(JSON.parse(stored!)).toEqual(replacement);
  await pendingPurchaseStorage.clear(replacement, () => false);
  expect(JSON.parse(stored!)).toEqual(replacement);
  const original = jest.mocked(SecureStore.getItemAsync).getMockImplementation()!;
  let current = true;
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async (...args) => {
    const result = await original(...args);
    current = false;
    return result;
  });
  await pendingPurchaseStorage.clear(replacement, () => current);
  expect(JSON.parse(stored!)).toEqual(replacement);
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});
test('captures an immutable marker before a caller can mutate queued input', async () => {
  const mutable = { ...attempt };
  const write = pendingPurchaseStorage.write(mutable, () => true);
  mutable.productId = 'synthetic_changed';
  await write;
  expect(JSON.parse(stored!)).toEqual(attempt);
});
test.each([
  { ...attempt, private: 'synthetic-private' },
  { ...attempt, version: 2 },
  { ...attempt, ownerId: `${attempt.ownerId}\n` },
  { ...attempt, applicationId: 'real.app' },
  { ...attempt, productId: 'real_product' },
  { ...attempt, attemptId: 'bad' },
])('does not erase or adopt invalid record %#', async (invalid) => {
  stored = JSON.stringify(invalid);
  await expect(pendingPurchaseStorage.read(attempt.ownerId)).rejects.toThrow();
  await expect(pendingPurchaseStorage.write(attempt, () => true)).rejects.toThrow();
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  expect(stored).toBe(JSON.stringify(invalid));
});
