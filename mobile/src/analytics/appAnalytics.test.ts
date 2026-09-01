import type { AnalyticsSink } from './client';
import { selectAnalyticsEventSink } from './appAnalytics';

it('keeps production on a hard no-op sink without constructing Firebase transport', async () => {
  const createNativeSink = jest.fn<AnalyticsSink, []>(() => ({
    send: async () => Promise.reject(new Error('must not be used')),
  }));
  const sink = selectAnalyticsEventSink({ environment: 'production', createNativeSink });

  await expect(
    sink.send({ event_id: 'evt_test', name: 'home_viewed', properties: {} }),
  ).resolves.toBeUndefined();
  expect(createNativeSink).not.toHaveBeenCalled();
});

it('selects native transport only for non-production environments', () => {
  const nativeSink: AnalyticsSink = { send: async () => undefined };
  const createNativeSink = jest.fn(() => nativeSink);

  expect(selectAnalyticsEventSink({ environment: 'staging', createNativeSink })).toBe(nativeSink);
  expect(createNativeSink).toHaveBeenCalledTimes(1);
});
