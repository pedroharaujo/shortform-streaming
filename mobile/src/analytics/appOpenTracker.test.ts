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

  expect(logOnce).toHaveBeenNthCalledWith(1, 'app_open', 'open:initial', {
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

it('does not suppress a later genuine foreground after an active-app deep link', () => {
  let now = 0;
  const logOnce = jest.fn(async () => ({ outcome: 'accepted' as const, eventId: 'evt_test' }));
  const tracker = createAppOpenTracker({ logOnce } as AnalyticsRuntime, () => now);

  tracker.recordDeepLink(
    {
      seriesId: 'ser_launch',
      target: '/series/ser_launch',
      attribution: {},
    },
    false,
  );
  now = 1_001;
  tracker.recordAppStateChange('background', 'active');

  expect(logOnce).toHaveBeenNthCalledWith(2, 'app_open', 'open:foreground:2', {
    launch_reason: 'foreground',
  });
});

it('uses a sanitized initial deep link for the cold trigger and suppresses a duplicate foreground', () => {
  const logOnce = jest.fn(async () => ({ outcome: 'accepted' as const, eventId: 'evt_test' }));
  const tracker = createAppOpenTracker({ logOnce } as AnalyticsRuntime);
  const link = {
    seriesId: 'ser_launch',
    target: '/series/ser_launch',
    attribution: { campaign: 'launch_1', source: 'tiktok' },
  };

  tracker.recordDeepLink(link, true);
  tracker.recordColdOpen();
  tracker.recordDeepLink(link, false);
  tracker.recordAppStateChange('background', 'active');

  expect(logOnce).toHaveBeenNthCalledWith(1, 'app_open', 'open:initial', {
    launch_reason: 'deep_link',
    campaign: 'launch_1',
    source: 'tiktok',
    deep_link_target: '/series/ser_launch',
  });
  expect(logOnce).toHaveBeenNthCalledWith(2, 'app_open', 'open:initial', {
    launch_reason: 'deep_link',
    campaign: 'launch_1',
    source: 'tiktok',
    deep_link_target: '/series/ser_launch',
  });
  expect(logOnce).toHaveBeenNthCalledWith(3, 'app_open', 'open:deep-link:1', {
    launch_reason: 'deep_link',
    campaign: 'launch_1',
    source: 'tiktok',
    deep_link_target: '/series/ser_launch',
  });
  expect(logOnce).toHaveBeenCalledTimes(3);
});
