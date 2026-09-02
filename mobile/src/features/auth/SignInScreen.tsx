import type { JSX } from 'react';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { useMessages } from '../../localization/messages';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';

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
  const messages = useMessages();
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
      setMessage(messages.auth.authenticationFailed);
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
      setMessage(messages.auth.signedInAs(me.data.public_id));
      onFinished();
      return;
    }
    setBusy(false);
    setMessage(
      me.outcome === 'unreachable' ? messages.auth.profileUnreachable : messages.auth.profileFailed,
    );
  }

  async function run(
    task: () => Promise<AuthOutcome>,
    event: AccountAuthenticationEvent,
    method: AccountAuthenticationMethod,
  ): Promise<void> {
    const attemptRevision = getAuthSessionRevision();
    if (attemptRevision !== sessionOwner.current) {
      setMessage(messages.auth.sessionChanged);
      return;
    }
    setBusy(true);
    setMessage(null);
    let outcome: AuthOutcome;
    try {
      outcome = await task();
    } catch {
      setBusy(false);
      setMessage(messages.auth.authenticationFailed);
      return;
    }
    await applyAuthOutcome(outcome, attemptRevision, event, method);
  }

  return (
    <SafeAreaView style={styles.container} testID="sign-in-screen">
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        testID="sign-in-scroll"
      >
        <Text accessibilityRole="header" style={styles.title}>
          {messages.auth.title}
        </Text>
        <Text style={styles.muted}>{messages.auth.description}</Text>
        <TextInput
          accessibilityLabel={messages.auth.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder={messages.auth.email}
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          testID="sign-in-email"
          value={email}
        />
        <TextInput
          accessibilityLabel={messages.auth.credential}
          autoComplete="password"
          onChangeText={setPassword}
          placeholder={messages.auth.credential}
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          style={styles.input}
          testID="sign-in-password"
          value={password}
        />
        {message !== null ? (
          <Text accessibilityLiveRegion="polite" style={styles.body} testID="sign-in-message">
            {message}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <ActionButton
            busy={busy}
            label={messages.common.signIn}
            onPress={() => void run(() => auth.signIn(email, password), 'login', 'password')}
            testID="sign-in-submit"
          />
          <ActionButton
            busy={busy}
            label={messages.auth.createAccount}
            onPress={() => void run(() => auth.signUp(email, password), 'sign_up', 'password')}
            testID="sign-in-create"
          />
          <ActionButton
            busy={busy}
            label={messages.auth.signInGoogle}
            onPress={() => void run(() => auth.signInWithGoogle(), 'login', 'google')}
            testID="sign-in-google"
          />
          <ActionButton
            busy={busy}
            label={messages.auth.signOut}
            onPress={() => {
              void (async () => {
                if (getAuthSessionRevision() !== sessionOwner.current) {
                  setMessage(messages.auth.sessionChanged);
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
                  setMessage(messages.auth.signedOut);
                }
              })();
            }}
            testID="sign-in-sign-out"
          />
        </View>
      </ScrollView>
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
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={[styles.button, busy && styles.disabled]}
      testID={testID}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md, marginTop: spacing.lg },
  body: { color: colors.foreground, fontSize: fontSizes.body, marginTop: spacing.md },
  button: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.xl,
  },
  buttonLabel: { color: colors.foreground, fontSize: fontSizes.body, textAlign: 'center' },
  container: { backgroundColor: colors.background, flex: 1 },
  content: { flexGrow: 1, padding: spacing.xxl },
  disabled: { opacity: 0.5 },
  input: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.foreground,
    marginTop: spacing.md,
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.md,
  },
  muted: { color: colors.muted, fontSize: fontSizes.label, marginBottom: spacing.sm },
  title: {
    color: colors.foreground,
    fontSize: fontSizes.title,
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
});
