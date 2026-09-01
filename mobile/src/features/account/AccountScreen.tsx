import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AccountClient, AccountOutcome, AccountPreferences } from '../../api/account/types';
import type { AccountAnalytics } from '../../analytics/accountAnalytics';
import type { AnalyticsConsentController } from '../../analytics/consentController';
import type { AppAuth, ReauthenticationRequest } from '../../auth/localMockFirebaseAuth';
import { getAuthSessionRevision, setAuthSession } from '../../auth/session';
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

function failureMessage(outcome: Exclude<AccountOutcome<unknown>, { outcome: 'ok' }>): string {
  if (outcome.outcome === 'unreachable') {
    return 'Unable to reach the account service. Check your connection and try again.';
  }
  if (outcome.code === 'reauthentication_required') {
    return 'Verification expired. Verify your account again to request deletion.';
  }
  if (outcome.code === 'export_unavailable') {
    return 'Account export is not available yet. No export has been requested.';
  }
  if (outcome.outcome === 'unauthenticated') {
    return 'Sign in again to manage your account.';
  }
  return 'The request could not be completed. Please try again.';
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

  const requireSession = useCallback((revision: number): boolean => {
    if (getAuthSessionRevision() === revision) return true;
    setPreferences(null);
    setPassword('');
    setConfirming(false);
    setCleanupFailed(false);
    setEnded(true);
    setMessage('Your session changed. Return home and reopen Account.');
    return false;
  }, []);

  async function run(task: () => Promise<void>): Promise<void> {
    // State updates alone do not guard two taps in the same render.
    if (inFlight.current || !requireSession(sessionOwner.current)) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await task();
    } catch {
      setMessage('The request could not be completed. Please try again.');
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
        if (active && requireSession(sessionOwner.current)) setMessage(failureMessage(result));
      }
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [analyticsConsent, clearSession, client, reload, requireSession]);

  async function showFailure(result: Exclude<AccountOutcome<unknown>, { outcome: 'ok' }>) {
    if (result.outcome === 'unauthenticated') await clearSession();
    if (requireSession(sessionOwner.current)) setMessage(failureMessage(result));
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
    setMessage('Preferences saved.');
  }

  async function deleteAccount(request: ReauthenticationRequest) {
    if (!confirming) return;
    const verifyingRevision = sessionOwner.current;
    const verified = await auth.reauthenticate(request);
    setPassword('');
    if (!requireSession(verifyingRevision)) return;
    if (verified.outcome === 'cancelled') {
      setMessage('Verification cancelled. No deletion request was sent.');
      return;
    }
    if (verified.outcome === 'error') {
      setMessage(verified.message);
      return;
    }
    setAuthSession(verified.session);
    sessionOwner.current = getAuthSessionRevision();
    const deletingRevision = sessionOwner.current;
    const result = await client.deleteAccount();
    if (!requireSession(deletingRevision)) return;
    if (result.outcome === 'unreachable') {
      setMessage(
        'The response was lost. Your deletion request may already have been accepted. Signing in cannot verify deletion. Contact support to verify completion.',
      );
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
        ? 'Your account has been deleted. You are signed out.'
        : 'Deletion accepted. App account data has been deleted; identity-provider cleanup is pending. You are signed out.',
    );
  }

  return (
    <SafeAreaView style={styles.container} testID="account-screen">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>
          Account
        </Text>
        {loading ? <Text style={styles.body}>Loading account…</Text> : null}
        {message !== null ? (
          <Text accessibilityLiveRegion="polite" style={styles.body} testID="account-message">
            {message}
          </Text>
        ) : null}
        {cleanupFailed ? (
          <>
            <Text style={styles.body}>
              The app session is cleared, but native sign-out failed. Retry to finish signing out on
              this device.
            </Text>
            <Action
              label="Retry device sign-out"
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
            <Text style={styles.body}>Language: English</Text>
            <Text style={styles.muted}>
              Country is an account preference. It does not change where content is available.
            </Text>
            <TextInput
              accessibilityLabel="Country code"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!busy}
              maxLength={2}
              onChangeText={(country) =>
                setPreferences({ ...preferences, country: country.toUpperCase() })
              }
              placeholder="Country code (optional)"
              placeholderTextColor="#a1a1aa"
              style={styles.input}
              value={preferences.country}
            />
            <Consent
              label="Analytics consent"
              value={preferences.analytics_consent}
              disabled={busy}
              onChange={(analytics_consent) =>
                setPreferences({ ...preferences, analytics_consent })
              }
            />
            <Consent
              label="Ads consent"
              value={preferences.ads_consent}
              disabled={busy}
              onChange={(ads_consent) => setPreferences({ ...preferences, ads_consent })}
            />
            <Text style={styles.muted}>
              Optional preferences are off by default. Analytics activates only after the server
              saves consent. Turning it off, signing out, or deleting your account clears the
              analytics identity and local analytics data.
            </Text>
            <Action
              label="Save preferences"
              disabled={
                busy || (preferences.country !== '' && !/^[A-Z]{2}$/.test(preferences.country))
              }
              onPress={() => void run(savePreferences)}
            />
            <Action
              label="Request account export"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  const revision = sessionOwner.current;
                  const result = await client.requestExport();
                  if (!requireSession(revision)) return;
                  if (result.outcome !== 'ok') await showFailure(result);
                  else
                    setMessage(
                      'Account export is not available yet. No export has been requested.',
                    );
                })
              }
            />
            <Action
              label="Sign out"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  const cleared = await clearSession();
                  if (requireSession(sessionOwner.current)) {
                    setMessage(cleared ? 'Signed out.' : 'Signed out of the app.');
                  }
                })
              }
            />
            {confirming ? (
              <View style={styles.confirmation}>
                <Text accessibilityRole="header" style={styles.body}>
                  Confirm account deletion
                </Text>
                <Text style={styles.body}>
                  This permanently removes your profile, watch progress, and access grants. This
                  cannot be undone. Identity-provider cleanup may remain pending.
                </Text>
                <Text style={styles.muted}>
                  Verify using the account you are currently signed in to. Use your password or the
                  same Google account.
                </Text>
                <TextInput
                  accessibilityLabel="Current password"
                  autoComplete="password"
                  editable={!busy}
                  onChangeText={setPassword}
                  secureTextEntry
                  style={styles.input}
                  value={password}
                />
                <Action
                  label="Verify password and delete account"
                  disabled={busy || password === ''}
                  onPress={() => void run(() => deleteAccount({ provider: 'password', password }))}
                />
                <Action
                  label="Verify Google and delete account"
                  disabled={busy}
                  onPress={() => void run(() => deleteAccount({ provider: 'google' }))}
                />
                <Action
                  label="Cancel deletion"
                  disabled={busy}
                  onPress={() => {
                    setConfirming(false);
                    setPassword('');
                  }}
                />
              </View>
            ) : (
              <Action label="Delete account" disabled={busy} onPress={() => setConfirming(true)} />
            )}
          </>
        ) : !loading && !cleanupFailed ? (
          <>
            <Action label="Sign in" disabled={busy} onPress={onSignIn} />
            {!ended ? (
              <Action
                label="Retry account loading"
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
        <Action label="Back to home" disabled={busy} onPress={onHome} />
        {onReturnToEpisode ? (
          <Action label="Back to episode" disabled={busy} onPress={onReturnToEpisode} />
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
  body: { color: '#fafafa', fontSize: 16 },
  button: { borderColor: '#3f3f46', borderRadius: 8, borderWidth: 1, padding: 14 },
  confirmation: { borderColor: '#ef4444', borderRadius: 8, borderWidth: 1, padding: 16, gap: 16 },
  consent: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  container: { backgroundColor: '#09090b', flex: 1 },
  content: { padding: 24, gap: 16 },
  disabled: { opacity: 0.5 },
  input: { borderColor: '#3f3f46', borderRadius: 8, borderWidth: 1, color: '#fafafa', padding: 12 },
  muted: { color: '#a1a1aa', fontSize: 14 },
  title: { color: '#fafafa', fontSize: 22, fontWeight: '600' },
});
