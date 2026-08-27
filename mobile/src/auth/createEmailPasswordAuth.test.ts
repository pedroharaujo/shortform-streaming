import { createEmailPasswordAuth } from './createEmailPasswordAuth';

function nativeFirebaseModuleLoaded(): boolean {
  const cache = (require as unknown as { cache?: Record<string, unknown> }).cache;
  if (cache === undefined) {
    return false;
  }
  return Object.keys(cache).some((modulePath) => {
    const normalized = modulePath.replace(/\\/g, '/');
    return normalized.includes('/@react-native-firebase/');
  });
}

describe('createEmailPasswordAuth', () => {
  it('uses the local mock under Jest and never loads @react-native-firebase', async () => {
    expect(typeof process.env.JEST_WORKER_ID).toBe('string');
    expect(nativeFirebaseModuleLoaded()).toBe(false);

    const auth = createEmailPasswordAuth();
    const first = await auth.signIn('User@example.com', 'password-one');

    expect(first.outcome).toBe('ok');
    if (first.outcome !== 'ok') {
      throw new Error('expected ok');
    }
    expect(first.session.credential).toBe('mock.user_example_com');
    expect(first.session.credential.startsWith('mock.')).toBe(true);
    expect(first.session.credential).not.toContain('usr_');
    expect(nativeFirebaseModuleLoaded()).toBe(false);

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
