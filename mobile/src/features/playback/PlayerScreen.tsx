import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type {
  CatalogClient,
  CatalogEpisodeDetail,
  CatalogSeriesDetail,
} from '../../api/catalog/types';
import type { PlaybackClient, PlaybackRequestOutcome } from '../../api/playback/types';
import type { ProgressClient } from '../../api/progress/types';
import { useCatalogQuery } from '../catalog/useCatalog';
import { HlsVideoView } from './HlsVideoView';
import type {
  PlaybackAnalytics,
  PlaybackAnalyticsEpisode,
  PlaybackAnalyticsErrorCode,
} from './playbackAnalytics';
import {
  clampResumePosition,
  isCompleteByPosition,
  nextOpaqueEpisodeId,
  PROGRESS_THROTTLE_MS,
  resumePlaybackPosition,
  shouldSkipProgressPut,
} from './playbackProgress';

const EPISODE_NOT_AVAILABLE = 'This episode is not available.';
const PLAYBACK_FAILED = 'Playback could not be started.';

export interface PlayerScreenProps {
  readonly analytics: PlaybackAnalytics;
  readonly episodeId: string;
  readonly catalog: CatalogClient;
  readonly playback: PlaybackClient;
  readonly progress: ProgressClient;
  readonly onClose: () => void;
  readonly onReward?: (episodeId: string) => void;
}

interface PlaybackFailure {
  readonly episodeId: string;
  readonly code: PlaybackAnalyticsErrorCode;
  readonly phase: 'authorize' | 'load' | 'play';
}

type PlayerPhase =
  | { readonly phase: 'loading' }
  | { readonly phase: 'error'; readonly message: string; readonly failure: PlaybackFailure }
  | { readonly phase: 'unavailable'; readonly episodeId: string }
  | {
      readonly phase: 'locked';
      readonly reasons: readonly string[];
      readonly episode: PlaybackAnalyticsEpisode;
    }
  | {
      readonly phase: 'playing';
      readonly episodeId: string;
      readonly episodeTitle: string;
      readonly durationSeconds: number;
      readonly resumeSeconds: number;
      readonly playbackUri: string;
      readonly series: CatalogSeriesDetail | null;
    };

function analyticsEpisode(
  episode: CatalogEpisodeDetail,
  options?: {
    readonly accessMethod?: 'free' | 'rewarded_ad';
    readonly startPositionSeconds?: number;
  },
): PlaybackAnalyticsEpisode {
  return {
    seriesId: episode.series_id,
    episodeId: episode.id,
    seasonNumber: episode.season_number,
    episodeNumber: episode.order,
    durationSeconds: episode.duration_seconds,
    ...(options?.accessMethod === undefined ? {} : { accessMethod: options.accessMethod }),
    ...(options?.startPositionSeconds === undefined
      ? {}
      : { startPositionSeconds: options.startPositionSeconds }),
  };
}

function seriesEpisode(
  series: CatalogSeriesDetail,
  episodeId: string,
): PlaybackAnalyticsEpisode | null {
  for (const season of series.seasons) {
    const episode = season.episodes.find((candidate) => candidate.id === episodeId);
    if (episode !== undefined) {
      return {
        seriesId: series.id,
        episodeId: episode.id,
        seasonNumber: season.number,
        episodeNumber: episode.order,
        durationSeconds: episode.duration_seconds,
      };
    }
  }
  return null;
}

function authorizeErrorCode(
  outcome: PlaybackRequestOutcome['outcome'],
): PlaybackAnalyticsErrorCode {
  switch (outcome) {
    case 'unauthenticated':
      return 'authorize_unauthenticated';
    case 'unavailable':
      return 'authorize_unavailable';
    case 'unreachable':
      return 'authorize_unreachable';
    default:
      return 'authorize_failed';
  }
}

export function PlayerScreen({
  analytics,
  episodeId,
  catalog,
  playback,
  progress,
  onClose,
  onReward,
}: PlayerScreenProps): JSX.Element {
  const [activeEpisodeId, setActiveEpisodeId] = useState(episodeId);
  const [paused, setPaused] = useState(false);
  const [nextGate, setNextGate] = useState<
    | {
        readonly phase: 'locked';
        readonly reasons: readonly string[];
        readonly episodeId: string;
        readonly episode: PlaybackAnalyticsEpisode;
      }
    | { readonly phase: 'unavailable'; readonly episodeId: string }
    | { readonly phase: 'error'; readonly message: string; readonly failure: PlaybackFailure }
    | null
  >(null);
  const lastProgressRef = useRef<{ positionSeconds: number; completed: boolean } | null>(null);
  const positionRef = useRef(0);
  const playingRef = useRef(false);
  const durationRef = useRef(0);
  const seriesRef = useRef<CatalogSeriesDetail | null>(null);
  const completingRef = useRef(false);
  const throttleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeEpisodeRef = useRef(activeEpisodeId);
  const analyticsEpisodeRef = useRef<PlaybackAnalyticsEpisode | null>(null);

  const clearThrottle = useCallback(() => {
    if (throttleTimerRef.current !== null) {
      clearInterval(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
  }, []);

  const flushProgress = useCallback(
    async (completed: boolean) => {
      const currentId = activeEpisodeRef.current;
      const positionSeconds = clampResumePosition(positionRef.current, durationRef.current);
      const payload = {
        positionSeconds,
        completed: completed || isCompleteByPosition(positionSeconds, durationRef.current),
      };
      if (shouldSkipProgressPut(lastProgressRef.current, payload)) {
        return;
      }
      const result = await progress.put(currentId, {
        position_seconds: payload.positionSeconds,
        completed: payload.completed,
      });
      if (result.outcome === 'ok') {
        lastProgressRef.current = payload;
        const eventEpisode = analyticsEpisodeRef.current;
        if (eventEpisode?.episodeId === currentId) {
          void analytics.recordProgress(eventEpisode, payload.positionSeconds, payload.completed);
        }
      }
    },
    [analytics, progress],
  );

  const startThrottle = useCallback(() => {
    clearThrottle();
    throttleTimerRef.current = setInterval(() => {
      if (!playingRef.current) {
        return;
      }
      void flushProgress(isCompleteByPosition(positionRef.current, durationRef.current));
    }, PROGRESS_THROTTLE_MS);
  }, [clearThrottle, flushProgress]);

  const load = useCallback(async (): Promise<PlayerPhase> => {
    completingRef.current = false;
    lastProgressRef.current = null;
    positionRef.current = 0;
    durationRef.current = 0;
    seriesRef.current = null;
    activeEpisodeRef.current = activeEpisodeId;
    analyticsEpisodeRef.current = null;
    const [episodeResult, authorizeResult] = await Promise.all([
      catalog.getEpisode(activeEpisodeId),
      playback.authorize(activeEpisodeId),
    ]);
    const eventEpisode =
      episodeResult.outcome === 'ok' ? analyticsEpisode(episodeResult.data) : null;
    if (authorizeResult.outcome === 'not-found' || episodeResult.outcome === 'not-found') {
      return { phase: 'unavailable', episodeId: activeEpisodeId };
    }
    if (authorizeResult.outcome === 'locked') {
      return eventEpisode === null
        ? { phase: 'unavailable', episodeId: activeEpisodeId }
        : { phase: 'locked', reasons: authorizeResult.lockReasons, episode: eventEpisode };
    }
    if (authorizeResult.outcome !== 'ok') {
      return {
        phase: 'error',
        message: PLAYBACK_FAILED,
        failure: {
          episodeId: activeEpisodeId,
          code: authorizeErrorCode(authorizeResult.outcome),
          phase: 'authorize',
        },
      };
    }
    if (episodeResult.outcome !== 'ok') {
      return {
        phase: 'error',
        message: PLAYBACK_FAILED,
        failure: { episodeId: activeEpisodeId, code: 'episode_load_failed', phase: 'load' },
      };
    }
    const seriesResult = await catalog.getSeries(episodeResult.data.series_id);
    const series = seriesResult.outcome === 'ok' ? seriesResult.data : null;
    seriesRef.current = series;
    const durationSeconds = episodeResult.data.duration_seconds;
    durationRef.current = durationSeconds;
    const progressResult = await progress.get(activeEpisodeId);
    let resumeSeconds = 0;
    if (progressResult.outcome === 'ok') {
      resumeSeconds = resumePlaybackPosition(progressResult.data.position_seconds, durationSeconds);
      lastProgressRef.current = {
        positionSeconds: progressResult.data.position_seconds,
        completed: progressResult.data.completed,
      };
    }
    positionRef.current = resumeSeconds;
    const accessMethod =
      authorizeResult.data.access_method === 'free' ||
      authorizeResult.data.access_method === 'rewarded_ad'
        ? authorizeResult.data.access_method
        : undefined;
    analyticsEpisodeRef.current = analyticsEpisode(episodeResult.data, {
      ...(accessMethod === undefined ? {} : { accessMethod }),
      startPositionSeconds: resumeSeconds,
    });
    return {
      phase: 'playing',
      episodeId: activeEpisodeId,
      episodeTitle: episodeResult.data.title,
      durationSeconds,
      resumeSeconds,
      playbackUri: authorizeResult.data.playback_url,
      series,
    };
  }, [activeEpisodeId, catalog, playback, progress]);

  const { state: phase } = useCatalogQuery(load);

  useEffect(() => {
    if (phase.phase !== 'playing') {
      clearThrottle();
      return;
    }
    startThrottle();
    return () => {
      clearThrottle();
    };
  }, [clearThrottle, phase.phase, startThrottle]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        playingRef.current = false;
        setPaused(true);
        void flushProgress(false);
        return;
      }
      setPaused(false);
    });
    return () => {
      subscription.remove();
    };
  }, [flushProgress]);

  const handleEnded = useCallback(async () => {
    playingRef.current = false;
    positionRef.current = durationRef.current;
    await flushProgress(true);
    if (lastProgressRef.current?.completed !== true) {
      await flushProgress(true);
    }
    if (completingRef.current) {
      return;
    }
    completingRef.current = true;
    clearThrottle();
    const nextId =
      seriesRef.current === null
        ? null
        : nextOpaqueEpisodeId(seriesRef.current.seasons, activeEpisodeRef.current);
    if (nextId === null) {
      return;
    }
    const nextAuthorize = await playback.authorize(nextId);
    if (nextAuthorize.outcome === 'locked') {
      const nextEpisode =
        seriesRef.current === null ? null : seriesEpisode(seriesRef.current, nextId);
      if (nextEpisode === null) {
        setNextGate({ phase: 'unavailable', episodeId: nextId });
        return;
      }
      setNextGate({
        phase: 'locked',
        reasons: nextAuthorize.lockReasons,
        episodeId: nextId,
        episode: nextEpisode,
      });
      return;
    }
    if (nextAuthorize.outcome === 'not-found') {
      setNextGate({ phase: 'unavailable', episodeId: nextId });
      return;
    }
    if (nextAuthorize.outcome !== 'ok') {
      setNextGate({
        phase: 'error',
        message: PLAYBACK_FAILED,
        failure: {
          episodeId: nextId,
          code: authorizeErrorCode(nextAuthorize.outcome),
          phase: 'authorize',
        },
      });
      return;
    }
    setNextGate(null);
    setActiveEpisodeId(nextId);
  }, [clearThrottle, flushProgress, playback]);

  const handlePosition = useCallback(
    (seconds: number) => {
      positionRef.current = seconds;
      if (isCompleteByPosition(seconds, durationRef.current)) {
        void flushProgress(true);
      }
    },
    [flushProgress],
  );

  const displayed = nextGate ?? phase;

  useEffect(() => {
    if (displayed.phase === 'locked') {
      // Both server lock reasons lead to the ads-only reward unlock path.
      void analytics.recordLocked(displayed.episode, 'reward_required');
    } else if (displayed.phase === 'unavailable') {
      void analytics.recordError({
        episodeId: displayed.episodeId,
        code: 'episode_unavailable',
        phase: 'authorize',
      });
    } else if (displayed.phase === 'error') {
      void analytics.recordError(displayed.failure);
    }
  }, [analytics, displayed]);
  const errorText =
    displayed.phase === 'error'
      ? displayed.message
      : displayed.phase === 'unavailable'
        ? EPISODE_NOT_AVAILABLE
        : displayed.phase === 'locked'
          ? displayed.reasons.join(', ')
          : null;

  return (
    <SafeAreaView style={styles.container} testID="player-screen">
      <Pressable
        accessibilityLabel="Close"
        accessibilityRole="button"
        onPress={() => {
          void flushProgress(false);
          onClose();
        }}
        style={styles.close}
        testID="player-close"
      >
        <Text style={styles.closeLabel}>Close</Text>
      </Pressable>
      {displayed.phase === 'playing' ? (
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          style={styles.nowPlaying}
          testID="player-now-playing"
        >
          {displayed.episodeTitle}
        </Text>
      ) : null}

      {displayed.phase === 'loading' ? (
        <View accessibilityLiveRegion="polite" style={styles.centered} testID="player-loading">
          <Text style={styles.muted}>Loading playback…</Text>
        </View>
      ) : null}

      {errorText !== null ? (
        <View
          style={styles.centered}
          testID={displayed.phase === 'locked' ? 'player-locked' : 'player-error'}
        >
          <Text style={styles.body}>{errorText}</Text>
          {displayed.phase === 'locked' && onReward ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View episode reward"
              onPress={() =>
                onReward(nextGate?.phase === 'locked' ? nextGate.episodeId : activeEpisodeId)
              }
              style={styles.close}
            >
              <Text style={styles.body}>View episode reward</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {displayed.phase === 'playing' ? (
        <View style={styles.playerWrap} testID="player-loaded">
          <HlsVideoView
            accessibilityLabel={displayed.episodeTitle}
            initialPositionSeconds={displayed.resumeSeconds}
            onEnded={() => {
              void handleEnded();
            }}
            onError={() => {
              setNextGate({
                phase: 'error',
                message: PLAYBACK_FAILED,
                failure: {
                  episodeId: activeEpisodeRef.current,
                  code: 'video_playback_failed',
                  phase: 'play',
                },
              });
            }}
            onPlayingChange={(playing) => {
              playingRef.current = playing;
              if (playing) {
                const eventEpisode = analyticsEpisodeRef.current;
                if (eventEpisode !== null) void analytics.recordStarted(eventEpisode);
              } else {
                void flushProgress(false);
              }
            }}
            onPosition={handlePosition}
            paused={paused}
            testID="player-video"
            uri={displayed.playbackUri}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { color: '#fafafa', fontSize: 16, textAlign: 'center' },
  centered: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center' },
  close: { alignSelf: 'flex-start', paddingVertical: 4 },
  closeLabel: { color: '#a1a1aa', fontSize: 16 },
  container: { backgroundColor: '#09090b', flex: 1, padding: 24 },
  muted: { color: '#a1a1aa', fontSize: 14 },
  nowPlaying: { color: '#fafafa', fontSize: 16, fontWeight: '600', marginBottom: 4, marginTop: 8 },
  playerWrap: { flex: 1, marginTop: 12 },
});
