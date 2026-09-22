import type { MeClient } from '../../api/me/types';
import type { RewardsClient } from '../../api/rewards/types';
import type { WalletClient } from '../../api/wallet/types';
import { createEpisodeAutoUnlock } from './autoUnlock';

const POLICY = 'a'.repeat(64);
const EPISODE = 'ep_harbor_6';

function clients(autoUnlock: boolean) {
  const me: MeClient = {
    getMe: async () => ({
      outcome: 'ok',
      data: {
        public_id: 'usr_synthetic',
        created_at: '2026-09-22T00:00:00Z',
        updated_at: '2026-09-22T00:00:00Z',
        locale: 'en',
        country: '',
        analytics_consent: false,
        ads_consent: false,
        auto_unlock_next: autoUnlock,
        consent_updated_at: null,
      },
    }),
  };
  const rewards = {
    offers: jest.fn(async () => ({
      outcome: 'ok' as const,
      data: {
        decision: 'locked' as const,
        episode_id: EPISODE,
        policy_version: POLICY,
        coin_price: 4,
        lock_reasons: ['entitlement_required' as const],
        methods: [{ type: 'coin' as const }],
      },
    })),
  } as unknown as jest.Mocked<RewardsClient>;
  const wallet = {
    getActivity: jest.fn(),
    getWallet: jest.fn(async () => ({
      outcome: 'ok' as const,
      data: { balance: 10, spending_available: true },
    })),
    unlock: jest.fn(async (request) => ({
      outcome: 'ok' as const,
      data: {
        episode_id: request.episode_id,
        request_id: request.request_id,
        charged_coins: request.expected_coin_price,
        balance: 6,
      },
    })),
    resolve: jest.fn(),
  } as unknown as jest.Mocked<WalletClient>;
  return { me, rewards, wallet };
}

it('does not spend when auto-unlock is off', async () => {
  const { me, rewards, wallet } = clients(false);
  const writePending = jest.fn();
  const result = await createEpisodeAutoUnlock({
    me,
    rewards,
    wallet,
    writePending,
  }).tryUnlock(EPISODE);

  expect(result).toBe('locked');
  expect(rewards.offers).not.toHaveBeenCalled();
  expect(wallet.unlock).not.toHaveBeenCalled();
  expect(writePending).not.toHaveBeenCalled();
});

it('debits the server price once when auto-unlock is on and the balance covers it', async () => {
  const { me, rewards, wallet } = clients(true);
  const writePending = jest.fn(async () => undefined);
  const clearPending = jest.fn(async () => undefined);
  const result = await createEpisodeAutoUnlock({
    me,
    rewards,
    wallet,
    writePending,
    clearPending,
    createRequestId: () => '11111111-1111-4111-8111-111111111111',
  }).tryUnlock(EPISODE);

  expect(result).toBe('unlocked');
  expect(wallet.unlock).toHaveBeenCalledWith({
    episode_id: EPISODE,
    request_id: '11111111-1111-4111-8111-111111111111',
    expected_policy_version: POLICY,
    expected_coin_price: 4,
  });
  expect(writePending).toHaveBeenCalledTimes(1);
  expect(clearPending).toHaveBeenCalledTimes(1);
});
