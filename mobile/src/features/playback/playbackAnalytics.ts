import type { AccessMethod } from '../../analytics/events';
import type { AnalyticsRuntime } from '../../analytics/runtime';

export interface PlaybackAnalyticsEpisode {
  readonly seriesId: string;
  readonly episodeId: string;
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  readonly durationSeconds: number;
  readonly accessMethod?: AccessMethod;
  readonly startPositionSeconds?: number;
}

export type PlaybackAnalyticsLockReason = 'reward_required' | 'unavailable' | 'ineligible';
export type PlaybackAnalyticsErrorPhase = 'authorize' | 'load' | 'play' | 'progress';
export type PlaybackAnalyticsErrorCode =
  | 'authorize_failed'
  | 'authorize_unauthenticated'
  | 'authorize_unavailable'
  | 'authorize_unreachable'
  | 'episode_load_failed'
  | 'episode_unavailable'
  | 'video_playback_failed';

export interface PlaybackAnalytics {
  recordStarted(episode: PlaybackAnalyticsEpisode): Promise<void>;
  recordProgress(
    episode: PlaybackAnalyticsEpisode,
    positionSeconds: number,
    completed: boolean,
  ): Promise<void>;
  recordLocked(
    episode: PlaybackAnalyticsEpisode,
    reason: PlaybackAnalyticsLockReason,
  ): Promise<void>;
  recordError(options: {
    readonly episodeId?: string;
    readonly code: PlaybackAnalyticsErrorCode;
    readonly phase: PlaybackAnalyticsErrorPhase;
  }): Promise<void>;
}

function episodeProperties(episode: PlaybackAnalyticsEpisode) {
  return {
    series_id: episode.seriesId,
    episode_id: episode.episodeId,
    season_number: episode.seasonNumber,
    episode_number: episode.episodeNumber,
  } as const;
}

function safeEpisodeId(value: string | undefined): string | undefined {
  return value !== undefined && /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value) ? value : undefined;
}

const PHASE_KEY: Readonly<Record<PlaybackAnalyticsErrorPhase, string>> = {
  authorize: 'a',
  load: 'l',
  play: 'p',
  progress: 'g',
};

export function createPlaybackAnalytics(runtime: AnalyticsRuntime): PlaybackAnalytics {
  let queue: Promise<void> = Promise.resolve();

  function enqueue(task: () => Promise<void>): Promise<void> {
    const operation = queue.then(task, task);
    queue = operation.catch(() => undefined);
    return operation;
  }

  return {
    recordStarted(episode): Promise<void> {
      const accessMethod = episode.accessMethod;
      if (accessMethod === undefined) return Promise.resolve();
      return enqueue(async () => {
        await runtime.logOnce('episode_started', `b:${episode.episodeId}`, {
          ...episodeProperties(episode),
          access_method: accessMethod,
          start_position_seconds: episode.startPositionSeconds ?? 0,
        });
      });
    },
    recordProgress(episode, positionSeconds, completed): Promise<void> {
      return enqueue(async () => {
        await runtime.logOnce('episode_progress', `p:${episode.episodeId}:${positionSeconds}`, {
          ...episodeProperties(episode),
          position_seconds: positionSeconds,
          duration_seconds: episode.durationSeconds,
        });
        if (completed) {
          await runtime.logOnce('episode_completed', `c:${episode.episodeId}`, {
            ...episodeProperties(episode),
            duration_seconds: episode.durationSeconds,
          });
        }
      });
    },
    recordLocked(episode, reason): Promise<void> {
      return enqueue(async () => {
        await runtime.logOnce('locked_episode_viewed', `l:${episode.episodeId}`, {
          ...episodeProperties(episode),
          lock_reason: reason,
        });
      });
    },
    recordError({ episodeId, code, phase }): Promise<void> {
      const safeId = safeEpisodeId(episodeId);
      return enqueue(async () => {
        await runtime.logOnce('playback_error', `e:${safeId ?? 'unknown'}:${PHASE_KEY[phase]}`, {
          ...(safeId === undefined ? {} : { episode_id: safeId }),
          error_code: code,
          playback_phase: phase,
        });
      });
    },
  };
}
