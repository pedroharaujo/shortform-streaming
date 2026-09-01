import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { JSX } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { createAppAccountClient } from '../src/api/createAppClients';
import { getAppAccountAnalytics } from '../src/analytics/appAnalytics';
import { getAppAnalyticsConsentController } from '../src/analytics/appAnalyticsConsent';
import { createEmailPasswordAuth } from '../src/auth/createEmailPasswordAuth';
import { AccountScreen } from '../src/features/account/AccountScreen';
import { readRouteId } from '../src/features/catalog/readRouteId';

export default function AccountRoute(): JSX.Element {
  const params = useLocalSearchParams<{ returnEpisode?: string | string[] }>();
  const returnEpisode = readRouteId(params.returnEpisode);
  const auth = useMemo(() => createEmailPasswordAuth(), []);
  const analytics = useMemo(() => getAppAccountAnalytics(), []);
  const analyticsConsent = useMemo(() => getAppAnalyticsConsentController(), []);
  const client = useMemo(() => createAppAccountClient(), []);
  const [visit, setVisit] = useState(0);
  // Refresh the profile when returning from sign-in; never retain another account's preferences.
  useFocusEffect(
    useCallback(() => {
      setVisit((value) => value + 1);
    }, []),
  );
  return (
    <AccountScreen
      key={visit}
      auth={auth}
      analytics={analytics}
      analyticsConsent={analyticsConsent}
      client={client}
      onSignIn={() =>
        router.push(
          returnEpisode ? { pathname: '/sign-in', params: { returnEpisode } } : '/sign-in',
        )
      }
      onReturnToEpisode={
        returnEpisode
          ? () => router.replace({ pathname: '/reward/[id]', params: { id: returnEpisode } })
          : undefined
      }
      onHome={() => router.replace('/')}
    />
  );
}
