import { bearerHeaders, createOpenApiClient } from '../context';
import { DEFAULT_TIMEOUT_MS, mapJsonDomain, mapJsonRequest } from '../http';
import type { EpisodeOffers, RewardIntent, RewardsClient } from './types';

export function createRewardsClient(options: {
  readonly baseUrl: string;
  readonly getCredential: () => string | null;
  readonly fetchImplementation?: typeof fetch;
}): RewardsClient {
  const api = createOpenApiClient(options);
  const errorMap = {
    401: 'unauthenticated',
    404: 'not-found',
    409: 'unavailable',
    503: 'unavailable',
  } as const;
  const message = 'The reward request could not be completed.';
  return {
    async offers(episodeId) {
      return mapJsonDomain(
        await mapJsonRequest<EpisodeOffers>(DEFAULT_TIMEOUT_MS, message, (signal) =>
          api.GET('/v1/offers/{episode_id}', {
            params: { path: { episode_id: episodeId } },
            headers: bearerHeaders(options.getCredential),
            signal,
          }),
        ),
        errorMap,
      );
    },
    async create(episodeId, requestId) {
      return mapJsonDomain(
        await mapJsonRequest<RewardIntent>(DEFAULT_TIMEOUT_MS, message, (signal) =>
          api.POST('/v1/rewards/intents', {
            body: { episode_id: episodeId, request_id: requestId, accepted: true },
            headers: bearerHeaders(options.getCredential),
            signal,
          }),
        ),
        errorMap,
      );
    },
    async get(rewardId) {
      return mapJsonDomain(
        await mapJsonRequest<RewardIntent>(DEFAULT_TIMEOUT_MS, message, (signal) =>
          api.GET('/v1/rewards/{reward_id}', {
            params: { path: { reward_id: rewardId } },
            headers: bearerHeaders(options.getCredential),
            signal,
          }),
        ),
        errorMap,
      );
    },
  };
}
