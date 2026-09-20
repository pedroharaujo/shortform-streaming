import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BackHandler, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AccountClient, AccountOutcome, AccountPreferences } from '../../api/account/types';
import type { AccountAnalytics } from '../../analytics/accountAnalytics';
import type { AnalyticsConsentController } from '../../analytics/consentController';
import type { AppAuth, ReauthenticationRequest } from '../../auth/localMockFirebaseAuth';
import {
  getAuthSessionRevision,
  getSessionCredential,
  setAuthSession,
  subscribeAuthSession,
} from '../../auth/session';
import { type AppMessages, useMessages } from '../../localization/messages';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';
import {
  ActionButton as Action,
  BackButton,
  SettingsRow,
  ScreenIntro,
  panelStyles,
} from '../../ui/ScreenElements';
import { useKeyboardScroll } from '../../ui/useKeyboardScroll';
import { clearPendingRewardAttempt } from '../rewards/pendingRewardAttempt';

export interface AccountScreenProps {
  readonly auth: AppAuth;
  readonly analytics: AccountAnalytics;
  readonly analyticsConsent: AnalyticsConsentController;
  readonly client: AccountClient;
  readonly onSignIn: () => void;
  readonly onHome: () => void;
  readonly onPurchases?: (() => void) | undefined;
  readonly onWallet?: (() => void) | undefined;
  readonly onReturnToEpisode?: (() => void) | undefined;
}

function failureMessage(
  outcome: Exclude<AccountOutcome<unknown>, { outcome: 'ok' }>,
  messages: AppMessages['account'],
): string {
  if (outcome.outcome === 'unreachable') {
    return messages.serviceUnreachable;
  }
  if (outcome.code === 'reauthentication_required') {
    return messages.verificationExpired;
  }
  if (outcome.outcome === 'unauthenticated') {
    return messages.signInAgain;
  }
  return messages.requestFailed;
}

export function AccountScreen({
  auth,
  analytics,
  analyticsConsent,
  client,
  onSignIn,
  onHome,
  onWallet,
  onPurchases,
  onReturnToEpisode,
}: AccountScreenProps): JSX.Element {
  const messages = useMessages();
  const { scrollRef, revealField, onFieldFocus, onFieldBlur } = useKeyboardScroll();
  const [panel, setPanel] = useState<'overview' | 'privacy' | 'security'>('overview');
  const [preferences, setPreferences] = useState<Pick<
    AccountPreferences,
    'analytics_consent' | 'ads_consent'
  > | null>(null);
  const [profileRevision, setProfileRevision] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [ended, setEnded] = useState(false);
  const [cleanupFailed, setCleanupFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const sessionOwner = useRef(getAuthSessionRevision());
  const revision = useSyncExternalStore(subscribeAuthSession, getAuthSessionRevision);

  function backToAccount() {
    setPanel('overview');
    setConfirming(false);
    setPassword('');
    setMessage(null);
  }

  useEffect(() => {
    if (panel === 'overview') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!busy) backToAccount();
      return true;
    });
    return () => subscription.remove();
  }, [panel, busy]);

  const requireSession = useCallback(
    (revision: number): boolean => {
      if (getAuthSessionRevision() === revision) return true;
      setPreferences(null);
      setPassword('');
      setConfirming(false);
      setCleanupFailed(false);
      setEnded(true);
      setMessage(messages.account.sessionChanged);
      return false;
    },
    [messages.account.sessionChanged],
  );

  async function run(task: () => Promise<void>): Promise<void> {
    // State updates alone do not guard two taps in the same render.
    if (inFlight.current || !requireSession(sessionOwner.current)) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await task();
    } catch {
      setMessage(messages.account.requestFailed);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const clearSession = useCallback(async (): Promise<boolean> => {
    if (!requireSession(sessionOwner.current)) return false;
    setAuthSession(null);
    sessionOwner.current = getAuthSessionRevision();
    const clearingRevision = sessionOwner.current;
    setPreferences(null);
    setPassword('');
    setConfirming(false);
    setEnded(true);
    await analyticsConsent.clear();
    if (!requireSession(clearingRevision)) return false;
    await clearPendingRewardAttempt();
    if (!requireSession(clearingRevision)) return false;
    try {
      await auth.signOut();
      if (!requireSession(clearingRevision)) return false;
      setCleanupFailed(false);
      return true;
    } catch {
      if (!requireSession(clearingRevision)) return false;
      setCleanupFailed(true);
      return false;
    }
  }, [analyticsConsent, auth, requireSession]);

  useEffect(() => {
    let active = true;
    const loadingRevision = sessionOwner.current;
    void client.getProfile().then(async (result) => {
      if (!active) return;
      if (!requireSession(loadingRevision)) {
        setLoading(false);
        return;
      }
      if (result.outcome === 'ok') {
        await analyticsConsent.applyProfile({
          profileId: result.data.public_id,
          analyticsConsent: result.data.analytics_consent,
          sessionRevision: loadingRevision,
        });
        if (!active || !requireSession(loadingRevision)) {
          setLoading(false);
          return;
        }
        const { analytics_consent, ads_consent } = result.data;
        setPreferences({ analytics_consent, ads_consent });
        setProfileRevision(loadingRevision);
      } else {
        if (result.outcome === 'unauthenticated') await clearSession();
        if (active && requireSession(sessionOwner.current)) {
          setMessage(failureMessage(result, messages.account));
        }
      }
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [analyticsConsent, clearSession, client, messages.account, reload, requireSession]);

  async function showFailure(result: Exclude<AccountOutcome<unknown>, { outcome: 'ok' }>) {
    if (result.outcome === 'unauthenticated') await clearSession();
    if (requireSession(sessionOwner.current)) {
      setMessage(failureMessage(result, messages.account));
    }
  }

  async function savePreferences() {
    if (preferences === null) return;
    const revision = sessionOwner.current;
    const result = await client.updatePreferences({
      analytics_consent: preferences.analytics_consent,
      ads_consent: preferences.ads_consent,
    });
    if (!requireSession(revision)) return;
    if (result.outcome !== 'ok') {
      await showFailure(result);
      return;
    }
    await analyticsConsent.applyProfile({
      profileId: result.data.public_id,
      analyticsConsent: result.data.analytics_consent,
      sessionRevision: revision,
    });
    if (!requireSession(revision)) return;
    const { analytics_consent, ads_consent } = result.data;
    setPreferences({ analytics_consent, ads_consent });
    setProfileRevision(revision);
    setMessage(messages.account.preferencesSaved);
  }

  async function deleteAccount(request: ReauthenticationRequest) {
    if (!confirming) return;
    const verifyingRevision = sessionOwner.current;
    const verified = await auth.reauthenticate(request);
    setPassword('');
    if (!requireSession(verifyingRevision)) return;
    if (verified.outcome === 'cancelled') {
      setMessage(messages.account.verificationCancelled);
      return;
    }
    if (verified.outcome === 'error') {
      setMessage(messages.account.verificationFailed);
      return;
    }
    setAuthSession(verified.session);
    sessionOwner.current = getAuthSessionRevision();
    const deletingRevision = sessionOwner.current;
    const result = await client.deleteAccount();
    if (!requireSession(deletingRevision)) return;
    if (result.outcome === 'unreachable') {
      setMessage(messages.account.deletionResponseLost);
      return;
    }
    if (result.outcome !== 'ok') {
      await showFailure(result);
      return;
    }
    await analyticsConsent.clearForAccountDeletion(() =>
      analytics.recordDeletion(result.data.public_id, result.data.status),
    );
    if (!requireSession(deletingRevision)) return;
    await clearSession();
    if (!requireSession(sessionOwner.current)) return;
    setMessage(
      result.data.status === 'completed'
        ? messages.account.deleted
        : messages.account.deletionPending,
    );
  }

  return (
    <SafeAreaView style={styles.container} testID="account-screen">
      <ScrollView
        ref={scrollRef}
        onLayout={revealField}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        testID="account-scroll"
      >
        <BackButton
          label={panel === 'overview' ? messages.account.backHome : messages.common.account}
          onPress={panel === 'overview' ? onHome : backToAccount}
          disabled={busy}
        />
        <ScreenIntro
          title={
            panel === 'privacy'
              ? messages.design.privacy
              : panel === 'security'
                ? messages.design.security
                : messages.common.account
          }
          subtitle={
            panel === 'privacy'
              ? messages.design.privacyDescription
              : panel === 'security'
                ? messages.design.securityDescription
                : messages.design.accountDescription
          }
        />
        {loading ? <Text style={styles.body}>{messages.account.loading}</Text> : null}
        {message !== null ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.body, styles.notice]}
            testID="account-message"
          >
            {message}
          </Text>
        ) : null}
        {cleanupFailed ? (
          <>
            <Text style={styles.body}>{messages.account.cleanupFailed}</Text>
            <Action
              label={messages.account.retryDeviceSignOut}
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await clearSession();
                })
              }
            />
          </>
        ) : null}
        {preferences !== null && !ended ? (
          <>
            {panel === 'overview' ? (
              <View style={styles.menu}>
                {revision === profileRevision && getSessionCredential() !== null ? (
                  <>
                    {onWallet ? (
                      <SettingsRow
                        label={messages.wallet.title}
                        disabled={busy}
                        onPress={() => {
                          if (requireSession(sessionOwner.current)) onWallet();
                        }}
                      />
                    ) : null}
                    {onPurchases ? (
                      <SettingsRow
                        label={messages.purchases.title}
                        disabled={busy}
                        onPress={() => {
                          if (requireSession(sessionOwner.current)) onPurchases();
                        }}
                      />
                    ) : null}
                  </>
                ) : null}
                <SettingsRow
                  label={messages.design.privacy}
                  disabled={busy}
                  onPress={() => setPanel('privacy')}
                />
                <SettingsRow
                  label={messages.design.security}
                  disabled={busy}
                  onPress={() => setPanel('security')}
                />
              </View>
            ) : null}
            {panel === 'privacy' ? (
              <View style={panelStyles.card}>
                <Consent
                  label={messages.account.analyticsConsent}
                  value={preferences.analytics_consent}
                  disabled={busy}
                  onChange={(analytics_consent) =>
                    setPreferences({ ...preferences, analytics_consent })
                  }
                />
                <Consent
                  label={messages.account.adsConsent}
                  value={preferences.ads_consent}
                  disabled={busy}
                  onChange={(ads_consent) => setPreferences({ ...preferences, ads_consent })}
                />
                <Text style={styles.muted}>{messages.account.preferencesHint}</Text>
                <Action
                  tone="primary"
                  label={messages.account.savePreferences}
                  disabled={busy}
                  onPress={() => void run(savePreferences)}
                />
              </View>
            ) : null}
            {panel === 'overview' ? (
              <Action
                tone="quiet"
                label={messages.account.signOut}
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    const cleared = await clearSession();
                    if (requireSession(sessionOwner.current)) {
                      setMessage(
                        cleared ? messages.account.signedOut : messages.account.signedOutApp,
                      );
                    }
                  })
                }
              />
            ) : null}
            {panel === 'security' ? (
              confirming ? (
                <View style={styles.confirmation}>
                  <Text accessibilityRole="header" style={styles.sectionTitle}>
                    {messages.account.confirmDeletion}
                  </Text>
                  <Text style={styles.body}>{messages.account.deletionWarning}</Text>
                  <Text style={styles.muted}>{messages.account.verificationHint}</Text>
                  <TextInput
                    accessibilityLabel={messages.account.currentCredential}
                    autoComplete="password"
                    editable={!busy}
                    onChangeText={setPassword}
                    onFocus={onFieldFocus}
                    onBlur={onFieldBlur}
                    secureTextEntry
                    style={styles.input}
                    value={password}
                  />
                  <Action
                    tone="danger"
                    label={messages.account.verifyCredentialDelete}
                    disabled={busy || password === ''}
                    onPress={() =>
                      void run(() => deleteAccount({ provider: 'password', password }))
                    }
                  />
                  <Action
                    tone="danger"
                    label={messages.account.verifyGoogleDelete}
                    disabled={busy}
                    onPress={() => void run(() => deleteAccount({ provider: 'google' }))}
                  />
                  <Action
                    label={messages.account.cancelDeletion}
                    disabled={busy}
                    onPress={() => {
                      setConfirming(false);
                      setPassword('');
                    }}
                  />
                </View>
              ) : (
                <Action
                  tone="danger"
                  label={messages.account.deleteAccount}
                  disabled={busy}
                  onPress={() => setConfirming(true)}
                />
              )
            ) : null}
          </>
        ) : !loading && !cleanupFailed ? (
          <>
            <Action
              tone="primary"
              label={messages.common.signIn}
              disabled={busy}
              onPress={() => {
                setPanel('overview');
                onSignIn();
              }}
            />
            {!ended ? (
              <Action
                label={messages.account.retryLoading}
                disabled={busy}
                onPress={() => {
                  setLoading(true);
                  setMessage(null);
                  setReload((value) => value + 1);
                }}
              />
            ) : null}
          </>
        ) : null}
        {onReturnToEpisode ? (
          <Action
            label={messages.account.backToEpisode}
            disabled={busy}
            onPress={() => {
              backToAccount();
              onReturnToEpisode();
            }}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Consent({
  label,
  value,
  disabled,
  onChange,
}: {
  readonly label: string;
  readonly value: boolean;
  readonly disabled: boolean;
  readonly onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <View style={styles.consent}>
      <Text style={[styles.body, styles.consentLabel]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        disabled={disabled}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.accentSoft }}
        thumbColor={value ? colors.accent : colors.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  menu: { backgroundColor: colors.surface, borderRadius: radii.lg, overflow: 'hidden' },
  body: { color: colors.foreground, fontSize: fontSizes.body },
  notice: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    lineHeight: 24,
  },
  consentLabel: { flex: 1, flexShrink: 1 },
  confirmation: {
    borderColor: colors.danger,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  consent: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: minimumTouchTarget,
  },
  container: { backgroundColor: colors.background, flex: 1 },
  content: { flexGrow: 1, gap: spacing.lg, padding: spacing.xxl },
  input: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.foreground,
    backgroundColor: colors.background,
    fontSize: fontSizes.body,
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  muted: { color: colors.muted, fontSize: fontSizes.label, lineHeight: 22 },
  sectionTitle: { color: colors.foreground, fontSize: fontSizes.section, fontWeight: '600' },
});
