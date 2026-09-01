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
  return { events, runtime, setEnabled: (next: boolean) => (enabled = next) };
}

it('emits the launch event only after consent becomes active', async () => {
  const { events, runtime, setEnabled } = setup(false);
  await runtime.logOnce('app_open', 'open:cold', { launch_reason: 'cold' });
  expect(events).toEqual([]);

  setEnabled(true);
  await runtime.logOnce('app_open', 'open:cold', { launch_reason: 'cold' });

  expect(events.map((event) => event.name)).toEqual(['app_open']);
  expect(events[0]?.properties.session_id).toBe('0123456789abcdef');
});

it('deduplicates concurrent and repeated accepted events', async () => {
  const { events, runtime } = setup(true);
  const first = runtime.logOnce('app_open', 'open:cold', { launch_reason: 'cold' });
  const concurrent = runtime.logOnce('app_open', 'open:cold', { launch_reason: 'cold' });
  await Promise.all([first, concurrent]);
  await runtime.logOnce('app_open', 'open:cold', { launch_reason: 'cold' });
  expect(events).toHaveLength(1);
});

it('allows a consent-dropped login event to be retried', async () => {
  const { events, runtime, setEnabled } = setup(false);
  await runtime.logOnce('login', 'auth:1:google', { method: 'google' });
  setEnabled(true);
  await runtime.logOnce('login', 'auth:1:google', { method: 'google' });
  expect(events.map((event) => event.name)).toEqual(['login']);
});
