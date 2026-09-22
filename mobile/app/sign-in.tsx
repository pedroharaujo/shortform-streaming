import type { JSX } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { AppSignInScreen } from '../src/features/auth/AppSignInScreen';
import { readRouteId } from '../src/features/catalog/readRouteId';

export default function SignInRoute(): JSX.Element {
  const params = useLocalSearchParams<{ returnEpisode?: string | string[] }>();
  const returnEpisode = readRouteId(params.returnEpisode);

  return (
    <AppSignInScreen
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }}
      onFinished={() => {
        if (returnEpisode) {
          router.dismissTo({ pathname: '/unlock/[id]', params: { id: returnEpisode } });
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
