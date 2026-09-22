import { fireEvent, waitFor } from '@testing-library/react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import UnlockRoute from '../../../app/unlock/[id]';
import { setAuthSession } from '../../auth/session';
import { renderWithSafeArea } from '../../testUtils';

jest.mock('expo-constants', () => ({ expoConfig: { extra: {} } }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'ep_synthetic' }),
  useFocusEffect: jest.fn(),
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => '11111111-1111-4111-8111-111111111111' }));
const mockRecords = new Map<string, string>();
let mockUnlocked = false;
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockRecords.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockRecords.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockRecords.delete(key);
  },
}));
const mockWallet = {
  getActivity: jest.fn(),
  getWallet: jest.fn(),
  resolve: jest.fn(),
  unlock: jest.fn(async (request) => {
    mockUnlocked = true;
    return { outcome: 'ok', data: { ...request, charged_coins: 1, balance: 99 } };
  }),
};
jest.mock('../../api/createAppClients', () => ({
  createAppCatalogClient: () => ({
    getEpisode: async () => ({
      outcome: 'ok',
      data: { id: 'ep_synthetic', title: 'Test episode' },
    }),
  }),
  createAppMeClient: () => ({
    getMe: async () => ({
      outcome: 'ok',
      data: { public_id: 'usr_synthetic', ads_consent: false, auto_unlock_next: false },
    }),
  }),
  createAppRewardsClient: () => ({
    offers: async () => ({
      outcome: 'ok',
      data: {
        decision: mockUnlocked ? 'granted' : 'locked',
        episode_id: 'ep_synthetic',
        policy_version: 'a'.repeat(64),
        coin_price: 1,
        lock_reasons: ['entitlement_required'],
        methods: [{ type: 'coin' }],
      },
    }),
  }),
  createAppWalletClient: () => mockWallet,
  createAppPlaybackClient: () => ({
    authorize: async () => ({ outcome: 'ok', data: { decision: 'granted' } }),
  }),
}));

function configure(environment = 'staging', mode = 'revenuecat_sandbox') {
  Constants.expoConfig!.extra = {
    api: {
      environment,
      baseUrl:
        environment === 'local' ? 'http://localhost:8000' : 'https://sandbox.example.invalid',
    },
    purchases: { mode, androidSdk: 'goog_SyntheticPublicAndroidSdk12345' },
    ads: {
      mode: 'disabled',
      androidAppId: 'ca-app-pub-3940256099942544~3347511713',
      rewardedUnitId: 'ca-app-pub-3940256099942544/5224354917',
    },
  };
}

beforeEach(() => {
  jest.replaceProperty(globalThis as typeof globalThis & { __DEV__: boolean }, '__DEV__', false);
  jest.replaceProperty(Platform, 'OS', 'android');
  mockRecords.clear();
  mockUnlocked = false;
  jest.clearAllMocks();
  mockWallet.getWallet.mockImplementation(async () => ({
    outcome: 'ok',
    data: { balance: mockUnlocked ? 99 : 100, spending_available: true },
  }));
  setAuthSession({ credential: 'mock.synthetic-hosted-unlock' });
  configure();
});
afterEach(() => {
  setAuthSession(null);
  jest.restoreAllMocks();
});

it('lets an Android staging release confirm a server-priced coin unlock and continue playback', async () => {
  const view = await renderWithSafeArea(<UnlockRoute />);
  await waitFor(() => expect(view.getByText('100 coins')).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: 'Use 1 coins' }));
  expect(mockWallet.unlock).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: 'Confirm 1 coins' }));
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/play/[id]',
      params: { id: 'ep_synthetic' },
    }),
  );
  expect(mockWallet.unlock).toHaveBeenCalledTimes(1);
  expect(mockWallet.unlock).toHaveBeenCalledWith({
    episode_id: 'ep_synthetic',
    request_id: '11111111-1111-4111-8111-111111111111',
    expected_policy_version: 'a'.repeat(64),
    expected_coin_price: 1,
  });
});

it.each([
  ['production', 'revenuecat_sandbox', 'android', true],
  ['staging', 'disabled', 'android', true],
  ['staging', 'revenuecat_sandbox', 'ios', true],
  ['staging', 'revenuecat_sandbox', 'android', false],
])(
  'keeps spending unavailable for %s / %s / %s / server=%s',
  async (environment, mode, platform, serverEnabled) => {
    configure(environment as string, mode as string);
    jest.replaceProperty(Platform, 'OS', platform as 'android' | 'ios');
    mockWallet.getWallet.mockResolvedValue({
      outcome: 'ok',
      data: { balance: 100, spending_available: serverEnabled },
    });
    const view = await renderWithSafeArea(<UnlockRoute />);
    await waitFor(() => expect(view.getByText('100 coins')).toBeTruthy());
    expect(view.queryByRole('button', { name: 'Use 1 coins' })).toBeNull();
    expect(mockWallet.unlock).not.toHaveBeenCalled();
  },
);

it('preserves the existing local Android test unlock', async () => {
  configure('local', 'disabled');
  const view = await renderWithSafeArea(<UnlockRoute />);
  await waitFor(() => expect(view.getByRole('button', { name: 'Use 1 coins' })).toBeTruthy());
});
