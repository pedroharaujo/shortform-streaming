import type { AnalyticsRuntime } from './runtime';
import { createAppOpenTracker } from './appOpenTracker';

it('records one cold trigger and only inactive-to-active foreground transitions', () => {
  const logOnce = jest.fn(async () => ({ outcome: 'accepted' as const, eventId: 'evt_test' }));
  const tracker = createAppOpenTracker({ logOnce } as AnalyticsRuntime);

  tracker.recordColdOpen();
  tracker.recordAppStateChange('active', 'background');
  tracker.recordAppStateChange('background', 'inactive');
  tracker.recordAppStateChange('inactive', 'active');
  tracker.recordAppStateChange('active', 'active');
  tracker.recordAppStateChange('background', 'active');

  expect(logOnce).toHaveBeenNthCalledWith(1, 'app_open', 'open:cold', {
    launch_reason: 'cold',
  });
  expect(logOnce).toHaveBeenNthCalledWith(2, 'app_open', 'open:foreground:1', {
    launch_reason: 'foreground',
  });
  expect(logOnce).toHaveBeenNthCalledWith(3, 'app_open', 'open:foreground:2', {
    launch_reason: 'foreground',
  });
  expect(logOnce).toHaveBeenCalledTimes(3);
});
