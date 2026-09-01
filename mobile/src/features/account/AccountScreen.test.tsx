import { act, fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';

import { createAccountClient } from '../../api/account/accountClient';
import { jsonResponse } from '../../api/fetchTestUtils';
import type { AnalyticsConsentController } from '../../analytics/consentController';
import type { AuthOutcome } from '../../auth/localMockFirebaseAuth';
import { createLocalMockFirebaseAuth } from '../../auth/localMockFirebaseAuth';
import { getSessionCredential, setAuthSession } from '../../auth/session';
import { AccountScreen } from './AccountScreen';

const mockDeleteSecureItem = jest.fn(async (_key: string) => {});

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: (key: string) => mockDeleteSecureItem(key),
}));

const PROFILE = {
  public_id: 'usr_synthetic',
  created_at: '2026-08-31T00:00:00Z',
  updated_at: '2026-08-31T00:00:00Z',
  locale: 'en',
  country: '',
  analytics_consent: false,
  ads_consent: false,
  consent_updated_at: null,
};

async function setup(writeResponse = jsonResponse(PROFILE, 200)) {
  setAuthSession({ credential: 'mock.synthetic_account' });
  const requests: Request[] = [];
  const fetchImplementation = jest.fn(async (input: RequestInfo | URL) => {
    const request = input as Request;
    requests.push(request.clone());
    return request.method === 'GET' ? jsonResponse(PROFILE, 200) : writeResponse;
  });
  const auth = {
    ...createLocalMockFirebaseAuth(),
    reauthenticate: jest.fn<
      Promise<AuthOutcome>,
      Parameters<ReturnType<typeof createLocalMockFirebaseAuth>['reauthenticate']>
    >(async () => ({
      outcome: 'ok',
      session: { credential: 'mock.reauthenticated_account' },
    })),
    signOut: jest.fn(async () => {}),
  };
  const analyticsConsent: jest.Mocked<AnalyticsConsentController> = {
    applyProfile: jest.fn<
      ReturnType<AnalyticsConsentController['applyProfile']>,
      Parameters<AnalyticsConsentController['applyProfile']>
    >(async () => true),
    clear: jest.fn(async () => true),
  };
  const client = createAccountClient({
    baseUrl: 'https://api.example.test',
    getCredential: getSessionCredential,
    fetchImplementation,
  });
  const view = await render(
    <AccountScreen
      auth={auth}
      analyticsConsent={analyticsConsent}
      client={client}
      onSignIn={jest.fn()}
      onHome={jest.fn()}
    />,
  );
  await waitFor(() => expect(view.getByLabelText('Save preferences')).toBeEnabled());
  return { view, analyticsConsent, auth, fetchImplementation, requests, user: userEvent.setup() };
}

afterEach(() => setAuthSession(null));

it('loads consent as off and writes only explicit preferences with the authenticated session', async () => {
  const saved = { ...PROFILE, country: 'FR', analytics_consent: true };
  const { view, analyticsConsent, user, requests } = await setup(jsonResponse(saved, 200));
  expect(analyticsConsent.applyProfile).toHaveBeenCalledWith(
    expect.objectContaining({ profileId: 'usr_synthetic', analyticsConsent: false }),
  );
  expect(view.getByLabelText('Analytics consent')).toHaveProp('value', false);
  expect(view.getByLabelText('Ads consent')).toHaveProp('value', false);
  await user.type(view.getByLabelText('Country code'), 'fr');
  await fireEvent(view.getByLabelText('Analytics consent'), 'valueChange', true);
  await user.press(view.getByLabelText('Save preferences'));
  await waitFor(() =>
    expect(view.getByTestId('account-message')).toHaveTextContent('Preferences saved.'),
  );
  expect(requests).toHaveLength(2);
  expect(requests[1]?.method).toBe('PATCH');
  expect(requests[1]?.headers.get('Authorization')).toBe('Bearer mock.synthetic_account');
  expect(await requests[1]?.json()).toEqual({
    locale: 'en',
    country: 'FR',
    analytics_consent: true,
    ads_consent: false,
  });
  expect(analyticsConsent.applyProfile).toHaveBeenLastCalledWith(
    expect.objectContaining({ profileId: 'usr_synthetic', analyticsConsent: true }),
  );
});

it('keeps unsaved preferences after a failed save and permits retry', async () => {
  const { view, user } = await setup(
    jsonResponse({ code: 'unavailable', message: 'Unavailable' }, 503),
  );
  await fireEvent(view.getByLabelText('Ads consent'), 'valueChange', true);
  await user.press(view.getByLabelText('Save preferences'));
  await waitFor(() =>
    expect(view.getByTestId('account-message')).toHaveTextContent(/could not be completed/),
  );
  expect(view.getByLabelText('Ads consent')).toHaveProp('value', true);
  expect(view.getByLabelText('Save preferences')).toBeEnabled();
  expect(getSessionCredential()).toBe('mock.synthetic_account');
});

it('shows the export placeholder without claiming a request was accepted', async () => {
  const { view, user } = await setup(
    jsonResponse({ code: 'export_unavailable', message: 'Unavailable' }, 501),
  );
  await user.press(view.getByLabelText('Request account export'));
  await waitFor(() =>
    expect(view.getByTestId('account-message')).toHaveTextContent(/No export has been requested/),
  );
});

it.each(['pending', 'completed'])(
  'reauthenticates before deletion and clears both sessions when %s',
  async (status) => {
    const { view, analyticsConsent, user, auth, requests } = await setup(
      jsonResponse({ public_id: 'del_synthetic', status }, 202),
    );
    expect(view.queryByLabelText('Verify password and delete account')).toBeNull();
    await user.press(view.getByLabelText('Delete account'));
    expect(requests).toHaveLength(1);
    await user.type(view.getByLabelText('Current password'), 'replace-with-provider-value');
    await user.press(view.getByLabelText('Verify password and delete account'));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
    expect(auth.reauthenticate).toHaveBeenCalledWith({
      provider: 'password',
      password: 'replace-with-provider-value',
    });
    expect(requests[1]?.url).toBe('https://api.example.test/v1/me/deletion');
    expect(requests[1]?.headers.get('Authorization')).toBe('Bearer mock.reauthenticated_account');
    expect(await requests[1]?.json()).toEqual({ confirmation: true });
    expect(getSessionCredential()).toBeNull();
    expect(analyticsConsent.clear).toHaveBeenCalledTimes(1);
    expect(mockDeleteSecureItem).toHaveBeenCalledWith('shortform.pending_reward_attempt.v1');
    expect(view.queryByLabelText('Current password')).toBeNull();
    expect(view.queryByLabelText('Save preferences')).toBeNull();
    expect(view.getByTestId('account-message')).toHaveTextContent(
      status === 'pending' ? /cleanup is pending/ : /account has been deleted/,
    );
  },
);

it.each(['cancelled', 'error'] as const)(
  'sends no deletion request when Google verification is %s',
  async (outcome) => {
    const { view, user, auth, requests } = await setup();
    auth.reauthenticate.mockResolvedValue(
      outcome === 'cancelled' ? { outcome } : { outcome, message: 'Account verification failed.' },
    );
    await user.press(view.getByLabelText('Delete account'));
    await user.press(view.getByLabelText('Verify Google and delete account'));
    await waitFor(() => expect(view.getByTestId('account-message')).toBeTruthy());
    expect(requests).toHaveLength(1);
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(getSessionCredential()).toBe('mock.synthetic_account');
    expect(view.getByLabelText('Verify Google and delete account')).toBeEnabled();
  },
);

it('keeps the account signed in and asks for new verification after the server rejects stale auth', async () => {
  const { view, user, auth } = await setup(
    jsonResponse({ code: 'reauthentication_required', message: 'Reauthenticate' }, 403),
  );
  await user.press(view.getByLabelText('Delete account'));
  await user.press(view.getByLabelText('Verify Google and delete account'));
  await waitFor(() =>
    expect(view.getByTestId('account-message')).toHaveTextContent(/Verification expired/),
  );
  expect(auth.signOut).not.toHaveBeenCalled();
  expect(getSessionCredential()).toBe('mock.reauthenticated_account');
  expect(view.getByLabelText('Verify Google and delete account')).toBeEnabled();
});

it('warns that deletion may have succeeded when its response is lost', async () => {
  const { view, user, auth, fetchImplementation } = await setup();
  fetchImplementation.mockRejectedValueOnce(new TypeError('Synthetic network failure'));
  await user.press(view.getByLabelText('Delete account'));
  await user.press(view.getByLabelText('Verify Google and delete account'));
  await waitFor(() =>
    expect(view.getByTestId('account-message')).toHaveTextContent(
      'The response was lost. Your deletion request may already have been accepted. Signing in cannot verify deletion. Contact support to verify completion.',
    ),
  );
  expect(auth.signOut).not.toHaveBeenCalled();
});

it.each([202, 401])(
  'does not sign out a replacement session after a delayed deletion response (%s)',
  async (status) => {
    const { view, user, auth, fetchImplementation } = await setup();
    let resolveResponse!: (response: Response) => void;
    fetchImplementation.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve;
        }),
    );
    await user.press(view.getByLabelText('Delete account'));
    await user.press(view.getByLabelText('Verify Google and delete account'));
    await waitFor(() => expect(fetchImplementation).toHaveBeenCalledTimes(2));
    await view.unmount();
    setAuthSession({ credential: 'mock.replacement_account' });
    await act(async () => {
      resolveResponse(
        jsonResponse(
          status === 202
            ? { public_id: 'del_synthetic', status: 'completed' }
            : { code: 'invalid_token', message: 'Invalid' },
          status,
        ),
      );
    });
    expect(getSessionCredential()).toBe('mock.replacement_account');
    expect(auth.signOut).not.toHaveBeenCalled();
  },
);

it('does not apply late reauthentication to a replacement session or send deletion', async () => {
  const { view, user, auth, fetchImplementation } = await setup();
  let resolveVerification!: (outcome: AuthOutcome) => void;
  auth.reauthenticate.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveVerification = resolve;
      }),
  );
  await user.press(view.getByLabelText('Delete account'));
  await user.press(view.getByLabelText('Verify Google and delete account'));
  await view.unmount();
  setAuthSession({ credential: 'mock.replacement_account' });
  await act(async () => {
    resolveVerification({ outcome: 'ok', session: { credential: 'mock.original_account' } });
  });
  expect(getSessionCredential()).toBe('mock.replacement_account');
  expect(fetchImplementation).toHaveBeenCalledTimes(1);
  expect(auth.signOut).not.toHaveBeenCalled();
});

it('clears an invalid session on profile load and never offers account mutations', async () => {
  setAuthSession({ credential: 'mock.invalid_session' });
  const auth = { ...createLocalMockFirebaseAuth(), signOut: jest.fn(async () => {}) };
  const analyticsConsent: AnalyticsConsentController = {
    applyProfile: jest.fn(async () => true),
    clear: jest.fn(async () => true),
  };
  const client = createAccountClient({
    baseUrl: 'https://api.example.test',
    getCredential: getSessionCredential,
    fetchImplementation: async () =>
      jsonResponse({ code: 'invalid_token', message: 'Invalid' }, 401),
  });
  const view = await render(
    <AccountScreen
      auth={auth}
      analyticsConsent={analyticsConsent}
      client={client}
      onSignIn={jest.fn()}
      onHome={jest.fn()}
    />,
  );
  await waitFor(() => expect(view.getByLabelText('Sign in')).toBeEnabled());
  expect(auth.signOut).toHaveBeenCalledTimes(1);
  expect(getSessionCredential()).toBeNull();
  expect(view.queryByLabelText('Delete account')).toBeNull();
});

it('ignores an old profile-load rejection after the session changes', async () => {
  setAuthSession({ credential: 'mock.original_account' });
  let resolveResponse!: (response: Response) => void;
  const auth = { ...createLocalMockFirebaseAuth(), signOut: jest.fn(async () => {}) };
  const analyticsConsent: AnalyticsConsentController = {
    applyProfile: jest.fn(async () => true),
    clear: jest.fn(async () => true),
  };
  const client = createAccountClient({
    baseUrl: 'https://api.example.test',
    getCredential: getSessionCredential,
    fetchImplementation: () =>
      new Promise((resolve) => {
        resolveResponse = resolve;
      }),
  });
  const view = await render(
    <AccountScreen
      auth={auth}
      analyticsConsent={analyticsConsent}
      client={client}
      onSignIn={jest.fn()}
      onHome={jest.fn()}
    />,
  );
  setAuthSession({ credential: 'mock.replacement_account' });
  await act(async () => {
    resolveResponse(jsonResponse({ code: 'invalid_token', message: 'Invalid' }, 401));
  });
  expect(getSessionCredential()).toBe('mock.replacement_account');
  expect(auth.signOut).not.toHaveBeenCalled();
  expect(view.queryByLabelText('Delete account')).toBeNull();
  expect(view.getByTestId('account-message')).toHaveTextContent(/session changed/);
});

it('allows only one verification and deletion request during duplicate taps', async () => {
  const { view, user, auth, requests } = await setup(
    jsonResponse({ public_id: 'del_synthetic', status: 'pending' }, 202),
  );
  let resolveVerification!: (outcome: AuthOutcome) => void;
  auth.reauthenticate.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveVerification = resolve;
      }),
  );
  await user.press(view.getByLabelText('Delete account'));
  const button = view.getByLabelText('Verify Google and delete account');
  await user.press(button);
  await user.press(button);
  expect(auth.reauthenticate).toHaveBeenCalledTimes(1);
  expect(requests).toHaveLength(1);
  await act(() =>
    resolveVerification({ outcome: 'ok', session: { credential: 'mock.reauthenticated_account' } }),
  );
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
  expect(requests).toHaveLength(2);
});

it('clears stale credentials when an authenticated action returns 401', async () => {
  const { view, user, auth } = await setup(
    jsonResponse({ code: 'invalid_token', message: 'Invalid' }, 401),
  );
  await user.press(view.getByLabelText('Save preferences'));
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
  expect(getSessionCredential()).toBeNull();
  expect(view.getByTestId('account-message')).toHaveTextContent(/Sign in again/);
});

it('clears analytics and the app session on logout failure, then offers native retry', async () => {
  const { view, analyticsConsent, user, auth } = await setup();
  auth.signOut.mockRejectedValueOnce(new Error('Synthetic native failure'));
  await user.press(view.getByLabelText('Sign out'));
  await waitFor(() => expect(view.getByLabelText('Retry device sign-out')).toBeEnabled());
  expect(getSessionCredential()).toBeNull();
  expect(analyticsConsent.clear).toHaveBeenCalledTimes(1);
  expect(view.queryByLabelText('Save preferences')).toBeNull();
  await user.press(view.getByLabelText('Retry device sign-out'));
  await waitFor(() => expect(view.queryByLabelText('Retry device sign-out')).toBeNull());
  expect(auth.signOut).toHaveBeenCalledTimes(2);
});

it('does not sign out a replacement session while analytics cleanup is pending', async () => {
  const { view, analyticsConsent, user, auth } = await setup();
  mockDeleteSecureItem.mockClear();
  let resolveClear!: (value: boolean) => void;
  analyticsConsent.clear.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveClear = resolve;
      }),
  );

  await user.press(view.getByLabelText('Sign out'));
  await waitFor(() => expect(analyticsConsent.clear).toHaveBeenCalledTimes(1));
  setAuthSession({ credential: 'mock.replacement_account' });
  await act(async () => resolveClear(true));

  await waitFor(() =>
    expect(view.getByTestId('account-message')).toHaveTextContent(/session changed/),
  );
  expect(auth.signOut).not.toHaveBeenCalled();
  expect(mockDeleteSecureItem).not.toHaveBeenCalled();
  expect(getSessionCredential()).toBe('mock.replacement_account');
});
