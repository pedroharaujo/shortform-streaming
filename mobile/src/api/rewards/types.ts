import type { components } from '@shortform/api-client';
import type { EnvelopeOutcome, UnreachableOutcome } from '../outcomes';

export type RewardIntent = components['schemas']['RewardIntent'];
export type EpisodeOffers =
  components['schemas']['EpisodeOffersGranted'] | components['schemas']['EpisodeOffersLocked'];
export type RewardOutcome<T> =
  | { readonly outcome: 'ok'; readonly data: T }
  | EnvelopeOutcome<'error' | 'unauthenticated' | 'unavailable' | 'not-found'>
  | UnreachableOutcome;

export interface RewardsClient {
  offers(episodeId: string): Promise<RewardOutcome<EpisodeOffers>>;
  create(episodeId: string, requestId: string): Promise<RewardOutcome<RewardIntent>>;
  get(rewardId: string): Promise<RewardOutcome<RewardIntent>>;
}
