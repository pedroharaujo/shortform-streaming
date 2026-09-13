import { Stack } from 'expo-router';
import type { JSX } from 'react';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppAnalyticsLifecycle } from '../src/analytics/AppAnalyticsLifecycle';
import { getAppOpenTracker } from '../src/analytics/appAnalytics';
import { getAppAnalyticsConsentController } from '../src/analytics/appAnalyticsConsent';
import { MessagesProvider } from '../src/localization/messages';
import { getAppSessionLifecycle } from '../src/auth/appSessionLifecycle';

export default function RootLayout(): JSX.Element {
  const consent = getAppAnalyticsConsentController();
  const tracker = getAppOpenTracker();
  const lifecycle = useMemo(() => getAppSessionLifecycle(), []);
  useEffect(() => lifecycle.start(), [lifecycle]);
  const sessionReady = useSyncExternalStore(
    lifecycle.subscribe,
    lifecycle.getSnapshot,
    lifecycle.getSnapshot,
  );

  return (
    <SafeAreaProvider>
      <MessagesProvider>
        <AppAnalyticsLifecycle consent={consent} tracker={tracker} />
        {sessionReady ? <Stack screenOptions={{ headerShown: false }} /> : null}
      </MessagesProvider>
    </SafeAreaProvider>
  );
}
