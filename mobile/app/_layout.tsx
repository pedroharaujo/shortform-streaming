import { Stack } from 'expo-router';
import type { JSX } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppAnalyticsLifecycle } from '../src/analytics/AppAnalyticsLifecycle';
import { getAppOpenTracker } from '../src/analytics/appAnalytics';
import { getAppAnalyticsConsentController } from '../src/analytics/appAnalyticsConsent';
import { MessagesProvider } from '../src/localization/messages';

export default function RootLayout(): JSX.Element {
  const consent = getAppAnalyticsConsentController();
  const tracker = getAppOpenTracker();

  return (
    <SafeAreaProvider>
      <MessagesProvider>
        <AppAnalyticsLifecycle consent={consent} tracker={tracker} />
        <Stack screenOptions={{ headerShown: false }} />
      </MessagesProvider>
    </SafeAreaProvider>
  );
}
