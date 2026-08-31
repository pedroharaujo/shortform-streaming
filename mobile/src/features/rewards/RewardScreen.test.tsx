import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { CatalogClient } from '../../api/catalog/types';
import type { MeClient } from '../../api/me/types';
import type { PlaybackClient } from '../../api/playback/types';
import type { RewardIntent, RewardsClient } from '../../api/rewards/types';
import { setAuthSession } from '../../auth/session';
import { RewardScreen } from './RewardScreen';
import type { RewardedAdPresenter } from './types';

const INTENT: RewardIntent = {
  id: '11111111-1111-4111-8111-111111111111',
  episode_id: 'ep_synthetic',
  status: 'pending',
  expires_at: '2099-01-01T00:00:00Z',
  reward_description: 'Watch one rewarded ad to unlock this episode permanently.',
  ad_unit_id: 'ca-app-pub-3940256099942544/5224354917',
  custom_data: 'synthetic-custom',
  ssv_user_id: 'synthetic-ssv',
};

async function setup(
  adsConsent = true,
  enabled = true,
  signedIn = true,
  configure?: (rewards: jest.Mocked<RewardsClient>) => void,
) {
  setAuthSession(signedIn ? { credential: 'mock.synthetic_rewards' } : null);
  const catalog = {
    getEpisode: jest.fn(async () => ({
      outcome: 'ok',
      data: { public_id: 'ep_synthetic', title: 'Synthetic episode 6' },
    })),
  } as unknown as CatalogClient;
  const me: MeClient = {
    getMe: jest.fn<ReturnType<MeClient['getMe']>, Parameters<MeClient['getMe']>>(async () => ({
      outcome: 'ok',
      data: {
        public_id: 'usr_synthetic',
        created_at: '2026-08-31T00:00:00Z',
        updated_at: '2026-08-31T00:00:00Z',
        locale: 'en',
        country: 'FR',
        ads_consent: adsConsent,
        analytics_consent: false,
        consent_updated_at: null,
      },
    })),
  };
  const rewards: jest.Mocked<RewardsClient> = {
    offers: jest.fn<ReturnType<RewardsClient['offers']>, Parameters<RewardsClient['offers']>>(
      async () => ({
        outcome: 'ok',
        data: {
          decision: 'locked',
          episode_id: 'ep_synthetic',
          lock_reasons: ['entitlement_required'],
          methods: [
            { type: 'rewarded_ad', title: 'Watch an ad', description: INTENT.reward_description },
          ],
        },
      }),
    ),
    create: jest.fn<ReturnType<RewardsClient['create']>, Parameters<RewardsClient['create']>>(
      async () => ({ outcome: 'ok', data: INTENT }),
    ),
    get: jest.fn<ReturnType<RewardsClient['get']>, Parameters<RewardsClient['get']>>(async () => ({
      outcome: 'ok',
      data: INTENT,
    })),
  };
  const presenter: jest.Mocked<RewardedAdPresenter> = {
    prepare: jest.fn<
      ReturnType<RewardedAdPresenter['prepare']>,
      Parameters<RewardedAdPresenter['prepare']>
    >(async () => {}),
    present: jest.fn<
      ReturnType<RewardedAdPresenter['present']>,
      Parameters<RewardedAdPresenter['present']>
    >(async () => 'completed'),
    privacy: jest.fn<
      ReturnType<RewardedAdPresenter['privacy']>,
      Parameters<RewardedAdPresenter['privacy']>
    >(async () => {}),
  };
  const onPlay = jest.fn();
  const playback: jest.Mocked<PlaybackClient> = {
    authorize: jest.fn<
      ReturnType<PlaybackClient['authorize']>,
      Parameters<PlaybackClient['authorize']>
    >(async () => ({
      outcome: 'ok' as const,
      data: {
        decision: 'granted' as const,
        playback_url: 'https://video.example.test/synthetic.m3u8',
        expires_at: '2099-01-01T00:00:00Z',
      },
    })),
  };
  configure?.(rewards);
  const view = await render(
    <RewardScreen
      episodeId="ep_synthetic"
      catalog={catalog}
      me={me}
      rewards={rewards}
      playback={playback}
      presenter={presenter}
      enabled={enabled}
      onClose={jest.fn()}
      onAccount={jest.fn()}
      onPlay={onPlay}
    />,
  );
  return { view, rewards, presenter, onPlay, me, playback };
}

afterEach(() => setAuthSession(null));

it.each([true, false])(
  'keeps privacy choices available without an offer (signed in: %s)',
  async (signedIn) => {
    const { view, presenter, rewards } = await setup(false, true, signedIn);
    await fireEvent.press(view.getByLabelText('Ad privacy choices'));
    await waitFor(() => expect(presenter.privacy).toHaveBeenCalled());
    expect(presenter.privacy.mock.calls[0]?.[0]()).toBe(true);
    expect(presenter.prepare).not.toHaveBeenCalled();
    expect(presenter.present).not.toHaveBeenCalled();
    expect(rewards.create).not.toHaveBeenCalled();
  },
);

it('discloses the episode and exact reward before opt-in, and client completion cannot unlock', async () => {
  const { view, rewards, presenter, onPlay } = await setup();
  await waitFor(() => expect(view.getByLabelText('Watch test ad')).toBeEnabled());
  expect(view.getByText('Synthetic episode 6')).toBeTruthy();
  expect(view.getByText(INTENT.reward_description)).toBeTruthy();
  expect(presenter.prepare).not.toHaveBeenCalled();
  expect(rewards.create).not.toHaveBeenCalled();
  await fireEvent.press(view.getByLabelText('Watch test ad'));
  await waitFor(() => expect(rewards.get).toHaveBeenCalled());
  expect(presenter.present).toHaveBeenCalledWith(INTENT, expect.any(Function));
  expect(onPlay).not.toHaveBeenCalled();
});

it('refreshes authoritative access and authorizes before entering playback', async () => {
  const { view, rewards, onPlay, playback } = await setup();
  await waitFor(() => expect(view.getByLabelText('Watch test ad')).toBeEnabled());
  let confirmAccess!: (value: Awaited<ReturnType<RewardsClient['offers']>>) => void;
  rewards.offers.mockImplementation(
    () =>
      new Promise((resolve) => {
        confirmAccess = resolve;
      }),
  );
  rewards.get.mockResolvedValue({ outcome: 'ok', data: { ...INTENT, status: 'granted' } });
  await fireEvent.press(view.getByLabelText('Watch test ad'));
  await waitFor(() => expect(rewards.offers).toHaveBeenCalledTimes(2));
  expect(playback.authorize).not.toHaveBeenCalled();
  expect(onPlay).not.toHaveBeenCalled();
  await act(async () => confirmAccess(GRANTED_ACCESS));
  await waitFor(() => expect(onPlay).toHaveBeenCalledWith('ep_synthetic'));
  expect(playback.authorize).toHaveBeenCalledWith('ep_synthetic');
});

it('cannot initialize ads without the account preference', async () => {
  const { view, presenter, rewards } = await setup(false);
  await waitFor(() => expect(view.getByText(/Ads preference is off/)).toBeTruthy());
  expect(view.queryByLabelText('Watch test ad')).toBeNull();
  expect(presenter.prepare).not.toHaveBeenCalled();
  expect(rewards.create).not.toHaveBeenCalled();
});

it('fails closed if UMP consent is unavailable', async () => {
  const { view, presenter, rewards, onPlay } = await setup();
  presenter.prepare.mockRejectedValue(new Error('synthetic-private-provider-detail'));
  await waitFor(() => expect(view.getByLabelText('Watch test ad')).toBeEnabled());
  await fireEvent.press(view.getByLabelText('Watch test ad'));
  await waitFor(() => expect(view.getByText(/could not start/)).toBeTruthy());
  expect(rewards.create).not.toHaveBeenCalled();
  expect(presenter.present).not.toHaveBeenCalled();
  expect(view.queryByText('synthetic-private-provider-detail')).toBeNull();
  expect(onPlay).not.toHaveBeenCalled();
});

it('guards duplicate taps and ignores a late grant after account replacement', async () => {
  const { view, presenter, rewards, onPlay } = await setup();
  let complete!: (value: 'completed') => void;
  presenter.present.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  rewards.get.mockResolvedValue({ outcome: 'ok', data: { ...INTENT, status: 'granted' } });
  await waitFor(() => expect(view.getByLabelText('Watch test ad')).toBeEnabled());
  const button = view.getByLabelText('Watch test ad');
  await fireEvent.press(button);
  await fireEvent.press(view.getByLabelText('Check reward status'));
  await waitFor(() => expect(presenter.present).toHaveBeenCalledTimes(1));
  expect(rewards.create).toHaveBeenCalledTimes(1);
  setAuthSession({ credential: 'mock.replacement' });
  await act(async () => complete('completed'));
  expect(onPlay).not.toHaveBeenCalled();
  expect(rewards.get).not.toHaveBeenCalled();
});

it('does not contact the ad SDK for production configuration', async () => {
  const { view, presenter, rewards } = await setup(true, false);
  await waitFor(() => expect(view.getByText(/Test ads are unavailable/)).toBeTruthy());
  expect(presenter.prepare).not.toHaveBeenCalled();
  expect(rewards.create).not.toHaveBeenCalled();
});

it('can confirm a delayed reward after ad failure without creating or presenting another ad', async () => {
  const { view, presenter, rewards, onPlay } = await setup();
  presenter.present.mockRejectedValue(new Error('synthetic no fill'));
  await waitFor(() => expect(view.getByLabelText('Watch test ad')).toBeEnabled());
  await fireEvent.press(view.getByLabelText('Watch test ad'));
  await waitFor(() => expect(view.getByLabelText('Check reward status')).toBeEnabled());
  expect(onPlay).not.toHaveBeenCalled();
  rewards.get.mockResolvedValue({ outcome: 'ok', data: { ...INTENT, status: 'granted' } });
  rewards.offers.mockResolvedValue(GRANTED_ACCESS);
  await fireEvent.press(view.getByLabelText('Check reward status'));
  await waitFor(() => expect(onPlay).toHaveBeenCalledWith('ep_synthetic'));
  expect(rewards.create).toHaveBeenCalledTimes(1);
  expect(presenter.present).toHaveBeenCalledTimes(1);
});

const GRANTED_ACCESS = {
  outcome: 'ok' as const,
  data: {
    decision: 'granted' as const,
    episode_id: 'ep_synthetic',
    methods: [
      { type: 'entitlement' as const, title: 'Unlocked', description: 'Already unlocked.' },
    ],
  },
};

it.each(['unreachable', 'no-method', 'mismatched'] as const)(
  'does not offer an ad for %s access',
  async (failure) => {
    const { view, rewards, presenter } = await setup(true, true, true, (client) => {
      client.offers.mockResolvedValue(
        failure === 'unreachable'
          ? { outcome: 'unreachable', reason: 'synthetic-private-network-detail' }
          : {
              outcome: 'ok',
              data: {
                decision: 'locked',
                episode_id: failure === 'mismatched' ? 'ep_other' : 'ep_synthetic',
                lock_reasons: ['entitlement_required'],
                methods:
                  failure === 'mismatched'
                    ? [{ type: 'rewarded_ad', title: 'Watch', description: 'Wrong episode' }]
                    : [],
              },
            },
      );
    });
    await waitFor(() => expect(view.getByLabelText('Refresh reward offer')).toBeEnabled());
    if (failure === 'unreachable') expect(view.getByText(/Check your connection/)).toBeTruthy();
    expect(view.queryByLabelText('Watch test ad')).toBeNull();
    expect(rewards.create).not.toHaveBeenCalled();
    expect(presenter.prepare).not.toHaveBeenCalled();
    expect(view.queryByText('synthetic-private-network-detail')).toBeNull();
  },
);

it('keeps a granted reward on the sheet when fresh playback authorization denies access', async () => {
  const { view, rewards, onPlay, playback } = await setup();
  await waitFor(() => expect(view.getByLabelText('Watch test ad')).toBeEnabled());
  rewards.get.mockResolvedValue({ outcome: 'ok', data: { ...INTENT, status: 'granted' } });
  rewards.offers.mockResolvedValue(GRANTED_ACCESS);
  playback.authorize.mockResolvedValue({
    outcome: 'locked',
    lockReasons: ['entitlement_required'],
  });
  await fireEvent.press(view.getByLabelText('Watch test ad'));
  await waitFor(() => expect(playback.authorize).toHaveBeenCalled());
  expect(onPlay).not.toHaveBeenCalled();
  expect(view.getByLabelText('Check reward status')).toBeEnabled();
});

it('retries a lost creation response with the same request id', async () => {
  const { view, rewards, presenter } = await setup();
  rewards.create.mockResolvedValueOnce({ outcome: 'unreachable', reason: 'Connection lost' });
  presenter.present.mockRejectedValue(new Error('synthetic no fill'));
  await waitFor(() => expect(view.getByLabelText('Watch test ad')).toBeEnabled());
  await fireEvent.press(view.getByLabelText('Watch test ad'));
  await waitFor(() => expect(view.getByLabelText('Watch test ad')).toBeEnabled());
  await fireEvent.press(view.getByLabelText('Watch test ad'));
  await waitFor(() => expect(rewards.create).toHaveBeenCalledTimes(2));
  expect(rewards.create.mock.calls[0]).toEqual(rewards.create.mock.calls[1]);
  expect(presenter.present).toHaveBeenCalledTimes(1);
});

it.each(['locked', 'unreachable', 'mismatched'] as const)(
  'does not trust a historical grant when refreshed access is %s',
  async (failure) => {
    const { view, rewards, playback, onPlay } = await setup();
    await waitFor(() => expect(view.getByLabelText('Watch test ad')).toBeEnabled());
    rewards.get.mockResolvedValue({ outcome: 'ok', data: { ...INTENT, status: 'granted' } });
    rewards.offers.mockResolvedValue(
      failure === 'unreachable'
        ? { outcome: 'unreachable', reason: 'Connection lost' }
        : failure === 'mismatched'
          ? { ...GRANTED_ACCESS, data: { ...GRANTED_ACCESS.data, episode_id: 'ep_other' } }
          : {
              outcome: 'ok',
              data: {
                decision: 'locked',
                episode_id: 'ep_synthetic',
                lock_reasons: ['entitlement_required'],
                methods: [],
              },
            },
    );
    await fireEvent.press(view.getByLabelText('Watch test ad'));
    await waitFor(() => expect(view.getByLabelText('Check reward status')).toBeEnabled());
    expect(playback.authorize).not.toHaveBeenCalled();
    expect(onPlay).not.toHaveBeenCalled();
  },
);

it.each(['close', 'session-change'] as const)(
  'ignores a late playback authorization after %s',
  async (ending) => {
    const { view, rewards, playback, onPlay } = await setup();
    await waitFor(() => expect(view.getByLabelText('Watch test ad')).toBeEnabled());
    rewards.get.mockResolvedValue({ outcome: 'ok', data: { ...INTENT, status: 'granted' } });
    rewards.offers.mockResolvedValue(GRANTED_ACCESS);
    let authorize!: (value: Awaited<ReturnType<PlaybackClient['authorize']>>) => void;
    playback.authorize.mockImplementation(
      () =>
        new Promise((resolve) => {
          authorize = resolve;
        }),
    );
    await fireEvent.press(view.getByLabelText('Watch test ad'));
    await waitFor(() => expect(playback.authorize).toHaveBeenCalled());
    if (ending === 'close') await fireEvent.press(view.getByLabelText('Close reward'));
    else setAuthSession({ credential: 'mock.replacement' });
    await act(async () =>
      authorize({
        outcome: 'ok',
        data: {
          decision: 'granted',
          playback_url: 'https://video.example.test/synthetic.m3u8',
          expires_at: '2099-01-01T00:00:00Z',
        },
      }),
    );
    expect(onPlay).not.toHaveBeenCalled();
  },
);

it('continues an already unlocked episode without ad consent or an enabled ad build', async () => {
  const { view, rewards, presenter, playback, onPlay } = await setup(false, false, true, (client) =>
    client.offers.mockResolvedValue(GRANTED_ACCESS),
  );
  await waitFor(() => expect(view.getByLabelText('Continue to playback')).toBeEnabled());
  await fireEvent.press(view.getByLabelText('Continue to playback'));
  await waitFor(() => expect(onPlay).toHaveBeenCalledWith('ep_synthetic'));
  expect(rewards.offers).toHaveBeenCalledTimes(2);
  expect(playback.authorize).toHaveBeenCalledTimes(1);
  expect(rewards.create).not.toHaveBeenCalled();
  expect(presenter.prepare).not.toHaveBeenCalled();
});

it('keeps actions unavailable during loading and can recover from an offline offer', async () => {
  let loadOffer!: (value: Awaited<ReturnType<RewardsClient['offers']>>) => void;
  const { view, rewards } = await setup(true, true, true, (client) =>
    client.offers.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          loadOffer = resolve;
        }),
    ),
  );
  expect(view.getByLabelText('Checking episode access')).toBeTruthy();
  expect(view.queryByLabelText('Watch test ad')).toBeNull();
  expect(view.queryByLabelText('Refresh reward offer')).toBeNull();
  await act(async () => loadOffer({ outcome: 'unreachable', reason: 'Offline' }));
  await fireEvent.press(view.getByLabelText('Refresh reward offer'));
  await waitFor(() => expect(view.getByLabelText('Watch test ad')).toBeEnabled());
  expect(rewards.create).not.toHaveBeenCalled();
});
