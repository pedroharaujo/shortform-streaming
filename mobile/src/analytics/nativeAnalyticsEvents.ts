import { getAnalytics, logEvent } from '@react-native-firebase/analytics';

import type { AnalyticsSink } from './client';

export function createNativeAnalyticsEventSink(): AnalyticsSink {
  const analytics = getAnalytics();
  return {
    async send(event) {
      const sendValidatedEvent = logEvent as (
        instance: typeof analytics,
        name: string,
        parameters: Record<string, string | number>,
      ) => void | Promise<void>;
      await sendValidatedEvent(analytics, event.name, {
        event_id: event.event_id,
        ...event.properties,
      });
    },
  };
}
