import { createLocalMockFirebaseAuth } from './localMockFirebaseAuth';

describe('createLocalMockFirebaseAuth', () => {
  it('issues a stable mock ID token and never a backend public_id', async () => {
    const auth = createLocalMockFirebaseAuth();
    const first = await auth.signIn('User@example.com', 'password-one');
    expect(first.outcome).toBe('ok');
    if (first.outcome !== 'ok') {
      throw new Error('expected ok');
    }
    expect(first.session.credential).toBe('mock.user_example_com');
    expect(first.session.credential.startsWith('mock.')).toBe(true);
    expect(first.session.credential).not.toContain('usr_');

    await auth.signOut();
    expect(auth.getCredential()).toBeNull();

    const second = await auth.signIn('user@example.com', 'password-one');
    expect(second.outcome).toBe('ok');
    if (second.outcome !== 'ok') {
      throw new Error('expected ok');
    }
    expect(second.session.credential).toBe(first.session.credential);
  });
});
