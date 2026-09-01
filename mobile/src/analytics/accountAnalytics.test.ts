import { createAccountAnalytics } from './accountAnalytics';
import { createAnalyticsClient, type AnalyticsEnvelope } from './client';
import { createAnalyticsRuntime } from './runtime';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  digestStringAsync: jest.fn(async () => 'b'.repeat(64)),
}));

function setup(enabledInitially: boolean) {
  let enabled = enabledInitially;
  let sessionRevision = 7;
  let consentListener: ((enabled: boolean) => void) | undefined;
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
      now: () => new Date('2026-09-01T19:00:00.000Z'),
    },
  });
  const analytics = createAccountAnalytics(runtime, {
    consent: {
      subscribe(listener) {
        consentListener = listener;
        return () => {
          consentListener = undefined;
        };
      },
    },
    getSessionRevision: () => sessionRevision,
  });
  return {
    analytics,
    events,
    setEnabled(next: boolean) {
      enabled = next;
      consentListener?.(next);
    },
    setSessionRevision(next: number) {
      sessionRevision = next;
    },
  };
}

it('records confirmed authentication only after consent and deduplicates the session result', async () => {
  const { analytics, events, setEnabled } = setup(false);

  await analytics.recordAuthentication('sign_up', 'password', 7);
  expect(events).toEqual([]);

  setEnabled(true);
  await analytics.recordAuthentication('login', 'google', 7);
  await analytics.recordAuthentication('sign_up', 'password', 7);

  expect(events.map((event) => event.name)).toEqual(['sign_up', 'login']);
  expect(events[0]?.properties).toMatchObject({
    session_id: '0123456789abcdef',
    method: 'password',
  });
  expect(events[1]?.properties).toMatchObject({ method: 'google' });
  expect(JSON.stringify(events)).not.toContain('email');
  expect(JSON.stringify(events)).not.toContain('credential');
});

it('does not backfill a pending authentication event into a replacement account', async () => {
  const { analytics, events, setEnabled, setSessionRevision } = setup(false);

  await analytics.recordAuthentication('login', 'password', 7);
  setSessionRevision(8);
  setEnabled(true);
  await analytics.recordAuthentication('login', 'google', 8);

  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ name: 'login', properties: { method: 'google' } });
});

it('records an accepted deletion once without session, profile, receipt, or country properties', async () => {
  const { analytics, events } = setup(true);

  await analytics.recordDeletion('del_synthetic', 'pending');
  await analytics.recordDeletion('del_synthetic', 'pending');

  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    name: 'account_deleted',
    properties: {
      occurred_at: '2026-09-01T19:00:00.000Z',
      deletion_status: 'provider_cleanup_pending',
    },
  });
  expect(Object.keys(events[0]?.properties ?? {})).toEqual(['occurred_at', 'deletion_status']);
  expect(JSON.stringify(events[0])).not.toContain('del_synthetic');
});
