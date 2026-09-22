import { randomUUID } from 'expo-crypto';

import type { MeClient } from '../../api/me/types';
import type { EpisodeOffers, RewardsClient } from '../../api/rewards/types';
import type { WalletClient } from '../../api/wallet/types';
import {
  clearPendingCoinUnlock,
  writePendingCoinUnlock,
  type PendingCoinUnlock,
} from '../wallet/pendingCoinUnlock';

export interface EpisodeAutoUnlock {
  tryUnlock(episodeId: string): Promise<'unlocked' | 'locked'>;
}

/**
 * Spends coins for the next episode only when the signed-in viewer has turned
 * auto-unlock on. The debit is the existing server unlock: current price,
 * one request id, no playback URL.
 */
export function createEpisodeAutoUnlock(deps: {
  readonly me: MeClient;
  readonly rewards: RewardsClient;
  readonly wallet: WalletClient;
  readonly writePending?: (attempt: PendingCoinUnlock) => Promise<void>;
  readonly clearPending?: (attempt: PendingCoinUnlock) => Promise<void>;
  readonly createRequestId?: () => string;
}): EpisodeAutoUnlock {
  const writePending = deps.writePending ?? writePendingCoinUnlock;
  const clearPending = deps.clearPending ?? clearPendingCoinUnlock;
  const createRequestId = deps.createRequestId ?? randomUUID;

  return {
    async tryUnlock(episodeId) {
      const profile = await deps.me.getMe();
      if (profile.outcome !== 'ok' || profile.data.auto_unlock_next !== true) return 'locked';
      const offer = await deps.rewards.offers(episodeId);
      if (offer.outcome !== 'ok') return 'locked';
      const price = coinSpend(offer.data, episodeId);
      if (price === null) return 'locked';
      const wallet = await deps.wallet.getWallet();
      if (
        wallet.outcome !== 'ok' ||
        !wallet.data.spending_available ||
        wallet.data.balance < price.coinPrice
      ) {
        return 'locked';
      }
      const attempt: PendingCoinUnlock = {
        version: 1,
        profileId: profile.data.public_id,
        request: {
          episode_id: episodeId,
          request_id: createRequestId(),
          expected_policy_version: price.policyVersion,
          expected_coin_price: price.coinPrice,
        },
      };
      try {
        await writePending(attempt);
      } catch {
        return 'locked';
      }
      const unlocked = await deps.wallet.unlock(attempt.request);
      if (unlocked.outcome !== 'ok') return 'locked';
      try {
        await clearPending(attempt);
      } catch {
        // The debit succeeded. A leftover pending marker is resolved by the unlock screen.
      }
      return 'unlocked';
    },
  };
}

function coinSpend(
  offer: EpisodeOffers,
  episodeId: string,
): { readonly coinPrice: number; readonly policyVersion: string } | null {
  if (offer.decision !== 'locked' || offer.episode_id !== episodeId) return null;
  if (!offer.methods.some((method) => method?.type === 'coin')) return null;
  if (offer.coin_price === null || offer.coin_price === undefined) return null;
  return { coinPrice: offer.coin_price, policyVersion: offer.policy_version };
}
