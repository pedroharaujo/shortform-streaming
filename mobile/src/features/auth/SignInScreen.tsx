import type { JSX } from 'react';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MeClient } from '../../api/me/types';
import type { AppAuth, AuthOutcome, AuthUserSession } from '../../auth/localMockFirebaseAuth';
import { setAuthSession } from '../../auth/session';

export interface SignInScreenProps {
  readonly auth: AppAuth;
  readonly meClient: MeClient;
  readonly onFinished: () => void;
  readonly googleSignInAvailable?: boolean;
}

export function SignInScreen({
  auth,
  meClient,
  onFinished,
  googleSignInAvailable = Platform.OS === 'android',
}: SignInScreenProps): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function finishWithSession(session: AuthUserSession): Promise<void> {
    setAuthSession(session);
    const me = await meClient.getMe();
    setBusy(false);
    if (me.outcome === 'ok') {
      setMessage(`Signed in as ${me.data.public_id}`);
      onFinished();
      return;
    }
    if (me.outcome === 'unauthenticated') {
      setMessage(me.message);
      return;
    }
    if (me.outcome === 'error') {
      setMessage(me.message);
      return;
    }
    setMessage(me.reason);
  }

  async function applyAuthOutcome(outcome: AuthOutcome): Promise<void> {
    if (outcome.outcome === 'cancelled') {
      setBusy(false);
      return;
    }
    if (outcome.outcome === 'error') {
      setBusy(false);
      setMessage(outcome.message);
      return;
    }
    await finishWithSession(outcome.session);
  }

  async function complete(kind: 'signIn' | 'signUp'): Promise<void> {
    setBusy(true);
    setMessage(null);
    const outcome =
      kind === 'signUp' ? await auth.signUp(email, password) : await auth.signIn(email, password);
    await applyAuthOutcome(outcome);
  }

  async function completeGoogle(): Promise<void> {
    setBusy(true);
    setMessage(null);
    await applyAuthOutcome(await auth.signInWithGoogle());
  }

  async function signOut(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await auth.signOut();
    } finally {
      setAuthSession(null);
      setBusy(false);
      setMessage('Signed out');
    }
  }

  return (
    <SafeAreaView style={styles.container} testID="sign-in-screen">
      <Text accessibilityRole="header" style={styles.title}>
        Sign in
      </Text>
      <Text style={styles.muted}>
        Email and password through Firebase Authentication, or Google on Android. Catalog stays
        available without an account.
      </Text>
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#71717a"
        style={styles.input}
        testID="sign-in-email"
        value={email}
      />
      <TextInput
        autoComplete="password"
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#71717a"
        secureTextEntry
        style={styles.input}
        testID="sign-in-password"
        value={password}
      />
      {message !== null ? (
        <Text style={styles.body} testID="sign-in-message">
          {message}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel="Sign in"
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            void complete('signIn');
          }}
          style={styles.button}
          testID="sign-in-submit"
        >
          <Text style={styles.buttonLabel}>Sign in</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Create account"
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            void complete('signUp');
          }}
          style={styles.button}
          testID="sign-in-create"
        >
          <Text style={styles.buttonLabel}>Create account</Text>
        </Pressable>
        {googleSignInAvailable ? (
          <Pressable
            accessibilityLabel="Sign in with Google"
            accessibilityRole="button"
            disabled={busy}
            onPress={() => {
              void completeGoogle();
            }}
            style={styles.button}
            testID="sign-in-google"
          >
            <Text style={styles.buttonLabel}>Sign in with Google</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel="Sign out"
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            void signOut();
          }}
          style={styles.button}
          testID="sign-in-sign-out"
        >
          <Text style={styles.buttonLabel}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 12, marginTop: 16 },
  body: { color: '#fafafa', fontSize: 16, marginTop: 12 },
  button: {
    borderColor: '#3f3f46',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonLabel: { color: '#fafafa', fontSize: 16, textAlign: 'center' },
  container: { backgroundColor: '#09090b', flex: 1, padding: 24 },
  input: {
    borderColor: '#3f3f46',
    borderRadius: 8,
    borderWidth: 1,
    color: '#fafafa',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  muted: { color: '#a1a1aa', fontSize: 14, marginBottom: 8 },
  title: { color: '#fafafa', fontSize: 22, fontWeight: '600', marginBottom: 16 },
});
