import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AccountClient, AccountOutcome, AccountPreferences } from '../../api/account/types';
import type { AccountAnalytics } from '../../analytics/accountAnalytics';
import type { AnalyticsConsentController } from '../../analytics/consentController';
import type { AppAuth, ReauthenticationRequest } from '../../auth/localMockFirebaseAuth';
import { getAuthSessionRevision, setAuthSession } from '../../auth/session';
import { type AppMessages, useMessages } from '../../localization/messages';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';
import { clearPendingRewardAttempt } from '../rewards/pendingRewardAttempt';

export interface AccountScreenProps {
  readonly auth: AppAuth;
  readonly analytics: AccountAnalytics;
  readonly analyticsConsent: AnalyticsConsentController;
  readonly client: AccountClient;
  readonly onSignIn: () => void;
  readonly onHome: () => void;
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
  onReturnToEpisode,
}: AccountScreenProps): JSX.Element {
  const messages = useMessages();
  const [preferences, setPreferences] = useState<AccountPreferences | null>(null);
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
        const { country, analytics_consent, ads_consent } = result.data;
        setPreferences({ locale: 'en', country, analytics_consent, ads_consent });
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
    const result = await client.updatePreferences(preferences);
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
    const { country, analytics_consent, ads_consent } = result.data;
    setPreferences({ locale: 'en', country, analytics_consent, ads_consent });
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
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        testID="account-scroll"
      >
        <Text accessibilityRole="header" style={styles.title}>
          {messages.common.account}
        </Text>
        {loading ? <Text style={styles.body}>{messages.account.loading}</Text> : null}
        {message !== null ? (
          <Text accessibilityLiveRegion="polite" style={styles.body} testID="account-message">
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
            <Text style={styles.body}>{messages.account.languageEnglish}</Text>
            <Text style={styles.muted}>{messages.account.countryHint}</Text>
            <TextInput
              accessibilityLabel={messages.account.countryCode}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!busy}
              maxLength={2}
              onChangeText={(country) =>
                setPreferences({ ...preferences, country: country.toUpperCase() })
              }
              placeholder={messages.account.countryPlaceholder}
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={preferences.country}
            />
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
              label={messages.account.savePreferences}
              disabled={
                busy || (preferences.country !== '' && !/^[A-Z]{2}$/.test(preferences.country))
              }
              onPress={() => void run(savePreferences)}
            />
            <Action
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
            {confirming ? (
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
                  secureTextEntry
                  style={styles.input}
                  value={password}
                />
                <Action
                  label={messages.account.verifyCredentialDelete}
                  disabled={busy || password === ''}
                  onPress={() => void run(() => deleteAccount({ provider: 'password', password }))}
                />
                <Action
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
                label={messages.account.deleteAccount}
                disabled={busy}
                onPress={() => setConfirming(true)}
              />
            )}
          </>
        ) : !loading && !cleanupFailed ? (
          <>
            <Action label={messages.common.signIn} disabled={busy} onPress={onSignIn} />
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
        <Action label={messages.account.backHome} disabled={busy} onPress={onHome} />
        {onReturnToEpisode ? (
          <Action
            label={messages.account.backToEpisode}
            disabled={busy}
            onPress={onReturnToEpisode}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({
  label,
  disabled,
  onPress,
}: {
  readonly label: string;
  readonly disabled: boolean;
  readonly onPress: () => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}
    >
      <Text style={styles.body}>{label}</Text>
    </Pressable>
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
      <Text style={styles.body}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        disabled={disabled}
        value={value}
        onValueChange={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.foreground, fontSize: fontSizes.body },
  button: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.md,
  },
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
    minHeight: minimumTouchTarget,
  },
  container: { backgroundColor: colors.background, flex: 1 },
  content: { flexGrow: 1, gap: spacing.lg, padding: spacing.xxl },
  disabled: { opacity: 0.5 },
  input: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.foreground,
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.md,
  },
  muted: { color: colors.muted, fontSize: fontSizes.label },
  sectionTitle: { color: colors.foreground, fontSize: fontSizes.section, fontWeight: '600' },
  title: { color: colors.foreground, fontSize: fontSizes.title, fontWeight: '600' },
});
