import * as SecureStore from 'expo-secure-store';
import { setAuthSession } from '../../auth/session';
import { jsonResponse, requestUrl } from '../../api/fetchTestUtils';
import { createPurchaseCheckoutClient } from '../../api/purchases/purchaseCheckoutClient';
import { createWalletClient } from '../../api/wallet/walletClient';
import { createCheckoutCoordinator } from './checkoutCoordinator';
import { createAppCheckoutCoordinator } from './createAppCheckoutCoordinator';
import { pendingPurchaseStorage } from './pendingPurchaseAttempt';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => '33333333-3333-4333-8333-333333333333' }));
const owner = '11111111-1111-4111-8111-111111111111';
const reference = '22222222-2222-4222-8222-222222222222';
const applicationId = 'test.synthetic.shortform';
const productId = 'synthetic_consumable';
const scope = {
  ownerId: owner,
  applicationId,
  productId,
  store: 'PLAY_STORE',
  environment: 'SANDBOX',
};
const product = {
  product_id: productId,
  coins: 100,
  product_type: 'consumable',
  store: 'PLAY_STORE',
  environment: 'SANDBOX',
  price_source: 'store',
};
const offer = { ...scope, productType: 'consumable', price: ' 1.234,56 € ' };
const transactionId = 'synthetic-private-transaction';
const waiting = {
  status: 'awaiting_verification',
  historical_credited_coins: 0,
  support_reference: null,
};
const credited = {
  status: 'credited',
  historical_credited_coins: 100,
  support_reference: reference,
};
const records = new Map<string, string>();
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function fixture() {
  const responses: Record<string, unknown> = {
    '/v1/purchases/identity': { app_user_id: owner },
    '/v1/purchases/catalog': { products: [product] },
    '/v1/purchases/status': waiting,
    '/v1/wallet': { balance: 45, spending_available: true },
  };
  const fetcher = jest.fn(async (input: RequestInfo | URL) =>
    jsonResponse(responses[new URL(requestUrl(input)).pathname], 200),
  );
  const options = {
    baseUrl: 'http://localhost:8000',
    getCredential: () => 'synthetic.credential',
    fetchImplementation: fetcher as typeof fetch,
  };
  const provider = {
    prepare: jest.fn(async () => ({ ownerId: owner, applicationId })),
    getOffers: jest.fn(async (): Promise<unknown> => [offer]),
    purchase: jest.fn(async (): Promise<unknown> => ({
      ...scope,
      outcome: 'completed',
      transactionId,
    })),
  };
  const dependencies = {
    mode: 'synthetic' as const,
    environment: 'local',
    development: true,
    applicationId,
    api: createPurchaseCheckoutClient(options),
    wallet: createWalletClient(options),
    provider,
    storage: pendingPurchaseStorage,
  };
  return {
    responses,
    fetcher,
    provider,
    dependencies,
    controller: createCheckoutCoordinator(dependencies),
  };
}
beforeEach(() => {
  records.clear();
  jest.resetAllMocks();
  setAuthSession({ credential: 'synthetic.credential' });
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => records.get(key) ?? null);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => {
    records.set(key, value);
  });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => {
    records.delete(key);
  });
});

test('loads exact store price and server quantity only after confirming server identity', async () => {
  const f = fixture();
  await expect(f.controller.load()).resolves.toEqual({
    status: 'ready',
    offers: [{ productId, coins: 100, price: offer.price }],
  });
  expect(f.provider.prepare).toHaveBeenCalledWith({ ownerId: owner, applicationId });
});
test('default and nondevelopment/nonlocal factories stay unavailable before dependencies execute', async () => {
  const f = fixture();
  for (const changes of [
    { mode: 'disabled' as const },
    { environment: 'staging' },
    { development: false },
    { applicationId: 'real.application' },
  ]) {
    const c = createCheckoutCoordinator({ ...f.dependencies, ...changes });
    expect(await c.load()).toEqual({ status: 'unavailable' });
    expect(await c.purchase(productId)).toEqual({ status: 'unavailable' });
    expect(await c.sync()).toEqual({ status: 'unavailable' });
  }
  expect(await createAppCheckoutCoordinator().load()).toEqual({ status: 'unavailable' });
  expect(f.fetcher).not.toHaveBeenCalled();
  expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  expect(f.provider.prepare).not.toHaveBeenCalled();
});
test('requires load then explicit confirmation again when price or coins change', async () => {
  const f = fixture();
  expect(await f.controller.purchase(productId)).toEqual({ status: 'unavailable' });
  await f.controller.load();
  f.provider.getOffers.mockResolvedValue([{ ...offer, price: '2,00 €' }]);
  expect(await f.controller.purchase(productId)).toEqual({
    status: 'ready',
    offers: [{ productId, coins: 100, price: '2,00 €' }],
  });
  f.responses['/v1/purchases/catalog'] = { products: [{ ...product, coins: 200 }] };
  expect(await f.controller.purchase(productId)).toEqual({
    status: 'ready',
    offers: [{ productId, coins: 200, price: '2,00 €' }],
  });
  expect(f.provider.purchase).not.toHaveBeenCalled();
  expect(await f.controller.purchase(productId)).toEqual({ status: 'awaiting_verification' });
  expect(f.provider.purchase).toHaveBeenCalledTimes(1);
});
test('persists only immutable scoped marker before purchase and status POST never exposes transaction', async () => {
  const f = fixture();
  await f.controller.load();
  f.provider.purchase.mockImplementation(async () => {
    expect([...records.values()].map((v) => JSON.parse(v))).toEqual([
      {
        version: 1,
        ownerId: owner,
        applicationId,
        productId,
        attemptId: '33333333-3333-4333-8333-333333333333',
      },
    ]);
    return { ...scope, outcome: 'completed', transactionId, privatePayload: 'never-export' };
  });
  const result = await f.controller.purchase(productId);
  expect(result).toEqual({ status: 'awaiting_verification' });
  const statusCalls = f.fetcher.mock.calls.filter(([input]) =>
    requestUrl(input).endsWith('/status'),
  );
  expect(statusCalls).toHaveLength(1);
  expect(await (statusCalls[0]![0] as Request).clone().json()).toEqual({
    application_id: applicationId,
    product_id: productId,
    transaction_id: transactionId,
  });
  expect(JSON.stringify([result, [...records.values()]])).not.toContain(transactionId);
});
test('restart recovery blocks recharge without claiming history identifies an attempt', async () => {
  const f = fixture();
  await f.controller.load();
  await f.controller.purchase(productId);
  const restarted = createCheckoutCoordinator(f.dependencies);
  expect(await restarted.load()).toEqual({ status: 'awaiting_verification' });
  expect(await restarted.sync()).toEqual({ status: 'awaiting_verification' });
  expect(await restarted.purchase(productId)).toEqual({ status: 'awaiting_verification' });
  expect(f.provider.purchase).toHaveBeenCalledTimes(1);
  expect(
    f.fetcher.mock.calls.filter(([input]) => requestUrl(input).endsWith('/status')),
  ).toHaveLength(1);
});
test('serializes globally across controllers and double taps without queueing purchases', async () => {
  const f = fixture();
  await f.controller.load();
  const gate = deferred<unknown>();
  f.provider.purchase.mockReturnValue(gate.promise);
  const started = f.controller.purchase(productId);
  // Await provider entry without introducing timers.
  for (let i = 0; i < 100 && f.provider.purchase.mock.calls.length === 0; i++)
    await Promise.resolve();
  expect(f.provider.purchase).toHaveBeenCalledTimes(1);
  expect(await f.controller.purchase(productId)).toEqual({ status: 'busy' });
  expect(await createCheckoutCoordinator(f.dependencies).load()).toEqual({ status: 'busy' });
  gate.resolve({ ...scope, outcome: 'pending' });
  expect(await started).toEqual({ status: 'awaiting_verification' });
});
test.each(['read', 'write', 'corrupt'] as const)(
  'fails closed on %s storage failure',
  async (kind) => {
    const f = fixture();
    await f.controller.load();
    if (kind === 'read')
      jest.mocked(SecureStore.getItemAsync).mockRejectedValue(new Error('private-storage-error'));
    if (kind === 'write')
      jest.mocked(SecureStore.setItemAsync).mockRejectedValue(new Error('private-storage-error'));
    if (kind === 'corrupt') jest.mocked(SecureStore.getItemAsync).mockResolvedValue('{broken');
    expect(await f.controller.purchase(productId)).toEqual({ status: 'storage_unavailable' });
    expect(f.provider.purchase).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  },
);
test.each(['pending', 'throw', 'malformed', 'foreign', 'contradictory-cancel'])(
  'retains unresolved marker for %s provider result',
  async (kind) => {
    const f = fixture();
    await f.controller.load();
    if (kind === 'throw') f.provider.purchase.mockRejectedValue(new Error(transactionId));
    else
      f.provider.purchase.mockResolvedValue(
        kind === 'malformed'
          ? null
          : kind === 'foreign'
            ? { ...scope, ownerId: reference, outcome: 'completed', transactionId }
            : kind === 'contradictory-cancel'
              ? { ...scope, outcome: 'cancelled', transactionId }
              : { ...scope, outcome: 'pending' },
      );
    expect(await f.controller.purchase(productId)).toEqual({ status: 'awaiting_verification' });
    expect(records.size).toBe(1);
    expect(await f.controller.purchase(productId)).toEqual({ status: 'awaiting_verification' });
    expect(f.provider.purchase).toHaveBeenCalledTimes(1);
  },
);
test('only scoped explicit cancellation clears the active marker', async () => {
  const f = fixture();
  await f.controller.load();
  f.provider.purchase.mockResolvedValue({ ...scope, outcome: 'cancelled' });
  expect(await f.controller.purchase(productId)).toEqual({ status: 'cancelled' });
  expect(records.size).toBe(0);
});
test('server credit survives registry repricing and wallet outage with historical evidence only', async () => {
  const f = fixture();
  await f.controller.load();
  await f.controller.purchase(productId);
  f.responses['/v1/purchases/status'] = credited;
  f.responses['/v1/purchases/catalog'] = { products: [{ ...product, coins: 900 }] };
  f.responses['/v1/wallet'] = { balance: -1 };
  expect(await f.controller.sync()).toEqual({
    status: 'credited',
    historicalCreditedCoins: 100,
    supportReference: reference,
    wallet: { status: 'unavailable' },
  });
  expect(records.size).toBe(0);
  expect(f.provider.purchase).toHaveBeenCalledTimes(1);
});
test('review retains marker and safe support reference', async () => {
  const f = fixture();
  await f.controller.load();
  f.responses['/v1/purchases/status'] = { ...credited, status: 'review_required' };
  expect(await f.controller.purchase(productId)).toEqual({
    status: 'review_required',
    historicalCreditedCoins: 100,
    supportReference: reference,
  });
  expect(records.size).toBe(1);
});
test('same-token session replacement invalidates forever during provider purchase', async () => {
  const f = fixture();
  await f.controller.load();
  f.provider.purchase.mockImplementation(async () => {
    setAuthSession({ credential: 'synthetic.credential' });
    return { ...scope, outcome: 'completed', transactionId };
  });
  expect(await f.controller.purchase(productId)).toEqual({ status: 'session_changed' });
  expect(await f.controller.sync()).toEqual({ status: 'session_changed' });
  expect(records.size).toBe(1);
  expect(f.fetcher.mock.calls.some(([input]) => requestUrl(input).endsWith('/status'))).toBe(false);
});
test.each([{ app_user_id: 'not-a-uuid' }, { app_user_id: 0 }])(
  'rejects invalid identity %j before binding',
  async (identity) => {
    const f = fixture();
    f.responses['/v1/purchases/identity'] = identity;
    expect(await f.controller.load()).toEqual({ status: 'unavailable' });
    expect(f.provider.prepare).not.toHaveBeenCalled();
  },
);
test.each(
  [
    [],
    [product, product],
    [{ ...product, coins: 0 }],
    [{ ...product, coins: 2147483648 }],
    [{ ...product, coins: 1.5 }],
    [{ ...product, product_id: 'real_product' }],
    [{ ...product, product_type: 'subscription' }],
    [{ ...product, store: 'APP_STORE' }],
    [{ ...product, environment: 'PRODUCTION' }],
    [{ ...product, price_source: 'client' }],
    Array.from({ length: 33 }, (_, i) => ({ ...product, product_id: `synthetic_${i}` })),
  ].map((products) => ({ products })),
)('rejects malformed or non-synthetic catalogs %#', async ({ products }) => {
  const f = fixture();
  f.responses['/v1/purchases/catalog'] = { products };
  expect(await f.controller.load()).toEqual({ status: 'unavailable' });
});
test.each(
  [
    [],
    [offer, offer],
    [{ ...offer, ownerId: reference }],
    [{ ...offer, applicationId: 'test.synthetic.other' }],
    [{ ...offer, productId: 'synthetic_unknown' }],
    [{ ...offer, productType: 'subscription' }],
    [{ ...offer, store: 'APP_STORE' }],
    [{ ...offer, environment: 'PRODUCTION' }],
    [{ ...offer, price: '' }],
    [{ ...offer, price: ' '.repeat(3) }],
    [{ ...offer, price: 'x'.repeat(129) }],
  ].map((offers) => ({ offers })),
)('rejects ambiguous/mismatching offers %#', async ({ offers }) => {
  const f = fixture();
  f.provider.getOffers.mockResolvedValue(offers);
  expect(await f.controller.load()).toEqual({ status: 'unavailable' });
});
test.each([
  { ...waiting, historical_credited_coins: 1 },
  { ...waiting, support_reference: reference },
  { ...credited, historical_credited_coins: 0 },
  { ...credited, historical_credited_coins: 2147483648 },
  { ...credited, support_reference: null },
  { ...credited, support_reference: 'private' },
])(
  'rejects contradictory server status %# without clearing or exporting fields',
  async (status) => {
    const f = fixture();
    await f.controller.load();
    f.responses['/v1/purchases/status'] = { ...status, transactionId };
    expect(await f.controller.purchase(productId)).toEqual({ status: 'awaiting_verification' });
    expect(records.size).toBe(1);
  },
);

test('keeps uncertainty visible when synchronization throws after purchase completes', async () => {
  const f = fixture();
  await f.controller.load();
  const api = {
    ...f.dependencies.api,
    getStatus: async () => {
      throw new Error(transactionId);
    },
  };
  const c = createCheckoutCoordinator({ ...f.dependencies, api });
  await c.load();
  expect(await c.purchase(productId)).toEqual({ status: 'awaiting_verification' });
  expect(await c.sync()).toEqual({ status: 'awaiting_verification' });
  expect(records.size).toBe(1);
});
test('rejects UUIDs with trailing newlines before provider binding', async () => {
  const f = fixture();
  f.responses['/v1/purchases/identity'] = { app_user_id: `${owner}\n` };
  expect(await f.controller.load()).toEqual({ status: 'unavailable' });
  expect(f.provider.prepare).not.toHaveBeenCalled();
});
test.each([
  'identity',
  'storage-read',
  'catalog',
  'prepare',
  'offers',
  'storage-write',
  'status',
  'wallet',
  'clear-read',
] as const)('invalidates before using results after session changes at %s', async (boundary) => {
  const f = fixture();
  await f.controller.load();
  const replace = () => setAuthSession({ credential: 'synthetic.credential' });
  const originalFetch = f.fetcher.getMockImplementation()!;
  if (['identity', 'catalog', 'status', 'wallet'].includes(boundary)) {
    const path = boundary === 'wallet' ? '/v1/wallet' : `/v1/purchases/${boundary}`;
    f.fetcher.mockImplementation(async (input) => {
      const response = await originalFetch(input);
      if (new URL(requestUrl(input)).pathname === path) replace();
      return response;
    });
  }
  if (boundary === 'storage-read')
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => {
      replace();
      return records.get(key) ?? null;
    });
  if (boundary === 'clear-read')
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => {
      const value = records.get(key) ?? null;
      if (value !== null) replace();
      return value;
    });
  if (boundary === 'storage-write')
    jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => {
      records.set(key, value);
      replace();
    });
  if (boundary === 'prepare')
    f.provider.prepare.mockImplementation(async () => {
      replace();
      return { ownerId: owner, applicationId };
    });
  if (boundary === 'offers')
    f.provider.getOffers.mockImplementation(async () => {
      replace();
      return [offer];
    });
  f.responses['/v1/purchases/status'] = credited;
  expect(await f.controller.purchase(productId)).toEqual({ status: 'session_changed' });
  expect(await f.controller.load()).toEqual({ status: 'session_changed' });
  if (!['status', 'wallet', 'clear-read'].includes(boundary))
    expect(f.provider.purchase).not.toHaveBeenCalled();
  if (boundary === 'clear-read') expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});
test('new account cannot adopt old markers or transact while old provider operation is running', async () => {
  const f = fixture();
  await f.controller.load();
  const gate = deferred<unknown>();
  f.provider.purchase.mockReturnValue(gate.promise);
  const purchase = f.controller.purchase(productId);
  for (let i = 0; i < 100 && f.provider.purchase.mock.calls.length === 0; i++)
    await Promise.resolve();
  setAuthSession({ credential: 'synthetic.other' });
  f.responses['/v1/purchases/identity'] = { app_user_id: reference };
  const other = createCheckoutCoordinator(f.dependencies);
  expect(await other.load()).toEqual({ status: 'busy' });
  gate.resolve({ ...scope, outcome: 'completed', transactionId });
  expect(await purchase).toEqual({ status: 'session_changed' });
  f.provider.prepare.mockResolvedValue({ ownerId: reference, applicationId });
  f.provider.getOffers.mockResolvedValue([{ ...offer, ownerId: reference }]);
  expect(await other.load()).toMatchObject({ status: 'ready' });
  expect(records.size).toBe(1);
});
test('valid maximum catalog and price bounds retain exact strings and project known fields', async () => {
  const f = fixture();
  const products = Array.from({ length: 32 }, (_, i) => ({
    ...product,
    product_id: `synthetic_${i}`,
    coins: 2147483647,
    private: transactionId,
  }));
  f.responses['/v1/purchases/catalog'] = { products, private: transactionId };
  f.provider.getOffers.mockResolvedValue(
    products.map((p) => ({
      ...offer,
      productId: p.product_id,
      price: '€'.repeat(128),
      private: transactionId,
    })),
  );
  const state = await f.controller.load();
  expect(state.status).toBe('ready');
  expect(JSON.stringify(state)).not.toContain(transactionId);
  if (state.status === 'ready') {
    expect(state.offers).toHaveLength(32);
    expect(state.offers[0]).toEqual({
      productId: 'synthetic_0',
      coins: 2147483647,
      price: '€'.repeat(128),
    });
  }
});
test('rejects mismatched provider preparation before reading offers', async () => {
  const f = fixture();
  f.provider.prepare.mockResolvedValue({ ownerId: reference, applicationId });
  expect(await f.controller.load()).toEqual({ status: 'unavailable' });
  expect(f.provider.getOffers).not.toHaveBeenCalled();
});
test('refreshes wallet independently after matching credit without granting the historical amount locally', async () => {
  const f = fixture();
  await f.controller.load();
  f.responses['/v1/purchases/status'] = { ...credited, private: transactionId };
  expect(await f.controller.purchase(productId)).toEqual({
    status: 'credited',
    historicalCreditedCoins: 100,
    supportReference: reference,
    wallet: { status: 'available', data: { balance: 45, spending_available: true } },
  });
  expect(records.size).toBe(0);
});
test('failed status transport retains attempt with fixed public state', async () => {
  const f = fixture();
  await f.controller.load();
  const original = f.fetcher.getMockImplementation()!;
  f.fetcher.mockImplementation(async (input) =>
    requestUrl(input).endsWith('/status')
      ? jsonResponse({ message: transactionId, code: transactionId }, 503)
      : original(input),
  );
  expect(await f.controller.purchase(productId)).toEqual({ status: 'awaiting_verification' });
  expect(records.size).toBe(1);
});

test.each(['identity', 'support-reference'] as const)(
  'rejects newline in %s at HTTP projection boundary',
  async (field) => {
    const f = fixture();
    if (field === 'identity') {
      f.responses['/v1/purchases/identity'] = { app_user_id: `${owner}\n` };
      expect(await f.dependencies.api.getIdentity()).toEqual({
        outcome: 'unavailable',
        message: 'The checkout request could not be verified.',
      });
    } else {
      f.responses['/v1/purchases/status'] = { ...credited, support_reference: `${reference}\n` };
      expect(
        await f.dependencies.api.getStatus({
          application_id: applicationId,
          product_id: productId,
          transaction_id: transactionId,
        }),
      ).toEqual({ outcome: 'unavailable', message: 'The checkout request could not be verified.' });
    }
  },
);
test.each([
  { application_id: 'real.app' },
  { application_id: 'test.synthetic.' + 'x'.repeat(128) },
  { product_id: 'synthetic_newline\n' },
  { product_id: 'synthetic_' + 'x'.repeat(128) },
  { transaction_id: '' },
  { transaction_id: 'x'.repeat(201) },
  { transaction_id: ' leading' },
])('rejects invalid status inputs %# before issuing a request', async (changes) => {
  const f = fixture();
  expect(
    await f.dependencies.api.getStatus({
      application_id: applicationId,
      product_id: productId,
      transaction_id: transactionId,
      ...changes,
    }),
  ).toMatchObject({ outcome: 'unavailable' });
  expect(f.fetcher).not.toHaveBeenCalled();
});

test('checks session again before publishing a final result after the last dependency resolves', async () => {
  const f = fixture();
  f.responses['/v1/purchases/status'] = credited;
  const wallet = {
    getWallet: async () => {
      void Promise.resolve().then(() =>
        Promise.resolve().then(() => setAuthSession({ credential: 'synthetic.replacement' })),
      );
      return { outcome: 'ok' as const, data: { balance: 45, spending_available: true } };
    },
  };
  const c = createCheckoutCoordinator({ ...f.dependencies, wallet });
  await c.load();
  expect(await c.purchase(productId)).toEqual({ status: 'session_changed' });
});
