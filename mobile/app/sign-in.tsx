import type { JSX } from 'react';
import { useMemo } from 'react';
import { router } from 'expo-router';

import { createMeClient } from '../src/api/me/meClient';
import { createEmailPasswordAuth } from '../src/auth/createEmailPasswordAuth';
import { getSessionCredential } from '../src/auth/session';
import { getApiConfiguration } from '../src/config/appConfiguration';
import { SignInScreen } from '../src/features/auth/SignInScreen';

export default function SignInRoute(): JSX.Element {
  const configuration = useMemo(() => getApiConfiguration(), []);
  const auth = useMemo(() => createEmailPasswordAuth(), []);
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
