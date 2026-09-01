import type { AnalyticsSink } from './client';
import { selectAnalyticsEventSink } from './appAnalytics';

it('uses a no-op sink when analytics is disabled', async () => {
  const createNativeSink = jest.fn<AnalyticsSink, []>(() => ({
    send: async () => Promise.reject(new Error('must not be used')),
  }));
  const sink = selectAnalyticsEventSink({ enabled: false, createNativeSink });

  await expect(
    sink.send({ event_id: 'evt_test', name: 'app_open', properties: {} }),
  ).resolves.toBeUndefined();
  expect(createNativeSink).not.toHaveBeenCalled();
});

it('selects native transport when the build explicitly enables analytics', () => {
  const nativeSink: AnalyticsSink = { send: async () => undefined };
  const createNativeSink = jest.fn(() => nativeSink);

  expect(selectAnalyticsEventSink({ enabled: true, createNativeSink })).toBe(nativeSink);
  expect(createNativeSink).toHaveBeenCalledTimes(1);
});
