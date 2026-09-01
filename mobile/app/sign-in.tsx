import type { JSX } from 'react';
import { useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { createAppMeClient } from '../src/api/createAppClients';
import { getAppAnalyticsConsentController } from '../src/analytics/appAnalyticsConsent';
import { createEmailPasswordAuth } from '../src/auth/createEmailPasswordAuth';
import { SignInScreen } from '../src/features/auth/SignInScreen';
import { readRouteId } from '../src/features/catalog/readRouteId';

export default function SignInRoute(): JSX.Element {
  const params = useLocalSearchParams<{ returnEpisode?: string | string[] }>();
  const returnEpisode = readRouteId(params.returnEpisode);
  const auth = useMemo(() => createEmailPasswordAuth(), []);
  const analyticsConsent = useMemo(() => getAppAnalyticsConsentController(), []);
  const meClient = useMemo(() => createAppMeClient(), []);

  return (
    <SignInScreen
      auth={auth}
      analyticsConsent={analyticsConsent}
      meClient={meClient}
      onFinished={() => {
        if (returnEpisode) {
          router.replace({ pathname: '/reward/[id]', params: { id: returnEpisode } });
          return;
        }
        if (router.canGoBack()) {
          router.back();
          return;
        }
        router.replace('/');
      }}
    />
  );
}
