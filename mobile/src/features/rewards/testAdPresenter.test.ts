import { createTestAdPresenter } from './testAdPresenter';
import type { RewardIntent } from '../../api/rewards/types';

const mockDevice: { isDevice: boolean | undefined } = { isDevice: false };
jest.mock('expo-device', () => ({
  get isDevice() {
    return mockDevice.isDevice;
  },
}));
const PUBLISHER_UNIT = 'ca-app-pub-1111111111111111/2222222222';

const mockListeners = new Map<string, () => void>();
const mockInitialize = jest.fn(async () => []);
const mockGather = jest.fn(async () => ({ canRequestAds: true }));
const mockConsentInfo = jest.fn(async () => ({ canRequestAds: true }));
const mockShow = jest.fn(async () => {});
const mockLoad = jest.fn();
const mockRequestConfiguration = jest.fn(async () => {});
const mockCreate = jest.fn(() => ({
  load: mockLoad,
  show: mockShow,
  addAdEventListener: (event: string, callback: () => void) => {
    mockListeners.set(event, callback);
    return () => {
      mockListeners.delete(event);
    };
  },
}));
jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: () => ({
    initialize: mockInitialize,
    setRequestConfiguration: mockRequestConfiguration,
  }),
  AdsConsent: {
    gatherConsent: mockGather,
    getConsentInfo: mockConsentInfo,
    showPrivacyOptionsForm: jest.fn(),
  },
  TestIds: { REWARDED: 'ca-app-pub-3940256099942544/5224354917' },
  RewardedAd: { createForAdRequest: mockCreate },
  RewardedAdEventType: { LOADED: 'loaded', EARNED_REWARD: 'earned' },
  AdEventType: { CLOSED: 'closed', ERROR: 'error' },
}));
const INTENT: RewardIntent = {
  id: 'synthetic',
  episode_id: 'ep_synthetic',
  status: 'pending',
  expires_at: '2099-01-01T00:00:00Z',
  reward_description: 'Unlock one episode permanently',
  ad_unit_id: 'ca-app-pub-3940256099942544/5224354917',
  ssv_user_id: 'synthetic-user',
  custom_data: 'synthetic-binding',
};

beforeEach(() => {
  mockListeners.clear();
  mockDevice.isDevice = false;
  Object.defineProperty(globalThis, '__DEV__', { value: true, writable: true });
  mockGather.mockResolvedValue({ canRequestAds: true });
  mockConsentInfo.mockResolvedValue({ canRequestAds: true });
});

it('requires fresh consent before initializing or requesting an ad', async () => {
  mockGather.mockResolvedValue({ canRequestAds: false });
  const presenter = createTestAdPresenter('local', 'android');
  await expect(presenter.prepare(() => true)).rejects.toThrow();
  expect(mockInitialize).not.toHaveBeenCalled();
  expect(mockCreate).not.toHaveBeenCalled();
});

it.each([INTENT.ad_unit_id, PUBLISHER_UNIT])(
  'loads configured %s with server bindings and never resolves on client reward alone',
  async (unit) => {
    const presenter = createTestAdPresenter('local', 'android', unit);
    const intent = { ...INTENT, ad_unit_id: unit };
    await presenter.prepare(() => true);
    expect(mockRequestConfiguration).toHaveBeenCalledWith({ testDeviceIdentifiers: ['EMULATOR'] });
    expect(mockRequestConfiguration.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitialize.mock.invocationCallOrder[0] ?? 0,
    );
    let settled = false;
    const presentation = presenter
      .present(intent, () => true)
      .then((result) => {
        settled = true;
        return result;
      });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockCreate).toHaveBeenCalledWith(
      unit,
      expect.objectContaining({
        requestNonPersonalizedAdsOnly: true,
        serverSideVerificationOptions: {
          userId: INTENT.ssv_user_id,
          customData: INTENT.custom_data,
        },
      }),
    );
    mockListeners.get('loaded')?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockShow).toHaveBeenCalledTimes(1);
    mockListeners.get('earned')?.();
    await Promise.resolve();
    expect(settled).toBe(false);
    mockListeners.get('closed')?.();
    expect(await presentation).toBe('completed');
    expect(mockListeners.size).toBe(0);
  },
);

it.each([
  ['production', 'android'],
  ['local', 'ios'],
])('cannot initialize for %s/%s', async (environment, platform) => {
  await expect(createTestAdPresenter(environment, platform).prepare(() => true)).rejects.toThrow();
  expect(mockGather).not.toHaveBeenCalled();
  expect(mockCreate).not.toHaveBeenCalled();
});

it('rejects a live unit even when returned by a server', async () => {
  const presenter = createTestAdPresenter('local', 'android');
  await presenter.prepare(() => true);
  await expect(
    presenter.present({ ...INTENT, ad_unit_id: 'other-unit' }, () => true),
  ).rejects.toThrow();
  expect(mockCreate).not.toHaveBeenCalled();
});

it('cannot show a loaded ad after the session changes', async () => {
  const presenter = createTestAdPresenter('local', 'android');
  let current = true;
  await presenter.prepare(() => current);
  const outcome = presenter.present(INTENT, () => current).catch(() => 'cancelled');
  await new Promise((resolve) => setTimeout(resolve, 0));
  current = false;
  mockListeners.get('loaded')?.();
  expect(await outcome).toBe('cancelled');
  expect(mockShow).not.toHaveBeenCalled();
});

it.each([
  ['local', 'android', true, true],
  ['local', 'android', undefined, true],
  ['local', 'android', false, false],
  ['staging', 'android', false, true],
  ['production', 'android', false, true],
  ['local', 'ios', false, true],
] as const)(
  'blocks publisher ads before consent/SDK for %s/%s device=%s dev=%s',
  async (environment, platform, isDevice, dev) => {
    mockDevice.isDevice = isDevice;
    Object.defineProperty(globalThis, '__DEV__', { value: dev, writable: true });
    const presenter = createTestAdPresenter(environment, platform, PUBLISHER_UNIT);
    await expect(presenter.prepare(() => true)).rejects.toThrow();
    expect(mockGather).not.toHaveBeenCalled();
    expect(mockRequestConfiguration).not.toHaveBeenCalled();
    expect(mockInitialize).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  },
);

it('rejects a server unit that differs from the configured publisher unit before loading', async () => {
  const presenter = createTestAdPresenter('local', 'android', PUBLISHER_UNIT);
  await presenter.prepare(() => true);
  await expect(presenter.present(INTENT, () => true)).rejects.toThrow();
  expect(mockCreate).not.toHaveBeenCalled();
  expect(mockLoad).not.toHaveBeenCalled();
});
