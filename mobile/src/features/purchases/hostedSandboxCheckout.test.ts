import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { resolveApiConfiguration, resolvePurchaseConfiguration } from '../../../app.config';
import { jsonResponse, requestHeaders, requestUrl } from '../../api/fetchTestUtils';
import { createAppPurchaseCheckoutClient } from '../../api/createAppClients';
import { setAuthSession } from '../../auth/session';
import { createAppCheckoutCoordinator } from './createAppCheckoutCoordinator';
import { createRevenueCatProvider } from './revenueCatProvider';

jest.mock('expo-constants', () => ({
  expoConfig: { extra: {}, android: { package: 'com.example.stovio' } },
}));
jest.mock('../../appCheck/nativeAppCheck', () => ({
  getNativeAppCheckToken: async () => 'synthetic.attestation',
}));
jest.mock('./revenueCatProvider', () => ({ createRevenueCatProvider: jest.fn() }));
jest.mock('expo-secure-store', () => {
  const records = new Map<string, string>();
  return {
    getItemAsync: async (key: string) => records.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      records.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      records.delete(key);
    },
  };
});
jest.mock('expo-crypto', () => ({
  randomUUID: () => '33333333-3333-4333-8333-333333333333',
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, value: string) =>
    jest.requireActual('crypto').createHash('sha256').update(value).digest('hex'),
}));

const ownerId = '11111111-1111-4111-8111-111111111111';
const applicationId = 'com.example.stovio';
const productId = 'test_coins';
const scope = { ownerId, applicationId, productId, store: 'PLAY_STORE', environment: 'SANDBOX' };
const provider = {
  prepare: jest.fn(async () => ({ ownerId, applicationId })),
  getOffers: jest.fn(async () => [
    { ...scope, productType: 'consumable', price: '€1.99', priceAmount: 1.99, currencyCode: 'EUR' },
  ]),
  purchase: jest.fn(async () => ({
    ...scope,
    outcome: 'completed',
    transactionId: 'GPA.synthetic-order',
  })),
};
const originalFetch = globalThis.fetch;
let fetcher: jest.Mock;

beforeEach(() => {
  jest.replaceProperty(globalThis as typeof globalThis & { __DEV__: boolean }, '__DEV__', false);
  jest.replaceProperty(Platform, 'OS', 'android');
  const source = {
    NODE_ENV: 'production',
    EXPO_PUBLIC_API_ENVIRONMENT: 'staging',
    EXPO_PUBLIC_API_BASE_URL: 'https://sandbox.example.invalid',
    EXPO_PUBLIC_COIN_PURCHASE_MODE: 'revenuecat_sandbox',
    EXPO_PUBLIC_REVENUECAT_ANDROID_SDK: 'goog_SyntheticPublicAndroidSdk12345',
  };
  Constants.expoConfig!.extra = {
    api: resolveApiConfiguration(source),
    purchases: resolvePurchaseConfiguration(source, 'staging'),
    appCheck: { mode: 'enforce' },
  };
  const responses: Record<string, unknown> = {
    '/v1/purchases/identity': { app_user_id: ownerId },
    '/v1/purchases/catalog': {
      products: [
        {
          product_id: productId,
          coins: 100,
          product_type: 'consumable',
          store: 'PLAY_STORE',
          environment: 'SANDBOX',
          price_source: 'store',
        },
      ],
    },
    '/v1/purchases/sync': {
      status: 'credited',
      historical_credited_coins: 100,
      support_reference: ownerId,
    },
    '/v1/wallet': { balance: 100, spending_available: true },
  };
  fetcher = jest.fn(async (input: RequestInfo | URL) =>
    jsonResponse(responses[new URL(requestUrl(input)).pathname], 200),
  );
  globalThis.fetch = fetcher as typeof fetch;
  jest.mocked(createRevenueCatProvider).mockReturnValue(provider);
  setAuthSession({ credential: 'synthetic.firebase-session' });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  setAuthSession(null);
  jest.restoreAllMocks();
});

test('staging Android release reaches verified sandbox checkout through the app factory', async () => {
  const checkout = createAppCheckoutCoordinator();
  expect(await checkout.load()).toEqual({
    status: 'ready',
    offers: [{ productId, coins: 100, price: '€1.99', priceAmount: 1.99, currencyCode: 'EUR' }],
  });
  expect(await checkout.purchase(productId)).toEqual({
    status: 'credited',
    historicalCreditedCoins: 100,
    supportReference: ownerId,
    wallet: { status: 'available', data: { balance: 100, spending_available: true } },
  });
  expect(provider.purchase).toHaveBeenCalledWith(scope);
  for (const [input, init] of fetcher.mock.calls) {
    expect(requestUrl(input)).toMatch(/^https:\/\/sandbox\.example\.invalid\//);
    expect(requestHeaders(input, init).get('Authorization')).toBe(
      'Bearer synthetic.firebase-session',
    );
    expect(requestHeaders(input, init).get('X-Firebase-AppCheck')).toBe('synthetic.attestation');
  }
});

test.each([
  {
    environment: 'production',
    mode: 'revenuecat_sandbox',
    platform: 'android',
    baseUrl: 'https://sandbox.example.invalid',
  },
  {
    environment: 'staging',
    mode: 'synthetic',
    platform: 'android',
    baseUrl: 'https://sandbox.example.invalid',
  },
  {
    environment: 'staging',
    mode: 'revenuecat_sandbox',
    platform: 'ios',
    baseUrl: 'https://sandbox.example.invalid',
  },
  {
    environment: 'staging',
    mode: 'revenuecat_sandbox',
    platform: 'android',
    baseUrl: 'http://sandbox.example.invalid',
  },
  {
    environment: 'local',
    mode: 'revenuecat_sandbox',
    platform: 'android',
    baseUrl: 'http://localhost:8000',
  },
] as const)(
  'rejects unsupported checkout before dependencies execute: %j',
  async ({ environment, mode, platform, baseUrl }) => {
    Constants.expoConfig!.extra!.api = { environment, baseUrl };
    Constants.expoConfig!.extra!.purchases.mode = mode;
    jest.replaceProperty(Platform, 'OS', platform);
    const checkout = createAppCheckoutCoordinator();
    expect(await checkout.load()).toEqual({ status: 'unavailable' });
    expect(await checkout.purchase(productId)).toEqual({ status: 'unavailable' });
    expect(await checkout.sync()).toEqual({ status: 'unavailable' });
    expect(fetcher).not.toHaveBeenCalled();
    expect(createRevenueCatProvider).not.toHaveBeenCalled();
  },
);

test.each([
  ['staging', 'synthetic', 'https://sandbox.example.invalid'],
  ['production', 'synthetic', 'https://sandbox.example.invalid'],
  ['production', 'revenuecat_sandbox', 'https://sandbox.example.invalid'],
  ['staging', 'revenuecat_sandbox', 'http://sandbox.example.invalid'],
] as const)(
  'blocks direct %s/%s app checkout calls using %s',
  async (environment, mode, baseUrl) => {
    Constants.expoConfig!.extra!.api = { environment, baseUrl };
    const checkout = createAppPurchaseCheckoutClient(mode);
    expect((await checkout.getIdentity()).outcome).toBe('unavailable');
    expect(fetcher).not.toHaveBeenCalled();
  },
);
