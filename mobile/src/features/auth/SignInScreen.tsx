import type { JSX } from 'react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Animated,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Film from 'lucide-react-native/icons/film';

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
import { ActionButton, BackButton } from '../../ui/ScreenElements';
import { GoogleSignInButton } from '../../ui/GoogleSignInButton';

export interface SignInScreenProps {
  readonly auth: AppAuth;
  readonly analytics: AccountAnalytics;
  readonly analyticsConsent: AnalyticsConsentController;
  readonly meClient: MeClient;
  readonly onFinished: () => void;
  readonly onBack?: (() => void) | undefined;
}

type Step = 'welcome' | 'email' | 'password';
type Mode = 'sign_up' | 'login';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CREDENTIAL_AUTOFILL = {
  signUp: { autoComplete: 'password-new', textContentType: 'newPassword' },
  signIn: { autoComplete: 'password', textContentType: 'password' },
} as const;

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
  const [step, setStep] = useState<Step>('welcome');
  const [mode, setMode] = useState<Mode>('sign_up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sessionOwner = useRef(getAuthSessionRevision());
  const [entrance] = useState(() => new Animated.Value(1));

  useEffect(() => {
    entrance.setValue(0);
    Animated.timing(entrance, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [entrance, step]);

  function goTo(next: Step): void {
    setMessage(null);
    setStep(next);
  }

  function goBack(): void {
    if (busy) {
      return;
    }
    goTo(step === 'password' ? 'email' : 'welcome');
  }

  useEffect(() => {
    if (step === 'welcome') {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  });

  async function applyAuthOutcome(
    outcome: AuthOutcome,
    attemptRevision: number,
    event: AccountAuthenticationEvent,
    method: AccountAuthenticationMethod,
    failure: string,
  ): Promise<void> {
    if (outcome.outcome === 'cancelled') {
      setBusy(false);
      return;
    }
    if (outcome.outcome === 'error') {
      setBusy(false);
      setMessage(failure);
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
    // The account request will only leave the device once this session matches
    // the signed-in Firebase user. Roll it back if the profile does not load.
    setAuthSession(outcome.session);
    const sessionRevision = getAuthSessionRevision();
    sessionOwner.current = sessionRevision;
    const me = await meClient.getMe(outcome.session.credential);
    if (getAuthSessionRevision() !== sessionRevision) {
      setBusy(false);
      return;
    }
    if (me.outcome !== 'ok') {
      setAuthSession(null);
      const clearedRevision = getAuthSessionRevision();
      sessionOwner.current = clearedRevision;
      try {
        await auth.signOut();
      } catch {
        // The account was not stored. Leave the failure on screen.
      }
      if (getAuthSessionRevision() !== clearedRevision) {
        setBusy(false);
        return;
      }
      setBusy(false);
      setMessage(
        me.outcome === 'unreachable'
          ? messages.auth.profileUnreachable
          : messages.auth.profileFailed,
      );
      return;
    }
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
  }

  async function run(
    task: () => Promise<AuthOutcome>,
    event: AccountAuthenticationEvent,
    method: AccountAuthenticationMethod,
    failure: string,
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
      setMessage(failure);
      return;
    }
    await applyAuthOutcome(outcome, attemptRevision, event, method, failure);
  }

  function signInWithGoogle(): void {
    void run(() => auth.signInWithGoogle(), 'login', 'google', messages.auth.authenticationFailed);
  }

  function continueWithEmail(): void {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setMessage(messages.auth.invalidEmail);
      return;
    }
    goTo('password');
  }

  function submitPassword(): void {
    const address = email.trim();
    if (mode === 'sign_up') {
      void run(
        () => auth.signUp(address, password),
        'sign_up',
        'password',
        messages.auth.signUpFailed,
      );
      return;
    }
    void run(() => auth.signIn(address, password), 'login', 'password', messages.auth.loginFailed);
  }

  function signOut(): void {
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
  }

  const animatedStyle = {
    opacity: entrance,
    transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };

  const feedback =
    message !== null ? (
      <Text accessibilityLiveRegion="polite" style={styles.message} testID="sign-in-message">
        {message}
      </Text>
    ) : null;

  if (step === 'welcome') {
    return (
      <SafeAreaView style={styles.container} testID="sign-in-screen">
        <View style={styles.keyLight} pointerEvents="none" />
        <ScrollView
          contentContainerStyle={styles.welcomeContent}
          keyboardShouldPersistTaps="handled"
          testID="sign-in-scroll"
        >
          {onBack ? (
            <BackButton label={messages.common.back} onPress={onBack} disabled={busy} />
          ) : null}
          <Animated.View style={[styles.hero, animatedStyle]}>
            <View style={styles.logoTile} accessible={false}>
              <Film color={colors.foreground} size={44} strokeWidth={2} />
            </View>
            <Text
              accessibilityRole="header"
              accessibilityLabel={messages.catalog.brand}
              style={styles.wordmark}
            >
              {messages.catalog.brand.toUpperCase()}
            </Text>
            <Text style={styles.tagline}>{messages.auth.tagline}</Text>
          </Animated.View>
          <View style={styles.welcomeActions}>
            {feedback}
            <ActionButton
              disabled={busy}
              tone="primary"
              label={messages.auth.createAccount}
              onPress={() => {
                setMode('sign_up');
                goTo('email');
              }}
              testID="sign-in-start-create"
            />
            <ActionButton
              disabled={busy}
              label={messages.auth.haveAccount}
              onPress={() => {
                setMode('login');
                goTo('email');
              }}
              testID="sign-in-start-login"
            />
            <View style={styles.divider} accessible={false}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>{messages.auth.or}</Text>
              <View style={styles.dividerLine} />
            </View>
            <GoogleSignInButton
              disabled={busy}
              label={messages.auth.signInGoogle}
              onPress={signInWithGoogle}
              testID="sign-in-google"
            />
            {session !== null ? (
              <ActionButton
                disabled={busy}
                tone="quiet"
                label={messages.auth.signOut}
                onPress={signOut}
                testID="sign-in-sign-out"
              />
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const signingUp = mode === 'sign_up';
  const onEmailStep = step === 'email';
  const title = onEmailStep
    ? signingUp
      ? messages.auth.emailTitleSignUp
      : messages.auth.emailTitleLogin
    : signingUp
      ? messages.auth.credentialTitleSignUp
      : messages.auth.credentialTitleLogin;
  const primaryLabel = onEmailStep
    ? messages.auth.continue
    : signingUp
      ? messages.auth.createAccount
      : messages.common.signIn;

  return (
    <SafeAreaView style={styles.container} testID="sign-in-screen">
      <View style={styles.keyLight} pointerEvents="none" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.stepContent}
          keyboardShouldPersistTaps="handled"
          testID="sign-in-scroll"
        >
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={messages.common.back}
              disabled={busy}
              hitSlop={8}
              onPress={goBack}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              testID="sign-in-back"
            >
              <ChevronLeft color={colors.foreground} size={26} />
            </Pressable>
            <View
              accessible
              accessibilityLabel={messages.auth.step(onEmailStep ? 1 : 2, 2)}
              style={styles.progress}
            >
              <View style={[styles.progressBar, styles.progressActive]} />
              <View style={[styles.progressBar, !onEmailStep && styles.progressActive]} />
            </View>
            <View style={styles.iconButton} />
          </View>

          <Animated.View style={[styles.stepBody, animatedStyle]}>
            <Text style={styles.stepLabel}>
              {messages.auth.step(onEmailStep ? 1 : 2, 2).toUpperCase()}
            </Text>
            <Text accessibilityRole="header" style={styles.stepTitle}>
              {title}
            </Text>
            {onEmailStep ? (
              <>
                <Text style={styles.stepHint}>
                  {signingUp ? messages.auth.emailHintSignUp : messages.auth.emailHintLogin}
                </Text>
                <TextInput
                  accessibilityLabel={messages.auth.email}
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  autoFocus
                  inputMode="email"
                  keyboardType="email-address"
                  onChangeText={(value) => {
                    setEmail(value);
                    setMessage(null);
                  }}
                  onSubmitEditing={continueWithEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.placeholder}
                  returnKeyType="next"
                  selectionColor={colors.brand}
                  style={styles.input}
                  testID="sign-in-email"
                  textContentType="emailAddress"
                  value={email}
                />
              </>
            ) : (
              <>
                <View style={styles.emailChip}>
                  <Text numberOfLines={1} style={styles.emailChipText}>
                    {email.trim()}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={messages.auth.changeEmail}
                    disabled={busy}
                    hitSlop={8}
                    onPress={() => goTo('email')}
                  >
                    <Text style={styles.emailChipAction}>{messages.auth.changeEmail}</Text>
                  </Pressable>
                </View>
                <View style={styles.passwordField}>
                  <TextInput
                    accessibilityLabel={messages.auth.credential}
                    autoCapitalize="none"
                    {...CREDENTIAL_AUTOFILL[signingUp ? 'signUp' : 'signIn']}
                    autoCorrect={false}
                    autoFocus
                    onChangeText={(value) => {
                      setPassword(value);
                      setMessage(null);
                    }}
                    onSubmitEditing={submitPassword}
                    placeholder={messages.auth.credential}
                    placeholderTextColor={colors.placeholder}
                    returnKeyType="done"
                    secureTextEntry={!passwordVisible}
                    selectionColor={colors.brand}
                    style={[styles.input, styles.passwordInput]}
                    testID="sign-in-password"
                    value={password}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      passwordVisible ? messages.auth.hideCredential : messages.auth.showCredential
                    }
                    hitSlop={8}
                    onPress={() => setPasswordVisible((visible) => !visible)}
                    style={styles.reveal}
                  >
                    {passwordVisible ? (
                      <EyeOff color={colors.muted} size={22} />
                    ) : (
                      <Eye color={colors.muted} size={22} />
                    )}
                  </Pressable>
                </View>
                {signingUp ? (
                  <Text style={styles.stepHint}>{messages.auth.credentialHintSignUp}</Text>
                ) : null}
              </>
            )}
            {feedback}
          </Animated.View>

          <View style={styles.stepFooter}>
            <ActionButton
              disabled={busy || (onEmailStep ? email.trim() === '' : password === '')}
              tone="primary"
              label={primaryLabel}
              onPress={onEmailStep ? continueWithEmail : submitPassword}
              testID={onEmailStep ? 'sign-in-continue' : 'sign-in-submit'}
            />
            <ActionButton
              disabled={busy}
              tone="quiet"
              label={signingUp ? messages.auth.switchToLogin : messages.auth.switchToSignUp}
              onPress={() => {
                setMode(signingUp ? 'login' : 'sign_up');
                setMessage(null);
              }}
              testID="sign-in-switch-mode"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  keyLight: {
    ...StyleSheet.absoluteFill,
    experimental_backgroundImage:
      'radial-gradient(ellipse 78% 42% at 100% 0%, rgba(255, 214, 160, 0.2) 0%, rgba(245, 158, 11, 0.08) 34%, rgba(10, 10, 12, 0) 64%)',
  },
  welcomeContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  hero: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  logoTile: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: colors.brand,
    experimental_backgroundImage: `linear-gradient(135deg, ${colors.brand} 0%, ${colors.brandRose} 55%, ${colors.brandViolet} 100%)`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    color: colors.brandHighlight,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 10,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  tagline: {
    color: colors.muted,
    fontSize: fontSizes.body,
    lineHeight: 24,
    textAlign: 'center',
  },
  welcomeActions: { gap: spacing.md },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerLabel: { color: colors.placeholder, fontSize: fontSizes.caption },
  message: {
    color: colors.dangerForeground,
    fontSize: fontSizes.label,
    lineHeight: 20,
    textAlign: 'center',
  },
  stepContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.xxl,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconButton: {
    width: minimumTouchTarget,
    height: minimumTouchTarget,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  progress: { flex: 1, flexDirection: 'row', gap: spacing.sm },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  progressActive: { backgroundColor: colors.brand },
  stepBody: { gap: spacing.md },
  stepLabel: {
    color: colors.brand,
    fontSize: fontSizes.caption,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  stepTitle: {
    color: colors.foreground,
    fontSize: fontSizes.display,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  stepHint: { color: colors.muted, fontSize: fontSizes.body, lineHeight: 24 },
  input: {
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: colors.foreground,
    backgroundColor: colors.surface,
    minHeight: 60,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    fontSize: fontSizes.section,
  },
  passwordField: { justifyContent: 'center' },
  passwordInput: { paddingRight: 64 },
  reveal: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.md,
    bottom: 0,
    width: minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  emailChipText: { color: colors.foreground, fontSize: fontSizes.label, flexShrink: 1 },
  emailChipAction: { color: colors.brand, fontSize: fontSizes.label, fontWeight: '700' },
  stepFooter: { marginTop: 'auto', gap: spacing.sm },
});
