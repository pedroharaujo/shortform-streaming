import { createAnalyticsClient, type AnalyticsEnvelope } from '../../analytics/client';
import { createAnalyticsRuntime } from '../../analytics/runtime';
import { createPlaybackAnalytics, type PlaybackAnalyticsEpisode } from './playbackAnalytics';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  digestStringAsync: jest.fn(async () => 'a'.repeat(64)),
}));

const EPISODE: PlaybackAnalyticsEpisode = {
  seriesId: 'ser_harbor',
  episodeId: 'ep_harbor_1',
  seasonNumber: 1,
  episodeNumber: 1,
  durationSeconds: 90,
  accessMethod: 'free',
  startPositionSeconds: 0,
};

function setup(enabledInitially: boolean) {
  let enabled = enabledInitially;
  const events: AnalyticsEnvelope[] = [];
  const runtime = createAnalyticsRuntime({
    client: createAnalyticsClient({
      enabled: () => enabled,
      mode: 'development',
      sink: { send: async (event) => void events.push(event) },
    }),
    sessionId: '0123456789abcdef',
    context: {
      appVersion: '0.1.0',
      appBuild: '1',
      platform: 'android',
      locale: 'en',
      now: () => new Date('2026-09-01T10:00:00.000Z'),
    },
  });
  return {
    analytics: createPlaybackAnalytics(runtime),
    events,
    setEnabled: (next: boolean) => (enabled = next),
  };
}

it('emits an ordered free playback trail only after consent becomes active', async () => {
  const { analytics, events, setEnabled } = setup(false);

  await analytics.recordStarted(EPISODE);
  await analytics.recordProgress(EPISODE, 12, false);
  await analytics.recordProgress(EPISODE, 90, true);
  expect(events).toEqual([]);

  setEnabled(true);
  await analytics.recordStarted(EPISODE);
  await analytics.recordProgress(EPISODE, 12, false);
  await analytics.recordProgress(EPISODE, 90, true);

  expect(events.map((event) => event.name)).toEqual(['episode_started', 'episode_completed']);
  expect(events[0]?.properties).toMatchObject({ access_method: 'free' });
});

it('deduplicates remounted start, throttled progress, completion, lock, and error triggers', async () => {
  const { analytics, events } = setup(true);

  await analytics.recordStarted(EPISODE);
  await analytics.recordStarted(EPISODE);
  await analytics.recordProgress(EPISODE, 12, false);
  await analytics.recordProgress(EPISODE, 12, false);
  await analytics.recordProgress(EPISODE, 90, true);
  await analytics.recordProgress(EPISODE, 90, true);
  await analytics.recordLocked(EPISODE, 'reward_required');
  await analytics.recordLocked(EPISODE, 'reward_required');
  await analytics.recordError({
    episodeId: EPISODE.episodeId,
    code: 'video_playback_failed',
    phase: 'play',
  });
  await analytics.recordError({
    episodeId: EPISODE.episodeId,
    code: 'video_playback_failed',
    phase: 'play',
  });

  expect(events.map((event) => event.name)).toEqual([
    'episode_started',
    'episode_completed',
    'locked_episode_viewed',
    'playback_error',
  ]);
});

it('does not invent an access method for staff support playback or expose unsafe error IDs', async () => {
  const { analytics, events } = setup(true);
  const staffEpisode: PlaybackAnalyticsEpisode = {
    seriesId: EPISODE.seriesId,
    episodeId: EPISODE.episodeId,
    seasonNumber: EPISODE.seasonNumber,
    episodeNumber: EPISODE.episodeNumber,
    durationSeconds: EPISODE.durationSeconds,
  };

  await analytics.recordStarted(staffEpisode);
  await analytics.recordError({
    episodeId: 'https://video.example.test/playlist.m3u8?token=secret',
    code: 'authorize_failed',
    phase: 'authorize',
  });

  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    name: 'playback_error',
    properties: { error_code: 'authorize_failed', playback_phase: 'authorize' },
  });
  expect(events[0]?.properties).not.toHaveProperty('episode_id');
});
