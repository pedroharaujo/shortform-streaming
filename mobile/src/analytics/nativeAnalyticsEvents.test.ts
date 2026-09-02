import { getAnalytics, logEvent } from '@react-native-firebase/analytics';

import { createNativeAnalyticsEventSink } from './nativeAnalyticsEvents';

const analytics = { app: 'synthetic-analytics-instance' };

jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(() => analytics),
  logEvent: jest.fn(async () => undefined),
}));

it('sends the allowlisted envelope through the modular Firebase API', async () => {
  const sink = createNativeAnalyticsEventSink();

  await sink.send({
    event_id: 'evt_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    name: 'app_open',
    properties: {
      session_id: 'session_01',
      app_version: '0.1.0',
      app_build: '1',
      platform: 'android',
      locale: 'en',
      occurred_at: '2026-09-01T10:00:00.000Z',
      launch_reason: 'cold',
    },
  });

  expect(getAnalytics).toHaveBeenCalledTimes(1);
  expect(logEvent).toHaveBeenCalledWith(analytics, 'app_open', {
    event_id: 'evt_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    session_id: 'session_01',
    app_version: '0.1.0',
    app_build: '1',
    platform: 'android',
    locale: 'en',
    occurred_at: '2026-09-01T10:00:00.000Z',
    launch_reason: 'cold',
  });
});
