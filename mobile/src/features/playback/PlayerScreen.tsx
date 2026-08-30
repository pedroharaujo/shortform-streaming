import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CatalogClient, CatalogSeriesDetail } from '../../api/catalog/types';
import type { PlaybackClient } from '../../api/playback/types';
import type { ProgressClient } from '../../api/progress/types';
import { useCatalogQuery } from '../catalog/useCatalog';
import { HlsVideoView } from './HlsVideoView';
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
  readonly episodeId: string;
  readonly catalog: CatalogClient;
  readonly playback: PlaybackClient;
  readonly progress: ProgressClient;
  readonly onClose: () => void;
}

type PlayerPhase =
  | { readonly phase: 'loading' }
  | { readonly phase: 'error'; readonly message: string }
  | { readonly phase: 'unavailable' }
  | { readonly phase: 'locked'; readonly reasons: readonly string[] }
  | {
      readonly phase: 'playing';
      readonly episodeId: string;
      readonly episodeTitle: string;
      readonly durationSeconds: number;
      readonly resumeSeconds: number;
      readonly playbackUri: string;
      readonly series: CatalogSeriesDetail | null;
    };

export function PlayerScreen({
  episodeId,
  catalog,
  playback,
  progress,
  onClose,
}: PlayerScreenProps): JSX.Element {
  const [activeEpisodeId, setActiveEpisodeId] = useState(episodeId);
  const [paused, setPaused] = useState(false);
  const [nextGate, setNextGate] = useState<
    | { readonly phase: 'locked'; readonly reasons: readonly string[] }
    | { readonly phase: 'unavailable' }
    | { readonly phase: 'error'; readonly message: string }
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
      }
    },
    [progress],
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
    activeEpisodeRef.current = activeEpisodeId;
    const [episodeResult, authorizeResult] = await Promise.all([
      catalog.getEpisode(activeEpisodeId),
      playback.authorize(activeEpisodeId),
    ]);
    if (authorizeResult.outcome === 'not-found' || episodeResult.outcome === 'not-found') {
      return { phase: 'unavailable' };
    }
    if (authorizeResult.outcome === 'locked') {
      return { phase: 'locked', reasons: authorizeResult.lockReasons };
    }
    if (authorizeResult.outcome !== 'ok' || episodeResult.outcome !== 'ok') {
      return { phase: 'error', message: PLAYBACK_FAILED };
    }
    const seriesResult = await catalog.getSeries(episodeResult.data.series_id);
    const series = seriesResult.outcome === 'ok' ? seriesResult.data : null;
    seriesRef.current = series;
    const durationSeconds = episodeResult.data.duration_seconds;
    durationRef.current = durationSeconds;
    const progressResult = await progress.get(activeEpisodeId);
    let resumeSeconds = 0;
    if (progressResult.outcome === 'ok') {
      resumeSeconds = resumePlaybackPosition(
        progressResult.data.position_seconds,
        durationSeconds,
      );
      lastProgressRef.current = {
        positionSeconds: progressResult.data.position_seconds,
        completed: progressResult.data.completed,
      };
    }
    positionRef.current = resumeSeconds;
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
      setNextGate({ phase: 'locked', reasons: nextAuthorize.lockReasons });
      return;
    }
    if (nextAuthorize.outcome === 'not-found') {
      setNextGate({ phase: 'unavailable' });
      return;
    }
    if (nextAuthorize.outcome !== 'ok') {
      setNextGate({ phase: 'error', message: PLAYBACK_FAILED });
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
            onPlayingChange={(playing) => {
              playingRef.current = playing;
              if (!playing) {
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
