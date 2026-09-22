import { act, fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';

import type { MeClient } from '../../api/me/types';
import type { AccountAnalytics } from '../../analytics/accountAnalytics';
import type { AnalyticsConsentController } from '../../analytics/consentController';
import { createLocalMockFirebaseAuth } from '../../auth/localMockFirebaseAuth';
import { getAuthSessionRevision, getSessionCredential, setAuthSession } from '../../auth/session';
import { englishMessages } from '../../localization/messages';
import { compactAndroidMetrics, renderWithSafeArea } from '../../testUtils';
import { minimumTouchTarget } from '../../ui/theme';
import { SignInScreen } from './SignInScreen';

const PROFILE = {
  public_id: 'usr_from_server',
  created_at: '2026-08-25T00:00:00Z',
  updated_at: '2026-08-25T00:00:00Z',
  locale: 'en',
  country: '',
  analytics_consent: false,
  ads_consent: false,
  auto_unlock_next: false,
  consent_updated_at: null,
};

function okMeClient(): { getMe: jest.Mock; meClient: MeClient } {
  const getMe = jest.fn(async () => ({ outcome: 'ok' as const, data: PROFILE }));
  return { getMe, meClient: { getMe } };
}

function analyticsConsentDouble(): jest.Mocked<AnalyticsConsentController> {
  return {
    applyProfile: jest.fn<
      ReturnType<AnalyticsConsentController['applyProfile']>,
      Parameters<AnalyticsConsentController['applyProfile']>
    >(async () => true),
    clearForAccountDeletion: jest.fn<
      ReturnType<AnalyticsConsentController['clearForAccountDeletion']>,
      Parameters<AnalyticsConsentController['clearForAccountDeletion']>
    >(async () => true),
    clear: jest.fn(async () => true),
    isCollectionEnabled: jest.fn(() => false),
    subscribe: jest.fn<
      ReturnType<AnalyticsConsentController['subscribe']>,
      Parameters<AnalyticsConsentController['subscribe']>
    >(() => () => undefined),
  };
}

function accountAnalyticsDouble(): jest.Mocked<AccountAnalytics> {
  return {
    recordAuthentication: jest.fn<
      ReturnType<AccountAnalytics['recordAuthentication']>,
      Parameters<AccountAnalytics['recordAuthentication']>
    >(async () => undefined),
    recordDeletion: jest.fn<
      ReturnType<AccountAnalytics['recordDeletion']>,
      Parameters<AccountAnalytics['recordDeletion']>
    >(async () => undefined),
  };
}

async function completePasswordSteps(
  view: Awaited<ReturnType<typeof render>>,
  start: 'sign-in-start-create' | 'sign-in-start-login',
  email: string,
  password: string,
): Promise<void> {
  await fireEvent.press(view.getByTestId(start));
  await fireEvent.changeText(view.getByTestId('sign-in-email'), email);
  await fireEvent.press(view.getByTestId('sign-in-continue'));
  await fireEvent.changeText(view.getByTestId('sign-in-password'), password);
  await fireEvent.press(view.getByTestId('sign-in-submit'));
}

describe('SignInScreen', () => {
  afterEach(async () => {
    await act(() => setAuthSession(null));
  });

  it('signs in with email/password and loads /v1/me without sending a backend user id', async () => {
    const auth = createLocalMockFirebaseAuth();
    const { getMe, meClient } = okMeClient();
    const analytics = accountAnalyticsDouble();
    const analyticsConsent = analyticsConsentDouble();
    const onFinished = jest.fn();
    const view = await render(
      <SignInScreen
        auth={auth}
        analytics={analytics}
        analyticsConsent={analyticsConsent}
        meClient={meClient}
        onFinished={onFinished}
      />,
    );

    await completePasswordSteps(view, 'sign-in-start-login', 'user@example.com', 'correct-horse');

    await waitFor(() => expect(getSessionCredential()).toBe('mock.user_example_com'));
    expect(getMe).toHaveBeenCalledWith('mock.user_example_com');
    expect(getSessionCredential()).not.toContain('usr_from_server');
    expect(analyticsConsent.clear).toHaveBeenCalledTimes(1);
    expect(analyticsConsent.applyProfile).toHaveBeenCalledWith({
      profileId: 'usr_from_server',
      analyticsConsent: false,
      sessionRevision: getAuthSessionRevision(),
    });
    expect(analytics.recordAuthentication).toHaveBeenCalledWith(
      'login',
      'password',
      getAuthSessionRevision(),
    );
    expect(onFinished).toHaveBeenCalled();
  });

  it('records password sign-up only after the new account is confirmed by /v1/me', async () => {
    const auth = createLocalMockFirebaseAuth();
    const { meClient } = okMeClient();
    const analytics = accountAnalyticsDouble();
    const user = userEvent.setup();
    const view = await render(
      <SignInScreen
        auth={auth}
        analytics={analytics}
        analyticsConsent={analyticsConsentDouble()}
        meClient={meClient}
        onFinished={jest.fn()}
      />,
    );

    await user.press(view.getByTestId('sign-in-start-create'));
    await user.type(view.getByTestId('sign-in-email'), 'not-an-email');
    await user.press(view.getByTestId('sign-in-continue'));
    expect(view.getByTestId('sign-in-message')).toHaveTextContent(
      englishMessages.auth.invalidEmail,
    );
    expect(view.queryByTestId('sign-in-password')).toBeNull();

    await user.clear(view.getByTestId('sign-in-email'));
    await user.type(view.getByTestId('sign-in-email'), 'new@example.com');
    await user.press(view.getByTestId('sign-in-continue'));
    expect(view.getByText('new@example.com')).toBeTruthy();
    await user.type(view.getByTestId('sign-in-password'), 'correct-horse');
    await user.press(view.getByTestId('sign-in-submit'));

    await waitFor(() =>
      expect(analytics.recordAuthentication).toHaveBeenCalledWith(
        'sign_up',
        'password',
        getAuthSessionRevision(),
      ),
    );
  });

  it('keeps the sign-in form open when the account service rejects the new session', async () => {
    const auth = createLocalMockFirebaseAuth();
    const onFinished = jest.fn();
    const view = await render(
      <SignInScreen
        auth={auth}
        analytics={accountAnalyticsDouble()}
        analyticsConsent={analyticsConsentDouble()}
        meClient={{
          getMe: async () => ({
            outcome: 'unauthenticated',
            httpStatus: 401,
            code: 'unauthenticated',
            message: 'Authentication is required.',
          }),
        }}
        onFinished={onFinished}
      />,
    );

    await completePasswordSteps(view, 'sign-in-start-login', 'viewer@stovio.test', 'StovioLocal1!');

    expect(await view.findByText(englishMessages.auth.profileFailed)).toBeTruthy();
    expect(getSessionCredential()).toBeNull();
    expect(onFinished).not.toHaveBeenCalled();
    expect(view.getByTestId('sign-in-screen')).toBeTruthy();
  });

  it('keeps the password step open with a plain message when the password is wrong', async () => {
    const auth = createLocalMockFirebaseAuth();
    await auth.signUp('user@example.com', 'correct-horse');
    await auth.signOut();
    const { getMe, meClient } = okMeClient();
    const view = await render(
      <SignInScreen
        auth={auth}
        analytics={accountAnalyticsDouble()}
        analyticsConsent={analyticsConsentDouble()}
        meClient={meClient}
        onFinished={jest.fn()}
      />,
    );

    await completePasswordSteps(view, 'sign-in-start-login', 'user@example.com', 'wrong-horse');

    expect(await view.findByText(englishMessages.auth.loginFailed)).toBeTruthy();
    expect(view.queryByText('Email or password is incorrect.')).toBeNull();
    expect(view.getByTestId('sign-in-password')).toBeTruthy();
    expect(getMe).not.toHaveBeenCalled();
    expect(getSessionCredential()).toBeNull();
  });

  it('signs out and clears the session credential', async () => {
    const auth = createLocalMockFirebaseAuth();
    const analyticsConsent = analyticsConsentDouble();
    await auth.signIn('user@example.com', 'correct-horse');
    await act(() => setAuthSession({ credential: 'mock.user_example_com' }));
    const user = userEvent.setup();
    const view = await render(
      <SignInScreen
        auth={auth}
        analytics={accountAnalyticsDouble()}
        analyticsConsent={analyticsConsent}
        meClient={{ getMe: jest.fn() }}
        onFinished={jest.fn()}
      />,
    );
    await user.press(view.getByTestId('sign-in-sign-out'));

    await waitFor(() => expect(view.getByTestId('sign-in-message')).toBeTruthy());
    expect(getSessionCredential()).toBeNull();
    expect(auth.getCredential()).toBeNull();
    expect(analyticsConsent.clear).toHaveBeenCalledTimes(1);
  });

  it('classifies first-time Google as sign-up without sending a backend user id', async () => {
    const auth = createLocalMockFirebaseAuth();
    const { meClient } = okMeClient();
    const analytics = accountAnalyticsDouble();
    const analyticsConsent = analyticsConsentDouble();
    const onFinished = jest.fn();
    const user = userEvent.setup();
    const view = await render(
      <SignInScreen
        auth={auth}
        analytics={analytics}
        analyticsConsent={analyticsConsent}
        meClient={meClient}
        onFinished={onFinished}
      />,
    );

    expect(view.queryByLabelText('Sign in with Apple')).toBeNull();
    await user.press(view.getByTestId('sign-in-google'));

    await waitFor(() => expect(getSessionCredential()).toBe('mock.google_user'));
    expect(getSessionCredential()).not.toContain('usr_from_server');
    expect(analytics.recordAuthentication).toHaveBeenCalledWith(
      'sign_up',
      'google',
      getAuthSessionRevision(),
    );
    expect(onFinished).toHaveBeenCalled();
  });

  it('treats Google Sign-In cancellation as a no-op', async () => {
    const auth = {
      ...createLocalMockFirebaseAuth(),
      signInWithGoogle: jest.fn(async () => ({ outcome: 'cancelled' as const })),
    };
    const getMe = jest.fn();
    const analyticsConsent = analyticsConsentDouble();
    const user = userEvent.setup();
    const view = await render(
      <SignInScreen
        auth={auth}
        analytics={accountAnalyticsDouble()}
        analyticsConsent={analyticsConsent}
        meClient={{ getMe }}
        onFinished={jest.fn()}
      />,
    );

    await user.press(view.getByTestId('sign-in-google'));

    await waitFor(() => expect(view.getByTestId('sign-in-google')).toBeEnabled());
    expect(getMe).not.toHaveBeenCalled();
    expect(getSessionCredential()).toBeNull();
    expect(analyticsConsent.clear).not.toHaveBeenCalled();
    expect(view.queryByTestId('sign-in-message')).toBeNull();
  });

  it('shows a Google Sign-In error without creating a session', async () => {
    const auth = {
      ...createLocalMockFirebaseAuth(),
      signInWithGoogle: jest.fn(async () => ({
        outcome: 'error' as const,
        message: 'Google Play services are not available.',
      })),
    };
    const getMe = jest.fn();
    const analyticsConsent = analyticsConsentDouble();
    const user = userEvent.setup();
    const view = await render(
      <SignInScreen
        auth={auth}
        analytics={accountAnalyticsDouble()}
        analyticsConsent={analyticsConsent}
        meClient={{ getMe }}
        onFinished={jest.fn()}
      />,
    );

    await user.press(view.getByTestId('sign-in-google'));

    await waitFor(() => expect(view.getByTestId('sign-in-message')).toBeTruthy());
    expect(view.getByTestId('sign-in-message')).toHaveTextContent(
      englishMessages.auth.authenticationFailed,
    );
    expect(view.queryByText('Google Play services are not available.')).toBeNull();
    expect(getMe).not.toHaveBeenCalled();
    expect(getSessionCredential()).toBeNull();
    expect(analyticsConsent.clear).not.toHaveBeenCalled();
  });

  it('recovers from an unexpected provider rejection with localized copy', async () => {
    const auth = {
      ...createLocalMockFirebaseAuth(),
      signInWithGoogle: jest.fn(async () => {
        throw new Error('private provider rejection');
      }),
    };
    const user = userEvent.setup();
    const view = await render(
      <SignInScreen
        auth={auth}
        analytics={accountAnalyticsDouble()}
        analyticsConsent={analyticsConsentDouble()}
        meClient={okMeClient().meClient}
        onFinished={jest.fn()}
      />,
    );

    await user.press(view.getByTestId('sign-in-google'));

    await waitFor(() => expect(view.getByTestId('sign-in-google')).toBeEnabled());
    expect(view.getByTestId('sign-in-message')).toHaveTextContent(
      englishMessages.auth.authenticationFailed,
    );
    expect(view.queryByText('private provider rejection')).toBeNull();
    expect(getSessionCredential()).toBeNull();
  });

  it('does not link a late profile response after the session is replaced', async () => {
    const auth = createLocalMockFirebaseAuth();
    const analytics = accountAnalyticsDouble();
    const analyticsConsent = analyticsConsentDouble();
    let resolveMe!: (value: Awaited<ReturnType<MeClient['getMe']>>) => void;
    const getMe = jest.fn(
      () =>
        new Promise<Awaited<ReturnType<MeClient['getMe']>>>((resolve) => {
          resolveMe = resolve;
        }),
    );
    const onFinished = jest.fn();
    const user = userEvent.setup();
    const view = await render(
      <SignInScreen
        auth={auth}
        analytics={analytics}
        analyticsConsent={analyticsConsent}
        meClient={{ getMe }}
        onFinished={onFinished}
      />,
    );

    await user.press(view.getByTestId('sign-in-google'));
    await waitFor(() => expect(getMe).toHaveBeenCalledTimes(1));
    await act(() => setAuthSession({ credential: 'mock.replacement_account' }));
    resolveMe({ outcome: 'ok', data: PROFILE });

    await waitFor(() => expect(view.getByTestId('sign-in-google')).toBeEnabled());
    expect(analyticsConsent.applyProfile).not.toHaveBeenCalled();
    expect(analytics.recordAuthentication).not.toHaveBeenCalled();
    expect(onFinished).not.toHaveBeenCalled();
    expect(getSessionCredential()).toBe('mock.replacement_account');
  });

  it('does not overwrite a replacement session while pre-sign-in cleanup is pending', async () => {
    const auth = createLocalMockFirebaseAuth();
    const analyticsConsent = analyticsConsentDouble();
    let resolveClear!: (value: boolean) => void;
    analyticsConsent.clear.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveClear = resolve;
        }),
    );
    const getMe = jest.fn();
    const user = userEvent.setup();
    const view = await render(
      <SignInScreen
        auth={auth}
        analytics={accountAnalyticsDouble()}
        analyticsConsent={analyticsConsent}
        meClient={{ getMe }}
        onFinished={jest.fn()}
      />,
    );

    await user.press(view.getByTestId('sign-in-google'));
    await waitFor(() => expect(analyticsConsent.clear).toHaveBeenCalledTimes(1));
    await act(() => setAuthSession({ credential: 'mock.replacement_account' }));
    await act(async () => resolveClear(true));

    await waitFor(() => expect(view.getByTestId('sign-in-google')).toBeEnabled());
    expect(getMe).not.toHaveBeenCalled();
    expect(analyticsConsent.applyProfile).not.toHaveBeenCalled();
    expect(getSessionCredential()).toBe('mock.replacement_account');
  });

  it('does not sign out a replacement session while analytics cleanup is pending', async () => {
    await act(() => setAuthSession({ credential: 'mock.original_account' }));
    const auth = { ...createLocalMockFirebaseAuth(), signOut: jest.fn(async () => undefined) };
    const analyticsConsent = analyticsConsentDouble();
    let resolveClear!: (value: boolean) => void;
    analyticsConsent.clear.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveClear = resolve;
        }),
    );
    const user = userEvent.setup();
    const view = await render(
      <SignInScreen
        auth={auth}
        analytics={accountAnalyticsDouble()}
        analyticsConsent={analyticsConsent}
        meClient={{ getMe: jest.fn() }}
        onFinished={jest.fn()}
      />,
    );

    await user.press(view.getByTestId('sign-in-sign-out'));
    await waitFor(() => expect(analyticsConsent.clear).toHaveBeenCalledTimes(1));
    await act(() => setAuthSession({ credential: 'mock.replacement_account' }));
    await act(async () => resolveClear(true));

    await waitFor(() => expect(view.getByTestId('sign-in-sign-out')).toBeEnabled());
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(getSessionCredential()).toBe('mock.replacement_account');
  });

  it('does not let a stale sign-in screen clear a replacement session', async () => {
    await act(() => setAuthSession({ credential: 'mock.original_account' }));
    const auth = { ...createLocalMockFirebaseAuth(), signOut: jest.fn(async () => undefined) };
    const analyticsConsent = analyticsConsentDouble();
    const user = userEvent.setup();
    const view = await render(
      <SignInScreen
        auth={auth}
        analytics={accountAnalyticsDouble()}
        analyticsConsent={analyticsConsent}
        meClient={{ getMe: jest.fn() }}
        onFinished={jest.fn()}
      />,
    );
    await act(() => setAuthSession({ credential: 'mock.replacement_account' }));

    await user.press(view.getByTestId('sign-in-sign-out'));

    expect(view.getByTestId('sign-in-message')).toHaveTextContent(/session changed/);
    expect(analyticsConsent.clear).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(getSessionCredential()).toBe('mock.replacement_account');
  });

  it('keeps long localized actions reachable on a compact Android screen', async () => {
    const longMessages = {
      ...englishMessages,
      auth: {
        ...englishMessages.auth,
        createAccount: 'Create a new account using this email address and password',
        haveAccount: 'I already have an account and want to sign in with it on this device',
        signInGoogle: 'Continue by signing in with the Google account on this Android device',
      },
    };
    const view = await renderWithSafeArea(
      <SignInScreen
        auth={createLocalMockFirebaseAuth()}
        analytics={accountAnalyticsDouble()}
        analyticsConsent={analyticsConsentDouble()}
        meClient={okMeClient().meClient}
        onFinished={jest.fn()}
      />,
      { messages: longMessages, metrics: compactAndroidMetrics },
    );

    expect(view.getByTestId('sign-in-scroll')).toBeTruthy();
    expect(view.getByRole('header', { name: longMessages.catalog.brand })).toBeTruthy();
    for (const label of [
      longMessages.auth.createAccount,
      longMessages.auth.haveAccount,
      longMessages.auth.signInGoogle,
    ]) {
      expect(view.getByLabelText(label)).toHaveStyle({ minHeight: minimumTouchTarget });
    }

    await userEvent.setup().press(view.getByTestId('sign-in-start-login'));
    expect(view.getByTestId('sign-in-scroll')).toBeTruthy();
    expect(view.getByLabelText(longMessages.auth.email)).toHaveStyle({ minHeight: 60 });
    expect(view.getByTestId('sign-in-continue')).toHaveStyle({
      minHeight: minimumTouchTarget,
    });
  });
});
