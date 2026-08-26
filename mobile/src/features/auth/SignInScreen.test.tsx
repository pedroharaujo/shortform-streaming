import { render, userEvent, waitFor } from '@testing-library/react-native';

import type { MeClient } from '../../api/me/types';
import { createLocalMockFirebaseAuth } from '../../auth/localMockFirebaseAuth';
import { getSessionCredential, setAuthSession } from '../../auth/session';
import { SignInScreen } from './SignInScreen';

describe('SignInScreen', () => {
  afterEach(() => {
    setAuthSession(null);
  });

  it('signs in with email/password and loads /v1/me without sending a backend user id', async () => {
    const auth = createLocalMockFirebaseAuth();
    const getMe = jest.fn(async () => ({
      outcome: 'ok' as const,
      data: {
        public_id: 'usr_from_server',
        created_at: '2026-08-25T00:00:00Z',
        updated_at: '2026-08-25T00:00:00Z',
      },
    }));
    const meClient: MeClient = { getMe };
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
});
