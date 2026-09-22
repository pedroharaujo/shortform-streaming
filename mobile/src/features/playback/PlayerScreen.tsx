import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type {
  CatalogClient,
  CatalogEpisodeDetail,
  CatalogSeriesDetail,
} from '../../api/catalog/types';
import type { PlaybackClient, PlaybackRequestOutcome } from '../../api/playback/types';
import type { ProgressClient } from '../../api/progress/types';
import { useMessages } from '../../localization/messages';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';
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
    readonly accessMethod?: 'free' | 'rewarded_ad' | 'coin';
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
  const messages = useMessages();
  const [activeEpisodeId, setActiveEpisodeId] = useState(episodeId);
  const [paused, setPaused] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [progressRatio, setProgressRatio] = useState(0);
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
        message: messages.playback.failed,
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
        message: messages.playback.failed,
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
      authorizeResult.data.access_method === 'rewarded_ad' ||
      authorizeResult.data.access_method === 'coin'
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
  }, [activeEpisodeId, catalog, messages.playback.failed, playback, progress]);

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
        message: messages.playback.failed,
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
  }, [clearThrottle, flushProgress, messages.playback.failed, playback]);

  const handlePosition = useCallback(
    (seconds: number) => {
      positionRef.current = seconds;
      if (durationRef.current > 0) {
        setProgressRatio(Math.min(1, Math.max(0, seconds / durationRef.current)));
      }
      if (isCompleteByPosition(seconds, durationRef.current)) {
        void flushProgress(true);
      }
    },
    [flushProgress],
  );

  const currentSeries = seriesRef.current;
  const allEpisodes = currentSeries?.seasons.flatMap((s) => s.episodes) ?? [];
  const currentEpIndex = allEpisodes.findIndex((e) => e.id === activeEpisodeId);
  const prevEpisode = currentEpIndex > 0 ? allEpisodes[currentEpIndex - 1] : null;
  const nextEpisode =
    currentEpIndex >= 0 && currentEpIndex < allEpisodes.length - 1
      ? allEpisodes[currentEpIndex + 1]
      : null;

  const handleNavigateEpisode = useCallback(
    async (targetId: string) => {
      await flushProgress(false);
      clearThrottle();
      const nextAuthorize = await playback.authorize(targetId);
      if (nextAuthorize.outcome === 'locked') {
        const nextEp =
          seriesRef.current === null ? null : seriesEpisode(seriesRef.current, targetId);
        if (nextEp === null) {
          setNextGate({ phase: 'unavailable', episodeId: targetId });
          setShowDrawer(false);
          return;
        }
        setNextGate({
          phase: 'locked',
          reasons: nextAuthorize.lockReasons,
          episodeId: targetId,
          episode: nextEp,
        });
        setShowDrawer(false);
        return;
      }
      if (nextAuthorize.outcome === 'not-found') {
        setNextGate({ phase: 'unavailable', episodeId: targetId });
        setShowDrawer(false);
        return;
      }
      if (nextAuthorize.outcome !== 'ok') {
        setNextGate({
          phase: 'error',
          message: messages.playback.failed,
          failure: {
            episodeId: targetId,
            code: authorizeErrorCode(nextAuthorize.outcome),
            phase: 'authorize',
          },
        });
        setShowDrawer(false);
        return;
      }
      setNextGate(null);
      setShowDrawer(false);
      setActiveEpisodeId(targetId);
    },
    [clearThrottle, flushProgress, messages.playback.failed, playback],
  );

  const displayed = nextGate ?? phase;

  useEffect(() => {
    if (displayed.phase === 'locked') {
      // The server's current offer decides which unlock methods are available.
      void analytics.recordLocked(displayed.episode, 'unlock_required');
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
        ? messages.playback.episodeUnavailable
        : displayed.phase === 'locked'
          ? messages.playback.rewardRequired
          : null;

  return (
    <SafeAreaView style={styles.container} testID="player-screen">
      <Pressable
        accessibilityLabel={messages.playback.close}
        accessibilityRole="button"
        onPress={() => {
          void flushProgress(false);
          onClose();
        }}
        style={styles.close}
        testID="player-close"
      >
        <Text style={styles.closeLabel}>{messages.playback.close}</Text>
      </Pressable>
      {displayed.phase === 'playing' ? (
        <Text accessibilityRole="header" style={styles.nowPlaying} testID="player-now-playing">
          {displayed.episodeTitle}
        </Text>
      ) : null}

      {displayed.phase === 'loading' ? (
        <View
          accessibilityLabel={messages.playback.loadingLabel}
          accessibilityLiveRegion="polite"
          style={styles.centered}
          testID="player-loading"
        >
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.muted}>{messages.playback.loading}</Text>
        </View>
      ) : null}

      {errorText !== null ? (
        <ScrollView
          accessibilityLiveRegion="assertive"
          contentContainerStyle={styles.centered}
          testID={displayed.phase === 'locked' ? 'player-locked' : 'player-error'}
        >
          <View style={styles.statusCard}>
            <View
              style={styles.emblem}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
            >
              <Text style={styles.symbol}>▶</Text>
            </View>
            <Text style={styles.body}>{errorText}</Text>
            {displayed.phase === 'locked' && onReward ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={messages.playback.viewReward}
                onPress={() =>
                  onReward(nextGate?.phase === 'locked' ? nextGate.episodeId : activeEpisodeId)
                }
                style={styles.rewardAction}
              >
                <Text style={styles.rewardLabel}>{messages.playback.viewReward}</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
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
                message: messages.playback.failed,
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

          {/* Touch-to-pause overlay */}
          <Pressable
            accessibilityLabel={paused ? 'Play' : 'Pause'}
            accessibilityRole="button"
            onPress={() => setPaused((prev) => !prev)}
            style={styles.touchOverlay}
          >
            {paused ? (
              <View style={styles.pausedBadge}>
                <Text style={styles.pausedIcon}>▶</Text>
              </View>
            ) : null}
          </Pressable>

          {/* Bottom player controls overlay */}
          <View style={styles.bottomControls}>
            {/* Quick episode jumper button */}
            {allEpisodes.length > 1 ? (
              <View style={styles.controlsRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open episode drawer"
                  onPress={() => setShowDrawer(true)}
                  style={styles.episodesButton}
                >
                  <Text style={styles.episodesButtonText}>
                    {currentEpIndex >= 0 ? `Episode ${currentEpIndex + 1} of ${allEpisodes.length}` : 'Episodes'} ☰
                  </Text>
                </Pressable>

                <View style={styles.skipActions}>
                  <Pressable
                    accessibilityLabel="Previous episode"
                    accessibilityRole="button"
                    disabled={prevEpisode === null}
                    onPress={() => {
                      if (prevEpisode) void handleNavigateEpisode(prevEpisode.id);
                    }}
                    style={[styles.skipButton, prevEpisode === null && styles.skipButtonDisabled]}
                  >
                    <Text style={[styles.skipButtonText, prevEpisode === null && styles.skipButtonTextDisabled]}>
                      ⏮ Prev
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityLabel="Next episode"
                    accessibilityRole="button"
                    disabled={nextEpisode === null}
                    onPress={() => {
                      if (nextEpisode) void handleNavigateEpisode(nextEpisode.id);
                    }}
                    style={[styles.skipButton, nextEpisode === null && styles.skipButtonDisabled]}
                  >
                    <Text style={[styles.skipButtonText, nextEpisode === null && styles.skipButtonTextDisabled]}>
                      Next ⏭
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* Progress track */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progressRatio * 100)}%` }]} />
            </View>
          </View>
        </View>
      ) : null}

      {/* Episode Drawer Sheet */}
      <Modal
        animationType="slide"
        onRequestClose={() => setShowDrawer(false)}
        transparent
        visible={showDrawer}
      >
        <View style={styles.modalBackdrop}>
          <Pressable onPress={() => setShowDrawer(false)} style={styles.modalDismissArea} />
          <View style={styles.drawerSheet}>
            <View style={styles.drawerHeader}>
              <Text numberOfLines={1} style={styles.drawerTitle}>
                {seriesRef.current?.title ?? 'Episodes'}
              </Text>
              <Pressable
                accessibilityLabel="Close episode drawer"
                accessibilityRole="button"
                onPress={() => setShowDrawer(false)}
                style={styles.drawerClose}
              >
                <Text style={styles.drawerCloseText}>✕</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.drawerList}>
              {allEpisodes.map((ep, idx) => {
                const isActive = ep.id === activeEpisodeId;
                return (
                  <Pressable
                    key={ep.id}
                    accessibilityRole="button"
                    onPress={() => {
                      void handleNavigateEpisode(ep.id);
                    }}
                    style={[styles.drawerItem, isActive && styles.drawerItemActive]}
                  >
                    <View style={[styles.drawerItemNumber, isActive && styles.drawerItemNumberActive]}>
                      <Text style={[styles.drawerItemNumberText, isActive && styles.drawerItemNumberTextActive]}>
                        {idx + 1}
                      </Text>
                    </View>
                    <View style={styles.drawerItemInfo}>
                      <Text
                        numberOfLines={1}
                        style={[styles.drawerItemTitle, isActive && styles.drawerItemTitleActive]}
                      >
                        {ep.title || `Episode ${ep.order}`}
                      </Text>
                      {ep.duration_seconds > 0 ? (
                        <Text style={styles.drawerItemDuration}>
                          {Math.round(ep.duration_seconds)}s
                        </Text>
                      ) : null}
                    </View>
                    {isActive ? (
                      <View style={styles.activePill}>
                        <Text style={styles.activePillText}>Playing</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.foreground, fontSize: fontSizes.body, lineHeight: 24, textAlign: 'center' },
  centered: {
    alignItems: 'center',
    flexGrow: 1,
    gap: spacing.lg,
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  statusCard: {
    alignItems: 'center',
    width: '100%',
    gap: spacing.xxl,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.xxl,
  },
  emblem: {
    width: 72,
    height: 72,
    borderRadius: radii.lg,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: { color: colors.accent, fontSize: fontSizes.display },
  close: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: minimumTouchTarget,
    minWidth: minimumTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1,
  },
  closeLabel: { color: colors.foreground, fontSize: fontSizes.label, fontWeight: '600' },
  container: { backgroundColor: colors.background, flex: 1, padding: spacing.lg },
  muted: { color: colors.muted, fontSize: fontSizes.body, lineHeight: 24, textAlign: 'center' },
  nowPlaying: {
    color: colors.foreground,
    fontSize: fontSizes.title,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: spacing.xs,
    marginTop: spacing.lg,
  },
  playerWrap: {
    flex: 1,
    marginTop: spacing.md,
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    backgroundColor: '#000000',
  },
  touchOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pausedBadge: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pausedIcon: {
    color: '#ffffff',
    fontSize: 24,
    marginLeft: 4,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: 'rgba(10, 10, 12, 0.75)',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  episodesButton: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 36,
    justifyContent: 'center',
  },
  episodesButtonText: {
    color: colors.foreground,
    fontSize: fontSizes.caption,
    fontWeight: '700',
  },
  skipActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  skipButton: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 36,
    justifyContent: 'center',
  },
  skipButtonDisabled: {
    opacity: 0.35,
  },
  skipButtonText: {
    color: colors.foreground,
    fontSize: fontSizes.caption,
    fontWeight: '600',
  },
  skipButtonTextDisabled: {
    color: colors.muted,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: radii.pill,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  drawerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
    maxHeight: '65%',
    paddingBottom: spacing.xxl,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  drawerTitle: {
    color: colors.foreground,
    fontSize: fontSizes.section,
    fontWeight: '800',
    letterSpacing: -0.4,
    flex: 1,
  },
  drawerClose: {
    padding: spacing.xs,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerCloseText: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: '600',
  },
  drawerList: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'transparent',
    gap: spacing.md,
  },
  drawerItemActive: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accent,
    borderWidth: 1,
  },
  drawerItemNumber: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerItemNumberActive: {
    backgroundColor: colors.accent,
  },
  drawerItemNumberText: {
    color: colors.muted,
    fontSize: fontSizes.caption,
    fontWeight: '700',
  },
  drawerItemNumberTextActive: {
    color: colors.onAccent,
  },
  drawerItemInfo: {
    flex: 1,
    gap: 2,
  },
  drawerItemTitle: {
    color: colors.foreground,
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
  drawerItemTitleActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  drawerItemDuration: {
    color: colors.muted,
    fontSize: fontSizes.caption,
  },
  activePill: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  activePillText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  rewardAction: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: minimumTouchTarget,
    minWidth: minimumTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignSelf: 'stretch',
  },
  rewardLabel: {
    color: colors.onAccent,
    fontSize: fontSizes.body,
    fontWeight: '700',
    textAlign: 'center',
  },
});
