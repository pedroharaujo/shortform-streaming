import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AppState, type AppStateStatus } from 'react-native';
import type { CatalogClient } from '../../api/catalog/types';
import type { MeClient } from '../../api/me/types';
import type { PlaybackClient } from '../../api/playback/types';
import type { EpisodeOffers, RewardsClient } from '../../api/rewards/types';
import type { WalletClient } from '../../api/wallet/types';
import { createWalletClient } from '../../api/wallet/walletClient';
import { setAuthSession } from '../../auth/session';
import { EpisodeUnlockScreen } from './EpisodeUnlockScreen';
import { writePendingCoinUnlock } from './pendingCoinUnlock';

const mockSecureStore = new Map<string, string>();
let mockSequence = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `00000000-0000-4000-8000-${String(++mockSequence).padStart(12, '0')}`,
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStore.delete(key);
  }),
}));

function setup(methods: ('coin' | 'rewarded_ad')[] = ['coin'], adsEnabled = false) {
  const offers: EpisodeOffers = {
    decision: 'locked',
    episode_id: 'ep_synthetic',
    policy_version: 'a'.repeat(64),
    coin_price: methods.includes('coin') ? 5 : null,
    lock_reasons: ['entitlement_required'],
    methods: methods.map((type) => ({
      type,
      title: 'Synthetic option',
      description: 'Synthetic terms',
    })),
  };
  const catalog = {
    getEpisode: jest.fn(async () => ({
      outcome: 'ok',
      data: {
        id: 'ep_synthetic',
        title: 'Synthetic episode',
        synopsis: 'Synthetic synopsis',
        duration_seconds: 90,
        order: 6,
        series_id: 'ser_synthetic',
        season_number: 1,
      },
    })),
  } as unknown as CatalogClient;
  const me: jest.Mocked<MeClient> = {
    getMe: jest.fn<ReturnType<MeClient['getMe']>, Parameters<MeClient['getMe']>>(async () => ({
      outcome: 'ok',
      data: {
        public_id: 'usr_synthetic',
        created_at: '2026-09-07T00:00:00Z',
        updated_at: '2026-09-07T00:00:00Z',
        locale: 'en',
        country: 'FR',
        ads_consent: false,
        analytics_consent: false,
        consent_updated_at: null,
      },
    })),
  };
  const rewards = {
    offers: jest.fn(async () => ({ outcome: 'ok', data: offers })),
  } as unknown as jest.Mocked<RewardsClient>;
  const wallet: jest.Mocked<WalletClient> = {
    resolve: jest.fn<ReturnType<WalletClient['resolve']>, Parameters<WalletClient['resolve']>>(
      async () => ({ outcome: 'unreachable', reason: 'timeout' }),
    ),
    getWallet: jest.fn<
      ReturnType<WalletClient['getWallet']>,
      Parameters<WalletClient['getWallet']>
    >(async () => ({ outcome: 'ok', data: { balance: 20, spending_available: true } })),
    unlock: jest.fn<ReturnType<WalletClient['unlock']>, Parameters<WalletClient['unlock']>>(
      async (request) => ({
        outcome: 'ok',
        data: {
          episode_id: request.episode_id,
          request_id: request.request_id,
          charged_coins: 5,
          balance: 15,
        },
      }),
    ),
  };
  const playback: jest.Mocked<PlaybackClient> = {
    authorize: jest.fn<
      ReturnType<PlaybackClient['authorize']>,
      Parameters<PlaybackClient['authorize']>
    >(async () => ({
      outcome: 'ok',
      data: {
        decision: 'granted',
        access_method: 'coin',
        playback_url: 'https://video.example.test/synthetic.m3u8',
        expires_at: '2099-01-01T00:00:00Z',
      },
    })),
  };
  const props = {
    episodeId: 'ep_synthetic',
    catalog,
    me,
    rewards,
    wallet,
    playback,
    adsEnabled,
    coinsEnabled: true,
    onClose: jest.fn(),
    onAccount: jest.fn(),
    onPlay: jest.fn(),
    onAd: jest.fn(),
    onWallet: jest.fn(),
  };
  return { props, offers, wallet, me, rewards, playback };
}

beforeEach(() => {
  mockSecureStore.clear();
  mockSequence = 0;
  jest.clearAllMocks();
  setAuthSession({ credential: 'mock.synthetic_coin' });
});
afterEach(() => {
  jest.restoreAllMocks();
});

const savedRequest = {
  episode_id: 'ep_synthetic',
  request_id: '11111111-1111-4111-8111-111111111111',
  expected_policy_version: 'a'.repeat(64),
  expected_coin_price: 5,
};

async function saveInterruptedUnlock() {
  await writePendingCoinUnlock({ version: 1, profileId: 'usr_synthetic', request: savedRequest });
}

const resolution = (status: 'completed' | 'cancelled') => ({
  episode_id: savedRequest.episode_id,
  request_id: savedRequest.request_id,
  charged_coins: status === 'completed' ? 5 : 0,
  balance: status === 'completed' ? 15 : 20,
  status,
});

it('cancels a saved-before-send request and requires fresh confirmation with a new UUID', async () => {
  await saveInterruptedUnlock();
  const { props, wallet, rewards, offers } = setup();
  wallet.resolve.mockImplementation(async () => {
    rewards.offers.mockResolvedValue({
      outcome: 'ok',
      data: { ...offers, coin_price: 8, policy_version: 'b'.repeat(64) },
    });
    return { outcome: 'ok', data: resolution('cancelled') };
  });
  const view = await render(<EpisodeUnlockScreen {...props} />);
  await fireEvent.press(await view.findByText('Check coin unlock'));
  await view.findByText('Use 8 coins');
  expect(wallet.resolve).toHaveBeenCalledWith(savedRequest);
  expect(wallet.unlock).not.toHaveBeenCalled();
  expect(mockSecureStore.size).toBe(0);
  expect(view.queryByText('Confirm 8 coins')).toBeNull();
  await fireEvent.press(view.getByText('Use 8 coins'));
  await fireEvent.press(view.getByText('Confirm 8 coins'));
  expect(wallet.unlock).toHaveBeenCalledWith({
    ...savedRequest,
    request_id: expect.not.stringMatching(savedRequest.request_id),
    expected_coin_price: 8,
    expected_policy_version: 'b'.repeat(64),
  });
});

it('resolves a lost completed response before already-granted playback using fresh authority', async () => {
  await saveInterruptedUnlock();
  const { props, wallet, rewards, offers, playback } = setup();
  rewards.offers.mockResolvedValue({
    outcome: 'ok',
    data: { ...offers, decision: 'granted', methods: [] },
  });
  wallet.resolve.mockImplementation(
    createWalletClient({
      baseUrl: 'https://api.example.test',
      getCredential: () => 'mock.synthetic_coin',
      fetchImplementation: async () =>
        new Response(JSON.stringify(resolution('completed')), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    }).resolve,
  );
  const view = await render(<EpisodeUnlockScreen {...props} />);
  await view.findByText('Check coin unlock');
  expect(view.queryByText('Play')).toBeNull();
  await fireEvent.press(view.getByText('Check coin unlock'));
  await waitFor(() => expect(props.onPlay).toHaveBeenCalledWith('ep_synthetic'));
  expect(wallet.resolve).toHaveBeenCalledWith(savedRequest);
  expect(wallet.unlock).not.toHaveBeenCalled();
  expect(rewards.offers).toHaveBeenCalledTimes(2);
  expect(wallet.getWallet).toHaveBeenCalledTimes(2);
  expect(playback.authorize).toHaveBeenCalledTimes(1);
  expect(mockSecureStore.size).toBe(0);
});

it.each(['completed', 'cancelled'] as const)(
  'resolves %s accounting after takedown without playable access or enabled spending',
  async (status) => {
    await saveInterruptedUnlock();
    const { props, wallet, rewards, playback } = setup();
    jest.mocked(props.catalog.getEpisode).mockResolvedValue({
      outcome: 'not-found',
      httpStatus: 404,
      code: 'not_found',
      message: 'Unavailable',
    });
    rewards.offers.mockResolvedValue({
      outcome: 'not-found',
      httpStatus: 404,
      code: 'not_found',
      message: 'Unavailable',
    });
    wallet.getWallet.mockResolvedValue({ outcome: 'unreachable', reason: 'offline' });
    wallet.resolve.mockResolvedValue({ outcome: 'ok', data: resolution(status) });
    const view = await render(<EpisodeUnlockScreen {...props} coinsEnabled={false} />);
    await fireEvent.press(await view.findByText('Check coin unlock'));
    await waitFor(() => expect(mockSecureStore.size).toBe(0));
    expect(wallet.resolve).toHaveBeenCalledWith(savedRequest);
    expect(wallet.unlock).not.toHaveBeenCalled();
    expect(playback.authorize).not.toHaveBeenCalled();
    expect(props.onPlay).not.toHaveBeenCalled();
  },
);

it.each([
  { status: 'unknown' },
  { status: 'cancelled', charged_coins: 5 },
  { episode_id: 'ep_other' },
  { request_id: '22222222-2222-4222-8222-222222222222' },
  { charged_coins: 7 },
  { charged_coins: -1 },
  { balance: '20' },
  { balance: 0.5 },
])('preserves pending recovery for malformed or mismatched resolution %s', async (change) => {
  await saveInterruptedUnlock();
  const { props, wallet } = setup();
  const performRequest = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(
    async () =>
      new Response(JSON.stringify({ ...resolution('completed'), ...change }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  const client = createWalletClient({
    baseUrl: 'https://api.example.test',
    getCredential: () => 'mock.synthetic_coin',
    fetchImplementation: performRequest,
  });
  wallet.resolve.mockImplementation(client.resolve);
  const view = await render(<EpisodeUnlockScreen {...props} />);
  await fireEvent.press(await view.findByText('Check coin unlock'));
  await waitFor(() => expect(performRequest).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(view.queryByText('Checking your balance and episode access…')).toBeNull(),
  );
  const sent = performRequest.mock.calls[0]![0] as Request;
  expect(sent.url).toBe('https://api.example.test/v1/coins/unlock/resolve');
  expect(sent.headers.get('Authorization')).toBe('Bearer mock.synthetic_coin');
  expect(await sent.clone().json()).toEqual(savedRequest);
  expect(mockSecureStore.size).toBe(1);
  expect(view.queryByText('Use 5 coins')).toBeNull();
  expect(props.onPlay).not.toHaveBeenCalled();
});

it.each(['session', 'account'] as const)(
  'preserves a resolution arriving after a changed %s',
  async (change) => {
    await saveInterruptedUnlock();
    const { props, wallet, me } = setup();
    let finish!: (value: Awaited<ReturnType<WalletClient['resolve']>>) => void;
    wallet.resolve.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const view = await render(<EpisodeUnlockScreen {...props} />);
    await fireEvent.press(await view.findByText('Check coin unlock'));
    await waitFor(() => expect(wallet.resolve).toHaveBeenCalledTimes(1));
    await act(async () => {
      if (change === 'session') setAuthSession({ credential: 'mock.synthetic_other' });
      else {
        const profile = await me.getMe();
        if (profile.outcome !== 'ok') throw new Error('Expected profile');
        me.getMe.mockResolvedValue({
          outcome: 'ok',
          data: { ...profile.data, public_id: 'usr_replacement' },
        });
      }
      finish({ outcome: 'ok', data: resolution('cancelled') });
    });
    expect(mockSecureStore.size).toBe(1);
    expect(view.queryByText('Use 5 coins')).toBeNull();
    expect(props.onPlay).not.toHaveBeenCalled();
  },
);

it('preserves the terminal request when the session changes while cleanup reads storage', async () => {
  await saveInterruptedUnlock();
  const { props, wallet } = setup();
  let finishRead!: () => void;
  wallet.resolve.mockImplementation(async () => {
    jest.mocked(SecureStore.getItemAsync).mockImplementationOnce(
      (key) =>
        new Promise((resolve) => {
          finishRead = () => resolve(mockSecureStore.get(key) ?? null);
        }),
    );
    return { outcome: 'ok', data: resolution('cancelled') };
  });
  const view = await render(<EpisodeUnlockScreen {...props} />);
  await fireEvent.press(await view.findByText('Check coin unlock'));
  await waitFor(() => expect(finishRead).toBeDefined());
  await act(async () => {
    setAuthSession({ credential: 'mock.synthetic_other' });
    finishRead();
  });
  expect(mockSecureStore.size).toBe(1);
  expect(props.onPlay).not.toHaveBeenCalled();
});

async function confirm(view: Awaited<ReturnType<typeof render>>) {
  await fireEvent.press(await view.findByText('Use 5 coins'));
  await fireEvent.press(await view.findByText('Confirm 5 coins'));
}

it.each([
  [['coin'], false, true, false],
  [['rewarded_ad'], true, false, true],
  [['coin', 'rewarded_ad'], true, true, true],
] as const)(
  'shows only the allowed %s choices independently of ad consent',
  async (methods, enabled, coins, ads) => {
    const { props } = setup([...methods], enabled);
    const view = await render(<EpisodeUnlockScreen {...props} />);
    await view.findByText('Synthetic episode');
    expect(view.queryByText('Use 5 coins') !== null).toBe(coins);
    expect(view.queryByText('Watch an ad') !== null).toBe(ads);
    if (ads) {
      await fireEvent.press(view.getByText('Watch an ad'));
      expect(props.onAccount).toHaveBeenCalled();
    }
    expect(props.onAd).not.toHaveBeenCalled();
    expect(props.wallet.unlock).not.toHaveBeenCalled();
  },
);

it('confirms exact terms, persists before sending, and refreshes authority before playback', async () => {
  const { props, wallet, rewards, offers } = setup();
  wallet.unlock.mockImplementation(async (request) => {
    expect([...mockSecureStore.values()].some((raw) => raw.includes(request.request_id))).toBe(
      true,
    );
    rewards.offers.mockResolvedValue({
      outcome: 'ok',
      data: { ...offers, decision: 'granted', methods: [] },
    });
    wallet.getWallet.mockResolvedValue({
      outcome: 'ok',
      data: { balance: 15, spending_available: true },
    });
    return {
      outcome: 'ok',
      data: {
        episode_id: request.episode_id,
        request_id: request.request_id,
        charged_coins: 5,
        balance: 15,
      },
    };
  });
  const view = await render(<EpisodeUnlockScreen {...props} />);
  await fireEvent.press(await view.findByText('Use 5 coins'));
  expect(wallet.unlock).not.toHaveBeenCalled();
  await fireEvent.press(view.getByText('Confirm 5 coins'));
  await waitFor(() => expect(props.onPlay).toHaveBeenCalledWith('ep_synthetic'));
  expect(wallet.unlock).toHaveBeenCalledWith({
    episode_id: 'ep_synthetic',
    request_id: expect.any(String),
    expected_policy_version: 'a'.repeat(64),
    expected_coin_price: 5,
  });
  expect(wallet.getWallet).toHaveBeenCalledTimes(2);
  expect(props.playback.authorize).toHaveBeenCalledWith('ep_synthetic');
  expect(mockSecureStore.size).toBe(0);
});

it('reuses the original request after a lost response and remount, even if terms and balance change', async () => {
  const { props, wallet, rewards, offers } = setup();
  wallet.unlock.mockResolvedValue({ outcome: 'unreachable', reason: 'timeout' });
  const first = await render(<EpisodeUnlockScreen {...props} />);
  await confirm(first);
  await first.findByText('Check coin unlock');
  const original = wallet.unlock.mock.calls[0]?.[0];
  await first.unmount();
  rewards.offers.mockResolvedValue({
    outcome: 'ok',
    data: { ...offers, policy_version: 'b'.repeat(64), coin_price: 9 },
  });
  wallet.getWallet.mockResolvedValue({
    outcome: 'ok',
    data: { balance: 0, spending_available: true },
  });
  const resumed = await render(<EpisodeUnlockScreen {...props} />);
  await fireEvent.press(await resumed.findByText('Check coin unlock'));
  expect(wallet.unlock).toHaveBeenCalledTimes(1);
  expect(wallet.resolve).toHaveBeenCalledWith(original);
  expect(resumed.queryByText('Use 9 coins')).toBeNull();
  expect(props.onPlay).not.toHaveBeenCalled();
});

it('does not send twice when confirmation is pressed again while a request is pending', async () => {
  const { props, wallet } = setup();
  let finish!: (value: Awaited<ReturnType<WalletClient['unlock']>>) => void;
  wallet.unlock.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const view = await render(<EpisodeUnlockScreen {...props} />);
  await fireEvent.press(await view.findByText('Use 5 coins'));
  const button = view.getByText('Confirm 5 coins');
  await fireEvent.press(button);
  await fireEvent.press(button);
  await waitFor(() => expect(wallet.unlock).toHaveBeenCalledTimes(1));
  await act(async () => {
    finish({ outcome: 'unreachable', reason: 'timeout' });
  });
  expect(props.onPlay).not.toHaveBeenCalled();
});

it.each(['read', 'write'] as const)(
  'blocks a new spend when secure storage %s fails',
  async (operation) => {
    const { props, wallet } = setup();
    if (operation === 'read')
      jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('unavailable'));
    else jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('unavailable'));
    const view = await render(<EpisodeUnlockScreen {...props} />);
    if (operation === 'write') await confirm(view);
    await view.findByText(
      'Secure unlock recovery is unavailable. No new unlock request can be sent. Try again later.',
    );
    expect(wallet.unlock).not.toHaveBeenCalled();
    expect(props.onPlay).not.toHaveBeenCalled();
  },
);

it('requires refreshed terms and a new confirmation after a definitive rejection', async () => {
  const { props, wallet, rewards, offers } = setup();
  wallet.unlock.mockImplementation(async () => {
    rewards.offers.mockResolvedValue({
      outcome: 'ok',
      data: { ...offers, coin_price: 8, policy_version: 'b'.repeat(64) },
    });
    return { outcome: 'unavailable', httpStatus: 409, code: 'unavailable', message: 'Unavailable' };
  });
  const view = await render(<EpisodeUnlockScreen {...props} />);
  await confirm(view);
  await view.findByText('Use 8 coins');
  expect(wallet.unlock).toHaveBeenCalledTimes(1);
  expect(view.queryByText('Confirm 8 coins')).toBeNull();
  expect(props.onPlay).not.toHaveBeenCalled();
});

it.each(['mismatch', 'still-locked', 'playback-rejected'] as const)(
  'does not navigate when verification is %s',
  async (failure) => {
    const { props, wallet, rewards, offers, playback } = setup();
    wallet.unlock.mockImplementation(async (request) => {
      if (failure !== 'still-locked')
        rewards.offers.mockResolvedValue({
          outcome: 'ok',
          data: { ...offers, decision: 'granted', methods: [] },
        });
      return {
        outcome: 'ok',
        data: {
          episode_id: failure === 'mismatch' ? 'ep_other' : request.episode_id,
          request_id: request.request_id,
          charged_coins: 5,
          balance: 15,
        },
      };
    });
    if (failure === 'playback-rejected')
      playback.authorize.mockResolvedValue({
        outcome: 'not-found',
        httpStatus: 404,
        code: 'unavailable',
        message: 'Unavailable',
      });
    const view = await render(<EpisodeUnlockScreen {...props} />);
    await confirm(view);
    await waitFor(() => expect(wallet.unlock).toHaveBeenCalled());
    await waitFor(() =>
      expect(view.queryByText('Checking your balance and episode access…')).toBeNull(),
    );
    expect(props.onPlay).not.toHaveBeenCalled();
    if (failure !== 'playback-rejected') expect(playback.authorize).not.toHaveBeenCalled();
  },
);

it('invalidates a pending completion and hides the old balance when the account changes', async () => {
  const { props, wallet } = setup();
  let finish!: (value: Awaited<ReturnType<WalletClient['unlock']>>) => void;
  wallet.unlock.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const view = await render(<EpisodeUnlockScreen {...props} />);
  await confirm(view);
  await waitFor(() => expect(wallet.unlock).toHaveBeenCalled());
  await act(async () => {
    setAuthSession({ credential: 'mock.synthetic_other' });
  });
  expect(view.queryByText('20 coins')).toBeNull();
  await act(async () => {
    finish({
      outcome: 'ok',
      data: {
        episode_id: 'ep_synthetic',
        request_id: wallet.unlock.mock.calls[0]![0].request_id,
        charged_coins: 5,
        balance: 15,
      },
    });
  });
  expect(wallet.getWallet).toHaveBeenCalledTimes(1);
  expect(props.onPlay).not.toHaveBeenCalled();
});

it('honors disabled spending and insufficient balance without starting a purchase', async () => {
  const { props, wallet } = setup();
  wallet.getWallet.mockResolvedValue({
    outcome: 'ok',
    data: { balance: 0, spending_available: true },
  });
  const view = await render(<EpisodeUnlockScreen {...props} />);
  await view.findByText('You do not have enough coins for this episode.');
  await fireEvent.press(view.getByText('Coin wallet'));
  expect(props.onWallet).toHaveBeenCalled();
  expect(wallet.unlock).not.toHaveBeenCalled();
  await view.unmount();
  wallet.getWallet.mockResolvedValue({
    outcome: 'ok',
    data: { balance: 20, spending_available: false },
  });
  const disabled = await render(<EpisodeUnlockScreen {...props} />);
  await disabled.findByText('Coin unlocks are unavailable in this build.');
  expect(disabled.queryByText('Use 5 coins')).toBeNull();
});

it('refreshes balance and cancels old price confirmation when returning to the app', async () => {
  let foreground!: (next: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    foreground = callback;
    return { remove: jest.fn() };
  });
  const { props, wallet, rewards, offers } = setup();
  const view = await render(<EpisodeUnlockScreen {...props} />);
  await fireEvent.press(await view.findByText('Use 5 coins'));
  rewards.offers.mockResolvedValue({
    outcome: 'ok',
    data: { ...offers, coin_price: 8, policy_version: 'b'.repeat(64) },
  });
  wallet.getWallet.mockResolvedValue({
    outcome: 'ok',
    data: { balance: 40, spending_available: true },
  });
  await act(async () => {
    foreground('background');
    foreground('active');
  });
  await view.findByText('Use 8 coins');
  expect(view.getByText('40 coins')).toBeTruthy();
  expect(view.queryByText('Confirm 5 coins')).toBeNull();
  expect(wallet.unlock).not.toHaveBeenCalled();
});

it('allows already granted playback during a wallet outage without sending a coin request', async () => {
  const { props, wallet, rewards, offers } = setup();
  rewards.offers.mockResolvedValue({
    outcome: 'ok',
    data: { ...offers, decision: 'granted', methods: [] },
  });
  wallet.getWallet.mockResolvedValue({ outcome: 'unreachable', reason: 'offline' });
  const view = await render(<EpisodeUnlockScreen {...props} />);
  await fireEvent.press(await view.findByText('Play'));
  await waitFor(() => expect(props.onPlay).toHaveBeenCalledWith('ep_synthetic'));
  expect(wallet.unlock).not.toHaveBeenCalled();
});

it('keeps an ambiguously rejected replay for support instead of starting another debit', async () => {
  const { props, wallet } = setup();
  wallet.unlock.mockResolvedValueOnce({ outcome: 'unreachable', reason: 'timeout' });
  const first = await render(<EpisodeUnlockScreen {...props} />);
  await confirm(first);
  await first.findByText('Check coin unlock');
  const original = wallet.unlock.mock.calls[0]![0];
  await first.unmount();
  wallet.resolve.mockResolvedValue({
    outcome: 'unavailable',
    httpStatus: 409,
    code: 'unavailable',
    message: 'Unavailable',
  });
  const resumed = await render(<EpisodeUnlockScreen {...props} />);
  await fireEvent.press(await resumed.findByText('Check coin unlock'));
  await resumed.findByText(
    new RegExp(`This unlock needs a support review.*${original.request_id}`),
  );
  expect(wallet.resolve).toHaveBeenCalledWith(original);
  expect([...mockSecureStore.values()].some((raw) => raw.includes(original.request_id))).toBe(true);
  expect(resumed.queryByText('Use 5 coins')).toBeNull();
  await fireEvent.press(resumed.getByText('Check coin unlock'));
  expect(wallet.unlock).toHaveBeenCalledTimes(1);
  expect(props.onPlay).not.toHaveBeenCalled();
});

it('cannot post with replacement credentials while the original request is being saved', async () => {
  let completeSave!: () => void;
  jest.mocked(SecureStore.setItemAsync).mockImplementationOnce(
    (key, value) =>
      new Promise((resolve) => {
        completeSave = () => {
          mockSecureStore.set(key, value);
          resolve();
        };
      }),
  );
  const { props, wallet } = setup();
  const view = await render(<EpisodeUnlockScreen {...props} />);
  await confirm(view);
  await waitFor(() => expect(SecureStore.setItemAsync).toHaveBeenCalled());
  await act(async () => {
    setAuthSession({ credential: 'mock.synthetic_replacement' });
    completeSave();
  });
  expect(wallet.unlock).not.toHaveBeenCalled();
  expect(view.queryByText('20 coins')).toBeNull();
});

it('preserves an initial receipt when the server profile changes without changing credentials', async () => {
  const { props, wallet, me } = setup();
  wallet.unlock.mockImplementation(async (request) => {
    const profile = await me.getMe();
    if (profile.outcome !== 'ok') throw new Error('Expected profile');
    me.getMe.mockResolvedValue({
      outcome: 'ok',
      data: { ...profile.data, public_id: 'usr_replacement' },
    });
    return { outcome: 'ok', data: { ...resolution('completed'), request_id: request.request_id } };
  });
  const view = await render(<EpisodeUnlockScreen {...props} />);
  await confirm(view);
  await waitFor(() =>
    expect(view.queryByText('Checking your balance and episode access…')).toBeNull(),
  );
  expect(mockSecureStore.size).toBe(1);
  expect(props.onPlay).not.toHaveBeenCalled();
});
