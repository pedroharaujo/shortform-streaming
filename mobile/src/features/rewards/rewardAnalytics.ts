import type { AnalyticsRuntime } from '../../analytics/runtime';

export interface RewardAnalyticsEpisode {
  readonly seriesId: string;
  readonly episodeId: string;
  readonly seasonNumber: number;
  readonly episodeNumber: number;
}

export type RewardedAdLifecycleEvent = 'loaded' | 'started' | 'completed';
export type RewardFailureStage = 'offer' | 'load' | 'present' | 'verify';
export type RewardFailureCode =
  | 'offer_unavailable'
  | 'offer_mismatch'
  | 'intent_mismatch'
  | 'ad_prepare_failed'
  | 'ad_load_failed'
  | 'ad_present_failed'
  | 'ad_dismissed'
  | 'verify_mismatch'
  | 'reward_expired'
  | 'reward_unavailable'
  | 'grant_source_unavailable';

export interface RewardAnalytics {
  recordOfferPresented(episode: RewardAnalyticsEpisode): Promise<void>;
  recordOfferSelected(episode: RewardAnalyticsEpisode, attemptKey: string): Promise<void>;
  recordAdEvent(
    episode: RewardAnalyticsEpisode,
    intentKey: string,
    event: RewardedAdLifecycleEvent,
  ): Promise<void>;
  recordGranted(
    episode: RewardAnalyticsEpisode,
    intentKey: string,
    grantSource: 'admob_ssv',
  ): Promise<void>;
  recordFailed(
    episode: RewardAnalyticsEpisode,
    attemptKey: string,
    stage: RewardFailureStage,
    code: RewardFailureCode,
  ): Promise<void>;
}

function episodeProperties(episode: RewardAnalyticsEpisode) {
  return {
    series_id: episode.seriesId,
    episode_id: episode.episodeId,
    season_number: episode.seasonNumber,
    episode_number: episode.episodeNumber,
  } as const;
}

function safeKey(value: string): string {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value) ? value : 'unknown';
}

const AD_EVENT = {
  loaded: { name: 'rewarded_ad_loaded', key: 'l' },
  started: { name: 'rewarded_ad_started', key: 's' },
  completed: { name: 'rewarded_ad_completed', key: 'c' },
} as const;

const FAILURE_STAGE_KEY: Readonly<Record<RewardFailureStage, string>> = {
  offer: 'o',
  load: 'l',
  present: 'p',
  verify: 'v',
};

export function createRewardAnalytics(runtime: AnalyticsRuntime): RewardAnalytics {
  let queue: Promise<void> = Promise.resolve();

  function enqueue(task: () => Promise<void>): Promise<void> {
    const operation = queue.then(task, task);
    queue = operation.catch(() => undefined);
    return operation;
  }

  return {
    recordOfferPresented(episode): Promise<void> {
      return enqueue(async () => {
        await runtime.logOnce('offer_presented', `o:p:${safeKey(episode.episodeId)}`, {
          ...episodeProperties(episode),
          access_method: 'rewarded_ad',
        });
      });
    },
    recordOfferSelected(episode, attemptKey): Promise<void> {
      return enqueue(async () => {
        await runtime.logOnce('offer_selected', `o:s:${safeKey(attemptKey)}`, {
          ...episodeProperties(episode),
          access_method: 'rewarded_ad',
        });
      });
    },
    recordAdEvent(episode, intentKey, event): Promise<void> {
      const definition = AD_EVENT[event];
      return enqueue(async () => {
        await runtime.logOnce(definition.name, `a:${definition.key}:${safeKey(intentKey)}`, {
          ...episodeProperties(episode),
          access_method: 'rewarded_ad',
        });
      });
    },
    recordGranted(episode, intentKey, grantSource): Promise<void> {
      return enqueue(async () => {
        await runtime.logOnce('reward_granted', `r:g:${safeKey(intentKey)}`, {
          ...episodeProperties(episode),
          grant_source: grantSource,
        });
      });
    },
    recordFailed(episode, attemptKey, stage, code): Promise<void> {
      return enqueue(async () => {
        await runtime.logOnce(
          'reward_failed',
          `r:f:${safeKey(attemptKey)}:${FAILURE_STAGE_KEY[stage]}`,
          {
            ...episodeProperties(episode),
            failure_stage: stage,
            error_code: code,
          },
        );
      });
    },
  };
}
