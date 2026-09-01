import { digestStringAsync } from 'expo-crypto';

import { createAnalyticsClient, AnalyticsContractError, type AnalyticsEnvelope } from './client';
import { ANALYTICS_EVENT_NAMES, ANALYTICS_EVENT_SCHEMAS } from './events';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  digestStringAsync: jest.fn(async (_algorithm: string, input: string) => {
    let hash = 2166136261;
    for (const character of input) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, '0').repeat(8);
  }),
}));

const COMMON = {
  session_id: 'session_01',
  app_version: '0.1.0',
  app_build: '1',
  platform: 'android' as const,
  locale: 'en',
  country: 'FR',
  occurred_at: '2026-09-01T10:00:00.000Z',
};

function recordingSink() {
  const events: AnalyticsEnvelope[] = [];
  return { events, sink: { send: async (event: AnalyticsEnvelope) => void events.push(event) } };
}

it('knows every canonical MVP event and starts with collection disabled', async () => {
  expect(Object.keys(ANALYTICS_EVENT_SCHEMAS).sort()).toEqual([...ANALYTICS_EVENT_NAMES].sort());
  await expect(
    createAnalyticsClient().log('home_viewed', 'session_01:home', COMMON),
  ).resolves.toEqual({ outcome: 'dropped', reason: 'collection_disabled' });
});

it('still rejects developer contract mistakes while collection is disabled', async () => {
  const client = createAnalyticsClient({ mode: 'development' });
  const unsafeLog = client.log as (
    name: string,
    logicalEventKey: string,
    properties: object,
  ) => Promise<unknown>;

  await expect(
    unsafeLog('home_viewed', 'session_01:home', { ...COMMON, email: 'person@example.com' }),
  ).rejects.toThrow('Unknown property email');
});

it('reads consent at send time without rebuilding the client', async () => {
  const recorder = recordingSink();
  let enabled = false;
  const client = createAnalyticsClient({
    enabled: () => enabled,
    mode: 'development',
    sink: recorder.sink,
  });

  await expect(client.log('home_viewed', 'session_01:disabled', COMMON)).resolves.toEqual({
    outcome: 'dropped',
    reason: 'collection_disabled',
  });
  enabled = true;
  await expect(client.log('home_viewed', 'session_01:enabled', COMMON)).resolves.toMatchObject({
    outcome: 'accepted',
  });
  enabled = false;
  await expect(client.log('home_viewed', 'session_01:disabled_again', COMMON)).resolves.toEqual({
    outcome: 'dropped',
    reason: 'collection_disabled',
  });

  expect(recorder.events).toHaveLength(1);
});

it('creates one stable event ID for retries and a different ID for another logical event', async () => {
  const recorder = recordingSink();
  const client = createAnalyticsClient({ enabled: true, mode: 'development', sink: recorder.sink });

  const first = await client.log('episode_started', 'session_01:ep_harbor_s1_e1:start', {
    ...COMMON,
    series_id: 'ser_harbor',
    episode_id: 'ep_harbor_s1_e1',
    season_number: 1,
    episode_number: 1,
    access_method: 'free',
    start_position_seconds: 0,
  });
  const retry = await client.log('episode_started', 'session_01:ep_harbor_s1_e1:start', {
    ...COMMON,
    series_id: 'ser_harbor',
    episode_id: 'ep_harbor_s1_e1',
    season_number: 1,
    episode_number: 1,
    access_method: 'free',
    start_position_seconds: 0,
  });
  const completion = await client.log('episode_completed', 'session_01:ep_harbor_s1_e1:end', {
    ...COMMON,
    series_id: 'ser_harbor',
    episode_id: 'ep_harbor_s1_e1',
    season_number: 1,
    episode_number: 1,
    duration_seconds: 90,
  });

  expect(first).toEqual(retry);
  expect(first.outcome).toBe('accepted');
  expect(completion.outcome).toBe('accepted');
  if (first.outcome === 'accepted' && completion.outcome === 'accepted') {
    expect(first.eventId).toMatch(/^evt_[0-9a-f]{32}$/);
    expect(completion.eventId).not.toBe(first.eventId);
  }
  expect(recorder.events).toHaveLength(3);
});

it('rejects unknown events and properties during development without echoing values', async () => {
  const recorder = recordingSink();
  const client = createAnalyticsClient({ enabled: true, mode: 'development', sink: recorder.sink });
  const unsafeLog = client.log as (
    name: string,
    logicalEventKey: string,
    properties: object,
  ) => Promise<unknown>;

  await expect(unsafeLog('made_up_event', 'session_01:bad', COMMON)).rejects.toThrow(
    AnalyticsContractError,
  );
  await expect(
    unsafeLog('app_open', 'session_01:open', {
      ...COMMON,
      launch_reason: 'cold',
      email: 'person@example.com',
    }),
  ).rejects.toThrow('Unknown property email');
  expect(recorder.events).toHaveLength(0);
});

it('strips unknown or unsafe optional production values before they reach the sink', async () => {
  const recorder = recordingSink();
  const client = createAnalyticsClient({ enabled: true, mode: 'production', sink: recorder.sink });
  const unsafeLog = client.log as (
    name: 'app_open',
    logicalEventKey: string,
    properties: object,
  ) => Promise<unknown>;

  await expect(
    unsafeLog('app_open', 'session_01:open', {
      ...COMMON,
      launch_reason: 'cold',
      campaign: 'person@example.com',
      deep_link_target: 'https://media.example/video.m3u8?token=secret',
      auth_token: 'secret',
      error_payload: 'arbitrary provider response',
    }),
  ).resolves.toMatchObject({ outcome: 'accepted' });

  expect(recorder.events).toHaveLength(1);
  expect(recorder.events[0]?.properties).toEqual({ ...COMMON, launch_reason: 'cold' });
});

it('drops a production event when a required property is missing or unsafe', async () => {
  const recorder = recordingSink();
  const client = createAnalyticsClient({ enabled: true, mode: 'production', sink: recorder.sink });
  const unsafeLog = client.log as (
    name: 'playback_error',
    logicalEventKey: string,
    properties: object,
  ) => Promise<unknown>;

  await expect(
    unsafeLog('playback_error', 'session_01:error', {
      ...COMMON,
      error_code: 'https://media.example/video.m3u8?token=secret',
      playback_phase: 'play',
    }),
  ).resolves.toEqual({ outcome: 'dropped', reason: 'invalid_contract' });
  expect(recorder.events).toHaveLength(0);
});

it('keeps account deletion free of session, profile, and country identifiers', async () => {
  const recorder = recordingSink();
  const client = createAnalyticsClient({ enabled: true, mode: 'production', sink: recorder.sink });
  const unsafeLog = client.log as (
    name: 'account_deleted',
    logicalEventKey: string,
    properties: object,
  ) => Promise<unknown>;

  await expect(
    unsafeLog('account_deleted', 'deletion_receipt_01', {
      occurred_at: COMMON.occurred_at,
      deletion_status: 'completed',
      session_id: COMMON.session_id,
      profile_id: 'usr_private',
      country: COMMON.country,
    }),
  ).resolves.toMatchObject({ outcome: 'accepted' });
  expect(recorder.events[0]?.properties).toEqual({
    occurred_at: COMMON.occurred_at,
    deletion_status: 'completed',
  });
});

it('rejects impossible calendar timestamps', async () => {
  const recorder = recordingSink();
  const client = createAnalyticsClient({ enabled: true, mode: 'production', sink: recorder.sink });

  await expect(
    client.log('home_viewed', 'session_01:home', {
      ...COMMON,
      occurred_at: '2026-99-99T10:00:00.000Z',
    }),
  ).resolves.toEqual({ outcome: 'dropped', reason: 'invalid_contract' });
  await expect(
    client.log('home_viewed', 'session_01:home', {
      ...COMMON,
      occurred_at: '2026-02-30T10:00:00.000Z',
    }),
  ).resolves.toEqual({ outcome: 'dropped', reason: 'invalid_contract' });
  expect(recorder.events).toHaveLength(0);
});

it('contains sink failures so analytics cannot break the product flow', async () => {
  const client = createAnalyticsClient({
    enabled: true,
    mode: 'production',
    sink: { send: async () => Promise.reject(new Error('provider unavailable')) },
  });

  await expect(client.log('home_viewed', 'session_01:home', COMMON)).resolves.toEqual({
    outcome: 'dropped',
    reason: 'sink_unavailable',
  });
});

it('contains event ID failures so analytics cannot break the product flow', async () => {
  jest.mocked(digestStringAsync).mockRejectedValueOnce(new Error('crypto unavailable'));
  const recorder = recordingSink();
  const client = createAnalyticsClient({ enabled: true, mode: 'production', sink: recorder.sink });

  await expect(client.log('home_viewed', 'session_01:home', COMMON)).resolves.toEqual({
    outcome: 'dropped',
    reason: 'sink_unavailable',
  });
  expect(recorder.events).toHaveLength(0);
});
