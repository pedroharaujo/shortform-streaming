import type { JSX } from 'react';
import { useMemo } from 'react';
import { router } from 'expo-router';

import { createMeClient } from '../src/api/me/meClient';
import { createLocalMockFirebaseAuth } from '../src/auth/localMockFirebaseAuth';
import { getSessionCredential } from '../src/auth/session';
import { getApiConfiguration } from '../src/config/appConfiguration';
import { SignInScreen } from '../src/features/auth/SignInScreen';

export default function SignInRoute(): JSX.Element {
  const configuration = useMemo(() => getApiConfiguration(), []);
  const auth = useMemo(() => createLocalMockFirebaseAuth(), []);
  const meClient = useMemo(
    () =>
      createMeClient({
        baseUrl: configuration.baseUrl,
        getCredential: getSessionCredential,
      }),
    [configuration.baseUrl],
  );

  return (
    <SignInScreen
      auth={auth}
      meClient={meClient}
      onFinished={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }
        router.replace('/');
      }}
    />
  );
}
