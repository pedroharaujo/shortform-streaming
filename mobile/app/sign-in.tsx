import type { JSX } from 'react';
import { useMemo } from 'react';
import { router } from 'expo-router';

import { createAppMeClient } from '../src/api/createAppClients';
import { createEmailPasswordAuth } from '../src/auth/createEmailPasswordAuth';
import { SignInScreen } from '../src/features/auth/SignInScreen';

export default function SignInRoute(): JSX.Element {
  const auth = useMemo(() => createEmailPasswordAuth(), []);
  const meClient = useMemo(() => createAppMeClient(), []);

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
