import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { CatalogClient } from '../../api/catalog/types';
import type { MeClient } from '../../api/me/types';
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

async function setup(adsConsent = true, enabled = true, signedIn = true) {
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
  const view = await render(
    <RewardScreen
      episodeId="ep_synthetic"
      catalog={catalog}
      me={me}
      rewards={rewards}
      presenter={presenter}
      enabled={enabled}
      onClose={jest.fn()}
      onAccount={jest.fn()}
      onPlay={onPlay}
    />,
  );
  return { view, rewards, presenter, onPlay, me };
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

it('uses only verified server status before returning through playback authorization', async () => {
  const { view, rewards, onPlay } = await setup();
  rewards.get.mockResolvedValue({ outcome: 'ok', data: { ...INTENT, status: 'granted' } });
  await waitFor(() => expect(view.getByLabelText('Watch test ad')).toBeEnabled());
  await fireEvent.press(view.getByLabelText('Watch test ad'));
  await waitFor(() => expect(onPlay).toHaveBeenCalledWith('ep_synthetic'));
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
  await fireEvent.press(view.getByLabelText('Check reward status'));
  await waitFor(() => expect(onPlay).toHaveBeenCalledWith('ep_synthetic'));
  expect(rewards.create).toHaveBeenCalledTimes(1);
  expect(presenter.present).toHaveBeenCalledTimes(1);
});
