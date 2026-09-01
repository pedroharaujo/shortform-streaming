import { createAnalyticsClient, type AnalyticsEnvelope } from '../../analytics/client';
import { createAnalyticsRuntime } from '../../analytics/runtime';
import { createRewardAnalytics, type RewardAnalyticsEpisode } from './rewardAnalytics';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  digestStringAsync: jest.fn(async () => 'b'.repeat(64)),
}));

const EPISODE: RewardAnalyticsEpisode = {
  seriesId: 'ser_harbor',
  episodeId: 'ep_harbor_6',
  seasonNumber: 1,
  episodeNumber: 6,
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
    analytics: createRewardAnalytics(runtime),
    events,
    setEnabled: (next: boolean) => (enabled = next),
  };
}

it('emits the ordered rewarded trail only after analytics consent is active', async () => {
  const { analytics, events, setEnabled } = setup(false);
  const attempt = '11111111-1111-4111-8111-111111111111';

  await analytics.recordOfferPresented(EPISODE);
  await analytics.recordOfferSelected(EPISODE, attempt);
  await analytics.recordAdEvent(EPISODE, attempt, 'loaded');
  await analytics.recordGranted(EPISODE, attempt, 'admob_ssv');
  expect(events).toEqual([]);

  setEnabled(true);
  await analytics.recordOfferPresented(EPISODE);
  await analytics.recordOfferSelected(EPISODE, attempt);
  await analytics.recordAdEvent(EPISODE, attempt, 'loaded');
  await analytics.recordAdEvent(EPISODE, attempt, 'started');
  await analytics.recordAdEvent(EPISODE, attempt, 'completed');
  await analytics.recordGranted(EPISODE, attempt, 'admob_ssv');

  expect(events.map((event) => event.name)).toEqual([
    'offer_presented',
    'offer_selected',
    'rewarded_ad_loaded',
    'rewarded_ad_started',
    'rewarded_ad_completed',
    'reward_granted',
  ]);
  expect(events.every((event) => !JSON.stringify(event).includes('custom_data'))).toBe(true);
});

it('deduplicates retries, recovery, callback replay, and repeated terminal failures', async () => {
  const { analytics, events } = setup(true);
  const attempt = '22222222-2222-4222-8222-222222222222';

  for (let retry = 0; retry < 2; retry += 1) {
    await analytics.recordOfferSelected(EPISODE, attempt);
    await analytics.recordAdEvent(EPISODE, attempt, 'loaded');
    await analytics.recordAdEvent(EPISODE, attempt, 'completed');
    await analytics.recordGranted(EPISODE, attempt, 'admob_ssv');
    await analytics.recordFailed(EPISODE, attempt, 'verify', 'grant_source_unavailable');
  }

  expect(events.map((event) => event.name)).toEqual([
    'offer_selected',
    'rewarded_ad_loaded',
    'rewarded_ad_completed',
    'reward_granted',
    'reward_failed',
  ]);
});

it('uses only fixed safe failure properties when an attempt key is unsafe', async () => {
  const { analytics, events } = setup(true);
  await analytics.recordFailed(
    EPISODE,
    'https://provider.example/callback?token=secret',
    'present',
    'ad_present_failed',
  );

  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    name: 'reward_failed',
    properties: { failure_stage: 'present', error_code: 'ad_present_failed' },
  });
  expect(JSON.stringify(events[0])).not.toContain('provider.example');
});
