import { router, useFocusEffect } from 'expo-router';
import type { JSX } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { createAppAccountClient } from '../src/api/createAppClients';
import { createEmailPasswordAuth } from '../src/auth/createEmailPasswordAuth';
import { AccountScreen } from '../src/features/account/AccountScreen';

export default function AccountRoute(): JSX.Element {
  const auth = useMemo(() => createEmailPasswordAuth(), []);
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
      client={client}
      onSignIn={() => router.push('/sign-in')}
      onHome={() => router.replace('/')}
    />
  );
}
