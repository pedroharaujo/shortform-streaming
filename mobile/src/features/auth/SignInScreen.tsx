import type { JSX } from 'react';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MeClient } from '../../api/me/types';
import type {
  AccountAnalytics,
  AccountAuthenticationEvent,
  AccountAuthenticationMethod,
} from '../../analytics/accountAnalytics';
import type { AnalyticsConsentController } from '../../analytics/consentController';
import type { AppAuth, AuthOutcome } from '../../auth/localMockFirebaseAuth';
import { getAuthSessionRevision, setAuthSession } from '../../auth/session';

export interface SignInScreenProps {
  readonly auth: AppAuth;
  readonly analytics: AccountAnalytics;
  readonly analyticsConsent: AnalyticsConsentController;
  readonly meClient: MeClient;
  readonly onFinished: () => void;
}

export function SignInScreen({
  auth,
  analytics,
  analyticsConsent,
  meClient,
  onFinished,
}: SignInScreenProps): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sessionOwner = useRef(getAuthSessionRevision());

  async function applyAuthOutcome(
    outcome: AuthOutcome,
    attemptRevision: number,
    event: AccountAuthenticationEvent,
    method: AccountAuthenticationMethod,
  ): Promise<void> {
    if (outcome.outcome === 'cancelled') {
      setBusy(false);
      return;
    }
    if (outcome.outcome === 'error') {
      setBusy(false);
      setMessage(outcome.message);
      return;
    }
    if (getAuthSessionRevision() !== attemptRevision) {
      setBusy(false);
      return;
    }
    await analyticsConsent.clear();
    if (getAuthSessionRevision() !== attemptRevision) {
      setBusy(false);
      return;
    }
    setAuthSession(outcome.session);
    const sessionRevision = getAuthSessionRevision();
    sessionOwner.current = sessionRevision;
    const me = await meClient.getMe();
    if (getAuthSessionRevision() !== sessionRevision) {
      setBusy(false);
      return;
    }
    if (me.outcome === 'ok') {
      await analyticsConsent.applyProfile({
        profileId: me.data.public_id,
        analyticsConsent: me.data.analytics_consent,
        sessionRevision,
      });
      if (getAuthSessionRevision() !== sessionRevision) {
        setBusy(false);
        return;
      }
      void analytics.recordAuthentication(outcome.accountEvent ?? event, method, sessionRevision);
      setBusy(false);
      setMessage(`Signed in as ${me.data.public_id}`);
      onFinished();
      return;
    }
    setBusy(false);
    setMessage(me.outcome === 'unreachable' ? me.reason : me.message);
  }

  async function run(
    task: () => Promise<AuthOutcome>,
    event: AccountAuthenticationEvent,
    method: AccountAuthenticationMethod,
  ): Promise<void> {
    const attemptRevision = getAuthSessionRevision();
    if (attemptRevision !== sessionOwner.current) {
      setMessage('Your session changed. Reopen Sign in before continuing.');
      return;
    }
    setBusy(true);
    setMessage(null);
    await applyAuthOutcome(await task(), attemptRevision, event, method);
  }

  return (
    <SafeAreaView style={styles.container} testID="sign-in-screen">
      <Text accessibilityRole="header" style={styles.title}>
        Sign in
      </Text>
      <Text style={styles.muted}>
        Email and password, or Google Sign-In, through Firebase Authentication. Catalog stays
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
        <ActionButton
          busy={busy}
          label="Sign in"
          onPress={() => void run(() => auth.signIn(email, password), 'login', 'password')}
          testID="sign-in-submit"
        />
        <ActionButton
          busy={busy}
          label="Create account"
          onPress={() => void run(() => auth.signUp(email, password), 'sign_up', 'password')}
          testID="sign-in-create"
        />
        <ActionButton
          busy={busy}
          label="Sign in with Google"
          onPress={() => void run(() => auth.signInWithGoogle(), 'login', 'google')}
          testID="sign-in-google"
        />
        <ActionButton
          busy={busy}
          label="Sign out"
          onPress={() => {
            void (async () => {
              if (getAuthSessionRevision() !== sessionOwner.current) {
                setMessage('Your session changed. Reopen Sign in before continuing.');
                return;
              }
              setBusy(true);
              setMessage(null);
              setAuthSession(null);
              const signingOutRevision = getAuthSessionRevision();
              sessionOwner.current = signingOutRevision;
              await analyticsConsent.clear();
              if (getAuthSessionRevision() !== signingOutRevision) {
                setBusy(false);
                return;
              }
              try {
                await auth.signOut();
              } finally {
                setBusy(false);
                setMessage('Signed out');
              }
            })();
          }}
          testID="sign-in-sign-out"
        />
      </View>
    </SafeAreaView>
  );
}

function ActionButton({
  busy,
  label,
  onPress,
  testID,
}: {
  readonly busy: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
}): JSX.Element {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={styles.button}
      testID={testID}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
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
