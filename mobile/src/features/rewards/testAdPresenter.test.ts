import { createTestAdPresenter } from './testAdPresenter';
import type { RewardIntent } from '../../api/rewards/types';

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

it('only loads the demo unit with server SSV bindings and never resolves on client reward alone', async () => {
  const presenter = createTestAdPresenter('local', 'android');
  await presenter.prepare(() => true);
  let settled = false;
  const presentation = presenter
    .present(INTENT, () => true)
    .then((result) => {
      settled = true;
      return result;
    });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mockCreate).toHaveBeenCalledWith(
    INTENT.ad_unit_id,
    expect.objectContaining({
      requestNonPersonalizedAdsOnly: true,
      serverSideVerificationOptions: { userId: INTENT.ssv_user_id, customData: INTENT.custom_data },
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
});

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
