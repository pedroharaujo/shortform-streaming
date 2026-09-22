import type { JSX } from 'react';
import { useRef, useState, useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MeClient } from '../../api/me/types';
import type {
  AccountAnalytics,
  AccountAuthenticationEvent,
  AccountAuthenticationMethod,
} from '../../analytics/accountAnalytics';
import type { AnalyticsConsentController } from '../../analytics/consentController';
import type { AppAuth, AuthOutcome } from '../../auth/localMockFirebaseAuth';
import {
  getAuthSession,
  getAuthSessionRevision,
  setAuthSession,
  subscribeAuthSession,
} from '../../auth/session';
import { useMessages } from '../../localization/messages';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';
import { ActionButton, BackButton, ScreenIntro } from '../../ui/ScreenElements';
import { useKeyboardScroll } from '../../ui/useKeyboardScroll';

export interface SignInScreenProps {
  readonly auth: AppAuth;
  readonly analytics: AccountAnalytics;
  readonly analyticsConsent: AnalyticsConsentController;
  readonly meClient: MeClient;
  readonly onFinished: () => void;
  readonly onBack?: () => void;
}

export function SignInScreen({
  auth,
  analytics,
  analyticsConsent,
  meClient,
  onFinished,
  onBack,
}: SignInScreenProps): JSX.Element {
  const messages = useMessages();
  const session = useSyncExternalStore(subscribeAuthSession, getAuthSession);
  const { scrollRef, revealField, onFieldFocus, onFieldBlur } = useKeyboardScroll();
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
        ref={scrollRef}
        onLayout={revealField}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        testID="sign-in-scroll"
      >
        {onBack ? (
          <BackButton label={messages.common.back} onPress={onBack} disabled={busy} />
        ) : null}
        <ScreenIntro title={messages.auth.title} subtitle={messages.auth.description} />
        <View style={styles.form}>
          <Text style={styles.fieldLabel}>{messages.auth.email}</Text>
          <TextInput
            accessibilityLabel={messages.auth.email}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            onFocus={onFieldFocus}
            onBlur={onFieldBlur}
            placeholder={messages.auth.email}
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            testID="sign-in-email"
            value={email}
          />
          <Text style={styles.fieldLabel}>{messages.auth.credential}</Text>
          <TextInput
            accessibilityLabel={messages.auth.credential}
            autoComplete="password"
            onChangeText={setPassword}
            onFocus={onFieldFocus}
            onBlur={onFieldBlur}
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
              disabled={busy}
              tone="primary"
              label={messages.common.signIn}
              onPress={() => void run(() => auth.signIn(email, password), 'login', 'password')}
              testID="sign-in-submit"
            />
            <ActionButton
              disabled={busy}
              label={messages.auth.createAccount}
              onPress={() => void run(() => auth.signUp(email, password), 'sign_up', 'password')}
              testID="sign-in-create"
            />
            <ActionButton
              disabled={busy}
              label={messages.auth.signInGoogle}
              onPress={() => void run(() => auth.signInWithGoogle(), 'login', 'google')}
              testID="sign-in-google"
            />
            {session !== null ? (
              <ActionButton
                disabled={busy}
                tone="quiet"
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
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  actions: { gap: spacing.md, marginTop: spacing.lg },
  body: { color: colors.foreground, fontSize: fontSizes.body, marginTop: spacing.md },
  container: { backgroundColor: colors.background, flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  fieldLabel: { color: colors.foreground, fontSize: fontSizes.label, fontWeight: '600' },
  input: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.foreground,
    backgroundColor: colors.surfaceRaised,
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSizes.body,
  },
});
