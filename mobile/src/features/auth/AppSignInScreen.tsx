import type { JSX } from 'react';
import { useMemo } from 'react';

import { createAppMeClient } from '../../api/createAppClients';
import { getAppAccountAnalytics } from '../../analytics/appAnalytics';
import { getAppAnalyticsConsentController } from '../../analytics/appAnalyticsConsent';
import { createEmailPasswordAuth } from '../../auth/createEmailPasswordAuth';
import { SignInScreen } from './SignInScreen';

/** Email, password, and Google sign-in wired to this app's account service. */
export function AppSignInScreen({
  onFinished,
  onBack,
}: {
  readonly onFinished: () => void;
  readonly onBack?: (() => void) | undefined;
}): JSX.Element {
  const auth = useMemo(() => createEmailPasswordAuth(), []);
  const analytics = useMemo(() => getAppAccountAnalytics(), []);
  const analyticsConsent = useMemo(() => getAppAnalyticsConsentController(), []);
  const meClient = useMemo(() => createAppMeClient(), []);

  return (
    <SignInScreen
      auth={auth}
      analytics={analytics}
      analyticsConsent={analyticsConsent}
      meClient={meClient}
      onBack={onBack}
      onFinished={onFinished}
    />
  );
}
