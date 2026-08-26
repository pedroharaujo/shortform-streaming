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
    const outcome = await auth.signIn('user@example.com', 'password-one');

    expect(outcome.outcome).toBe('ok');
    if (outcome.outcome !== 'ok') {
      throw new Error('expected ok');
    }
    expect(outcome.session.credential).toBe('mock.user_example_com');
    expect(nativeFirebaseModuleLoaded()).toBe(false);
  });
});
