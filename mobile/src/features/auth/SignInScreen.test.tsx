import { render, userEvent, waitFor } from '@testing-library/react-native';

import type { MeClient } from '../../api/me/types';
import { createLocalMockFirebaseAuth } from '../../auth/localMockFirebaseAuth';
import { getSessionCredential, setAuthSession } from '../../auth/session';
import { SignInScreen } from './SignInScreen';

const PROFILE = {
  public_id: 'usr_from_server',
  created_at: '2026-08-25T00:00:00Z',
  updated_at: '2026-08-25T00:00:00Z',
};

function okMeClient(): { getMe: jest.Mock; meClient: MeClient } {
  const getMe = jest.fn(async () => ({ outcome: 'ok' as const, data: PROFILE }));
  return { getMe, meClient: { getMe } };
}

describe('SignInScreen', () => {
  afterEach(() => {
    setAuthSession(null);
  });

  it('signs in with email/password and loads /v1/me without sending a backend user id', async () => {
    const auth = createLocalMockFirebaseAuth();
    const { getMe, meClient } = okMeClient();
    const onFinished = jest.fn();
    const user = userEvent.setup();
    const view = await render(
      <SignInScreen auth={auth} meClient={meClient} onFinished={onFinished} />,
    );

    await user.type(view.getByTestId('sign-in-email'), 'user@example.com');
    await user.type(view.getByTestId('sign-in-password'), 'correct-horse');
    await user.press(view.getByTestId('sign-in-submit'));

    await waitFor(() => expect(getMe).toHaveBeenCalledTimes(1));
    expect(getSessionCredential()).toBe('mock.user_example_com');
    expect(getSessionCredential()).not.toContain('usr_from_server');
    expect(onFinished).toHaveBeenCalled();
  });

  it('signs out and clears the session credential', async () => {
    const auth = createLocalMockFirebaseAuth();
    await auth.signIn('user@example.com', 'correct-horse');
    setAuthSession({ credential: 'mock.user_example_com' });
    const user = userEvent.setup();
    const view = await render(
      <SignInScreen auth={auth} meClient={{ getMe: jest.fn() }} onFinished={jest.fn()} />,
    );
    await user.press(view.getByTestId('sign-in-sign-out'));

    await waitFor(() => expect(view.getByTestId('sign-in-message')).toBeTruthy());
    expect(getSessionCredential()).toBeNull();
    expect(auth.getCredential()).toBeNull();
  });

  it('signs in with Google, never offers Apple, and does not send a backend user id', async () => {
    const auth = createLocalMockFirebaseAuth();
    const { getMe, meClient } = okMeClient();
    const onFinished = jest.fn();
    const user = userEvent.setup();
    const view = await render(
      <SignInScreen auth={auth} meClient={meClient} onFinished={onFinished} />,
    );

    expect(view.queryByLabelText('Sign in with Apple')).toBeNull();
    await user.press(view.getByTestId('sign-in-google'));

    await waitFor(() => expect(getMe).toHaveBeenCalledTimes(1));
    expect(getSessionCredential()).toBe('mock.google_user');
    expect(getSessionCredential()).not.toContain('usr_from_server');
    expect(onFinished).toHaveBeenCalled();
  });

  it('treats Google Sign-In cancellation as a no-op', async () => {
    const auth = {
      ...createLocalMockFirebaseAuth(),
      signInWithGoogle: jest.fn(async () => ({ outcome: 'cancelled' as const })),
    };
    const getMe = jest.fn();
    const user = userEvent.setup();
    const view = await render(
      <SignInScreen auth={auth} meClient={{ getMe }} onFinished={jest.fn()} />,
    );

    await user.press(view.getByTestId('sign-in-google'));

    await waitFor(() => expect(view.getByTestId('sign-in-google')).toBeEnabled());
    expect(getMe).not.toHaveBeenCalled();
    expect(getSessionCredential()).toBeNull();
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
    const user = userEvent.setup();
    const view = await render(
      <SignInScreen auth={auth} meClient={{ getMe }} onFinished={jest.fn()} />,
    );

    await user.press(view.getByTestId('sign-in-google'));

    await waitFor(() => expect(view.getByTestId('sign-in-message')).toBeTruthy());
    expect(view.getByTestId('sign-in-message')).toHaveTextContent(
      'Google Play services are not available.',
    );
    expect(getMe).not.toHaveBeenCalled();
    expect(getSessionCredential()).toBeNull();
  });
});
