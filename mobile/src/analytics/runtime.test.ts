import { createAnalyticsClient, type AnalyticsEnvelope } from './client';
import { createAnalyticsRuntime } from './runtime';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  digestStringAsync: jest.fn(async () => 'a'.repeat(64)),
}));

function setup(enabledInitially: boolean) {
  let enabled = enabledInitially;
  const events: AnalyticsEnvelope[] = [];
  const client = createAnalyticsClient({
    enabled: () => enabled,
    mode: 'development',
    sink: { send: async (event) => void events.push(event) },
  });
  const runtime = createAnalyticsRuntime({
    client,
    sessionId: '0123456789abcdef',
    context: {
      appVersion: '0.1.0',
      appBuild: '1',
      platform: 'android',
      locale: 'en',
      now: () => new Date('2026-09-01T10:00:00.000Z'),
    },
  });
  return { events, runtime, setEnabled: (next: boolean) => (enabled = next) };
}

it('emits an ordered discovery trail only after consent becomes active', async () => {
  const { events, runtime, setEnabled } = setup(false);

  await runtime.logOnce('app_open', 'open:cold', { launch_reason: 'cold' });
  await runtime.logOnce('home_viewed', 'home', {});
  expect(events).toEqual([]);

  setEnabled(true);
  await runtime.logOnce('app_open', 'open:cold', { launch_reason: 'cold' });
  await runtime.logOnce('home_viewed', 'home', {});
  await runtime.logOnce('series_impression', 'i:ser_harbor:0', {
    series_id: 'ser_harbor',
    position: 0,
  });
  await runtime.logOnce('series_opened', 's:ser_harbor', { series_id: 'ser_harbor' });

  expect(events.map((event) => event.name)).toEqual([
    'app_open',
    'home_viewed',
    'series_impression',
    'series_opened',
  ]);
  expect(events.every((event) => event.properties.session_id === '0123456789abcdef')).toBe(true);
});

it('deduplicates concurrent and repeated accepted logical events', async () => {
  const { events, runtime } = setup(true);

  const first = runtime.logOnce('home_viewed', 'home', {});
  const concurrent = runtime.logOnce('home_viewed', 'home', {});
  await expect(Promise.all([first, concurrent])).resolves.toEqual([
    expect.objectContaining({ outcome: 'accepted' }),
    expect.objectContaining({ outcome: 'accepted' }),
  ]);
  await expect(runtime.logOnce('home_viewed', 'home', {})).resolves.toMatchObject({
    outcome: 'accepted',
  });

  expect(events).toHaveLength(1);
});

it('allows a dropped logical event to be retried after consent changes', async () => {
  const { events, runtime, setEnabled } = setup(false);

  await runtime.logOnce('series_opened', 's:ser_harbor', { series_id: 'ser_harbor' });
  setEnabled(true);
  await runtime.logOnce('series_opened', 's:ser_harbor', { series_id: 'ser_harbor' });

  expect(events).toHaveLength(1);
  expect(events[0]?.name).toBe('series_opened');
});

it('keeps impression keys within the contract for the longest valid series ID', async () => {
  const { events, runtime } = setup(true);
  const seriesId = `s${'a'.repeat(99)}`;

  await expect(
    runtime.logOnce('series_impression', `i:${seriesId}:100000`, {
      series_id: seriesId,
      position: 100000,
    }),
  ).resolves.toMatchObject({ outcome: 'accepted' });
  expect(events).toHaveLength(1);
});
