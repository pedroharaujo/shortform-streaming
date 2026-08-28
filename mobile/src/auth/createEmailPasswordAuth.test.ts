import { createEmailPasswordAuth } from './createEmailPasswordAuth';

describe('createEmailPasswordAuth', () => {
  it('uses the local mock in Jest and does not load native Firebase or Google Sign-In', () => {
    const auth = createEmailPasswordAuth();
    expect(typeof auth.signInWithGoogle).toBe('function');
    const moduleCache = (require as unknown as { readonly cache?: Record<string, unknown> }).cache;
    const loaded = Object.keys(moduleCache ?? {});
    expect(loaded.length).toBeGreaterThan(0);
    expect(loaded.some((p) => p.includes('@react-native-firebase'))).toBe(false);
    expect(loaded.some((p) => p.includes('@react-native-google-signin'))).toBe(false);
  });
});
