import { useState, type JSX } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { CatalogClient } from '../../api/catalog/types';
import type { MeClient } from '../../api/me/types';
import type { PlaybackClient } from '../../api/playback/types';
import type { RewardIntent, RewardsClient } from '../../api/rewards/types';
import type { WalletClient } from '../../api/wallet/types';
import { setAuthSession } from '../../auth/session';
import { RewardScreen } from '../rewards/RewardScreen';
import { writePendingRewardAttempt } from '../rewards/pendingRewardAttempt';
import type { RewardAnalytics } from '../rewards/rewardAnalytics';
import type { RewardedAdPresenter } from '../rewards/types';
import { EpisodeUnlockScreen } from './EpisodeUnlockScreen';

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
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '33333333-3333-4333-8333-333333333333'),
}));

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
  setAuthSession({ credential: 'mock.synthetic-interrupted-ad' });
});

afterEach(() => setAuthSession(null));

it('reconciles an interrupted ad granted by the server when reopening episode choices', async () => {
  const intent: RewardIntent = {
    id: '11111111-1111-4111-8111-111111111111',
    episode_id: 'ep_synthetic',
    status: 'granted',
    expires_at: '2099-01-01T00:00:00Z',
    reward_description: 'Synthetic reward terms.',
    ad_unit_id: 'ca-app-pub-3940256099942544/5224354917',
    custom_data: 'synthetic-custom-data',
    ssv_user_id: 'synthetic-ssv-user',
    grant_source: 'admob_ssv',
  };
  await writePendingRewardAttempt({
    version: 1,
    profileId: 'usr_synthetic',
    episodeId: intent.episode_id,
    requestId: '22222222-2222-4222-8222-222222222222',
    intentId: intent.id,
  });
  const catalog = {
    getEpisode: jest.fn(async () => ({
      outcome: 'ok',
      data: {
        id: intent.episode_id,
        title: 'Synthetic interrupted episode',
        synopsis: 'Synthetic synopsis',
        duration_seconds: 90,
        order: 6,
        series_id: 'ser_synthetic',
        season_number: 1,
      },
    })),
  } as unknown as CatalogClient;
  const me: MeClient = {
    getMe: jest.fn<ReturnType<MeClient['getMe']>, Parameters<MeClient['getMe']>>(async () => ({
      outcome: 'ok',
      data: {
        public_id: 'usr_synthetic',
        created_at: '2026-09-07T00:00:00Z',
        updated_at: '2026-09-07T00:00:00Z',
        locale: 'en',
        country: 'FR',
        ads_consent: false,
        analytics_consent: true,
        consent_updated_at: '2026-09-07T00:00:00Z',
      },
    })),
  };
  const rewards: RewardsClient = {
    offers: jest.fn<ReturnType<RewardsClient['offers']>, Parameters<RewardsClient['offers']>>(
      async () => ({
        outcome: 'ok',
        data: {
          decision: 'granted',
          episode_id: intent.episode_id,
          policy_version: 'a'.repeat(64),
          coin_price: null,
          methods: [{ type: 'entitlement', title: 'Unlocked', description: 'Already unlocked.' }],
        },
      }),
    ),
    get: jest.fn<ReturnType<RewardsClient['get']>, Parameters<RewardsClient['get']>>(async () => ({
      outcome: 'ok',
      data: intent,
    })),
    create: jest.fn(),
  };
  const wallet: WalletClient = {
    resolve: jest.fn(),
    getWallet: jest.fn<ReturnType<WalletClient['getWallet']>, []>(async () => ({
      outcome: 'ok',
      data: { balance: 20, spending_available: false },
    })),
    unlock: jest.fn(),
  };
  const playback: PlaybackClient = {
    authorize: jest.fn<
      ReturnType<PlaybackClient['authorize']>,
      Parameters<PlaybackClient['authorize']>
    >(async () => ({
      outcome: 'ok',
      data: {
        decision: 'granted',
        access_method: 'rewarded_ad',
        playback_url: 'https://video.example.test/synthetic.m3u8',
        expires_at: '2099-01-01T00:00:00Z',
      },
    })),
  };
  const analytics: RewardAnalytics = {
    recordAdEvent: jest.fn(async () => undefined),
    recordGranted: jest.fn(async () => undefined),
    recordFailed: jest.fn(async () => undefined),
  };
  const presenter: RewardedAdPresenter = {
    prepare: jest.fn(),
    present: jest.fn(),
    privacy: jest.fn(),
  };
  const onPlay = jest.fn();
  const onAd = jest.fn();
  function ReopenedEpisode(): JSX.Element {
    const [recoverAd, setRecoverAd] = useState(false);
    const shared = { episodeId: intent.episode_id, catalog, me, rewards, playback, onPlay };
    return recoverAd ? (
      <RewardScreen
        {...shared}
        analytics={analytics}
        presenter={presenter}
        enabled={false}
        onClose={jest.fn()}
        onAccount={jest.fn()}
      />
    ) : (
      <EpisodeUnlockScreen
        {...shared}
        wallet={wallet}
        adsEnabled={false}
        coinsEnabled={false}
        onClose={jest.fn()}
        onAccount={jest.fn()}
        onWallet={jest.fn()}
        onAd={(episodeId) => {
          onAd(episodeId);
          setRecoverAd(true);
        }}
      />
    );
  }

  const view = await render(<ReopenedEpisode />);
  await waitFor(() => expect(onAd).toHaveBeenCalledWith(intent.episode_id));
  await waitFor(() => expect(analytics.recordGranted).toHaveBeenCalledTimes(1));
  expect(rewards.get).toHaveBeenCalledWith(intent.id);
  expect(analytics.recordGranted).toHaveBeenCalledWith(
    { seriesId: 'ser_synthetic', episodeId: intent.episode_id, seasonNumber: 1, episodeNumber: 6 },
    intent.id,
    'admob_ssv',
  );
  await waitFor(() => expect(mockStore.size).toBe(0));
  expect(rewards.create).not.toHaveBeenCalled();
  expect(wallet.unlock).not.toHaveBeenCalled();
  expect(presenter.prepare).not.toHaveBeenCalled();
  expect(presenter.present).not.toHaveBeenCalled();
  expect(onPlay).not.toHaveBeenCalled();
  await fireEvent.press(await view.findByLabelText('Continue to playback'));
  await waitFor(() => expect(onPlay).toHaveBeenCalledWith(intent.episode_id));
  expect(playback.authorize).toHaveBeenCalledWith(intent.episode_id);
});
