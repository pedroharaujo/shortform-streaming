import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
import type { CatalogClient } from '../../api/catalog/types';
import type { MeClient } from '../../api/me/types';
import type { PlaybackClient } from '../../api/playback/types';
import type { RewardIntent, RewardsClient } from '../../api/rewards/types';
import { getAuthSessionRevision, getSessionCredential } from '../../auth/session';
import {
  clearPendingRewardAttempt,
  newPendingRewardAttempt,
  type PendingRewardAttempt,
  readPendingRewardAttempt,
  writePendingRewardAttempt,
} from './pendingRewardAttempt';
import type { RewardedAdPresenter } from './types';
import { useCatalogQuery } from '../catalog/useCatalog';

type OfferState =
  | { phase: 'loading' }
  | {
      phase: 'loaded';
      offer: { title: string; description: string; action: string } | null;
      message: string;
      unlocked?: boolean;
      recoveredAttempt?: PendingRewardAttempt;
    };

export interface RewardScreenProps {
  readonly episodeId: string;
  readonly catalog: CatalogClient;
  readonly me: MeClient;
  readonly rewards: RewardsClient;
  readonly playback: PlaybackClient;
  readonly presenter: RewardedAdPresenter;
  readonly enabled: boolean;
  readonly onClose: () => void;
  readonly onAccount: () => void;
  readonly onPlay: (episodeId: string) => void;
}

export function RewardScreen({
  episodeId,
  catalog,
  me,
  rewards,
  playback,
  presenter,
  enabled,
  onClose,
  onAccount,
  onPlay,
}: RewardScreenProps): JSX.Element {
  const [invalidated, setInvalidated] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<RewardIntent | null>(null);
  const [attemptOverride, setAttempt] = useState<PendingRewardAttempt | null>();
  const mounted = useRef(false);
  const leaving = useRef(false);
  const revision = useRef(getAuthSessionRevision());
  const inFlight = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelWait = useRef<(() => void) | null>(null);

  function isCurrent(): boolean {
    return (
      mounted.current &&
      !leaving.current &&
      revision.current === getAuthSessionRevision() &&
      getSessionCredential() !== null
    );
  }
  function guard(): boolean {
    if (isCurrent()) return true;
    if (mounted.current && !leaving.current) {
      setInvalidated(true);
      setIntent(null);
      setMessage('Your session changed. Return to Account and sign in again.');
    }
    return false;
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (retryTimer.current !== null) clearTimeout(retryTimer.current);
      cancelWait.current?.();
    };
  }, []);

  const load = useCallback(async (): Promise<OfferState> => {
    const unavailable = (message: string): Extract<OfferState, { phase: 'loaded' }> => ({
      phase: 'loaded',
      offer: null,
      message,
    });
    const owner = revision.current;
    if (owner !== getAuthSessionRevision() || getSessionCredential() === null) {
      return unavailable('Sign in through Account before unlocking an episode.');
    }
    try {
      const [episode, available, profile] = await Promise.all([
        catalog.getEpisode(episodeId),
        rewards.offers(episodeId),
        me.getMe(),
      ]);
      if (owner !== getAuthSessionRevision())
        return unavailable('Your session changed. Return to Account and sign in again.');
      if ([episode, available, profile].some((result) => result.outcome === 'unreachable')) {
        return unavailable('You may be offline. Check your connection and refresh the offer.');
      }
      if (profile.outcome === 'unauthenticated' || available.outcome === 'unauthenticated') {
        return unavailable('Sign in through Account before unlocking an episode.');
      } else if (episode.outcome === 'not-found' || available.outcome === 'not-found') {
        return unavailable('This episode is no longer available.');
      } else if (profile.outcome !== 'ok') {
        return unavailable('The account could not be checked. Refresh the offer to try again.');
      } else if (episode.outcome !== 'ok' || available.outcome !== 'ok') {
        return unavailable('The reward offer is unavailable. Try again later.');
      } else if (available.data.episode_id !== episodeId) {
        return unavailable('The reward offer did not match this episode. Refresh to try again.');
      }
      const recoveredAttempt = await readPendingRewardAttempt(profile.data.public_id, episodeId);
      if (owner !== getAuthSessionRevision())
        return unavailable('Your session changed. Return to Account and sign in again.');
      if (available.data.decision === 'granted') {
        if (recoveredAttempt !== null) await clearPendingRewardAttempt();
        return {
          ...unavailable('This episode is already unlocked. Continue to playback.'),
          unlocked: true,
        };
      } else if (!enabled) {
        return unavailable('Test ads are unavailable in this build.');
      } else if (!profile.data.ads_consent) {
        return unavailable('Ads preference is off. Manage your choices in Account.');
      } else {
        const method = available.data.methods.find((value) => value.type === 'rewarded_ad');
        if (!method) {
          return unavailable('No rewarded ad is available for this episode.');
        }
        return {
          phase: 'loaded',
          offer: {
            title: episode.data.title,
            description: method.description,
            action: method.title,
          },
          message: 'Test ads only. Access is confirmed by the server after verification.',
          ...(recoveredAttempt === null ? {} : { recoveredAttempt }),
        };
      }
    } catch {
      return unavailable('The reward offer is unavailable. Try again later.');
    }
  }, [catalog, enabled, episodeId, me, rewards]);
  const { state, refresh } = useCatalogQuery(load);
  const recoveryResolved = state.phase === 'loaded';
  const recoveredAttempt = state.phase === 'loaded' ? (state.recoveredAttempt ?? null) : null;
  const attempt = attemptOverride === undefined ? recoveredAttempt : attemptOverride;
  const offer = state.phase === 'loaded' && !invalidated ? state.offer : null;
  const displayMessage =
    message ?? (state.phase === 'loaded' ? state.message : 'Loading reward offer…');

  function leave(action: () => void): void {
    leaving.current = true;
    if (retryTimer.current !== null) clearTimeout(retryTimer.current);
    cancelWait.current?.();
    action();
  }

  async function confirmPlayback(): Promise<void> {
    setMessage('Refreshing episode access…');
    // A historical reward grant is not current entitlement/rights eligibility.
    const access = await rewards.offers(episodeId);
    if (!guard()) return;
    if (
      access.outcome !== 'ok' ||
      access.data.episode_id !== episodeId ||
      access.data.decision !== 'granted'
    ) {
      setMessage('Episode access could not be confirmed. Check your connection and try again.');
      return;
    }
    setMessage('Checking playback availability…');
    const authorization = await playback.authorize(episodeId);
    if (!guard()) return;
    if (authorization.outcome !== 'ok') {
      setMessage('Playback is not available right now. You can retry without watching another ad.');
      return;
    }
    // Do not pass this short-lived URL to navigation. The player authorizes again on entry.
    leave(() => onPlay(episodeId));
  }

  async function continuePlayback(): Promise<void> {
    if (inFlight.current || !guard()) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await confirmPlayback();
    } catch {
      if (guard())
        setMessage('Playback could not be checked. Check your connection and try again.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function poll(row: Pick<RewardIntent, 'id' | 'episode_id'>): Promise<void> {
    for (let attempt = 0; attempt < 10 && isCurrent(); attempt += 1) {
      const result = await rewards.get(row.id);
      if (!guard()) return;
      if (result.outcome !== 'ok') {
        setMessage('Could not confirm the reward. Check reward status before trying another ad.');
        return;
      }
      const verified = result.data;
      if (verified.id !== row.id || verified.episode_id !== episodeId) {
        setMessage('The reward response did not match this episode.');
        return;
      }
      setIntent(verified);
      if (verified.status === 'granted') {
        await clearPendingRewardAttempt();
        setAttempt(null);
        await confirmPlayback();
        return;
      }
      if (verified.status === 'expired' || verified.status === 'unavailable') {
        await clearPendingRewardAttempt();
        setAttempt(null);
        setMessage(
          'The reward expired or is no longer available. No access was granted by this screen.',
        );
        return;
      }
      setMessage(
        'Waiting for server verification. The ad completion alone does not unlock this episode.',
      );
      if (attempt < 9)
        await new Promise<void>((resolve) => {
          cancelWait.current = resolve;
          retryTimer.current = setTimeout(() => {
            cancelWait.current = null;
            resolve();
          }, 2000);
        });
    }
    if (guard())
      setMessage(
        'Verification is still pending. Check reward status again; you do not need to watch another ad.',
      );
  }

  async function watch(): Promise<void> {
    if (
      inFlight.current ||
      (!intent && !attempt && (!enabled || !offer)) ||
      !recoveryResolved ||
      !guard()
    )
      return;
    inFlight.current = true;
    setBusy(true);
    let created = intent;
    try {
      if (created === null && attempt?.intentId !== undefined) {
        await poll({ id: attempt.intentId, episode_id: attempt.episodeId });
        return;
      }
      // A pending intent is status-only: no duplicate impression on retry.
      if (created === null) {
        const profile = await me.getMe();
        if (!guard()) return;
        if (profile.outcome !== 'ok' || !profile.data.ads_consent) {
          setInvalidated(true);
          setMessage(
            'Ads preference is off or the account is unavailable. Open Account to continue.',
          );
          return;
        }
        if (attempt !== null && profile.data.public_id !== attempt.profileId) {
          await clearPendingRewardAttempt();
          setAttempt(null);
          setInvalidated(true);
          setMessage('Your session changed. Return to Account and sign in again.');
          return;
        }
        setMessage('Checking ad consent…');
        await presenter.prepare(isCurrent);
        if (!guard()) return;
        let activeAttempt = attempt;
        if (activeAttempt === null) {
          activeAttempt = newPendingRewardAttempt(profile.data.public_id, episodeId, randomUUID());
          try {
            await writePendingRewardAttempt(activeAttempt);
          } catch {
            setMessage('Secure reward recovery is unavailable. Try again later.');
            return;
          }
          if (!guard()) return;
          setAttempt(activeAttempt);
        }
        const result = await rewards.create(episodeId, activeAttempt.requestId);
        if (!guard()) return;
        if (result.outcome !== 'ok') {
          setMessage('The reward could not start. Check your connection and try again.');
          return;
        }
        created = result.data;
        if (created.episode_id !== episodeId) throw new Error('Mismatched reward');
        setIntent(created);
        const identifiedAttempt = { ...activeAttempt, intentId: created.id };
        try {
          await writePendingRewardAttempt(identifiedAttempt);
          setAttempt(identifiedAttempt);
        } catch {
          setMessage(
            'The reward was created, but secure recovery is unavailable. Check reward status.',
          );
          return;
        }
        if (!guard()) return;
        if (created.status === 'pending') {
          setMessage('Loading test ad…');
          await presenter.present(created, isCurrent);
          if (!guard()) return;
        }
      }
      await poll(created);
    } catch {
      if (guard()) {
        setMessage(
          created
            ? 'The ad was unavailable or closed. Check reward status; no client reward was granted.'
            : 'The test ad could not start. Consent or ad service may be unavailable. Try again later.',
        );
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function privacy(): Promise<void> {
    // Privacy withdrawal does not require a reward offer or an account.
    const isPrivacyCurrent = () =>
      mounted.current && !leaving.current && revision.current === getAuthSessionRevision();
    if (inFlight.current || !isPrivacyCurrent() || !enabled) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await presenter.privacy(isPrivacyCurrent);
      if (isPrivacyCurrent()) setMessage('Ad privacy choices updated.');
    } catch {
      if (isPrivacyCurrent())
        setMessage('Ad privacy choices are unavailable. You can turn off ads in Account.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const terminal = intent?.status === 'expired' || intent?.status === 'unavailable';
  return (
    <SafeAreaView style={styles.container} testID="reward-screen">
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close reward"
            onPress={() => leave(onClose)}
            style={styles.button}
          >
            <Text style={styles.body}>Not now</Text>
          </Pressable>
          <Text style={styles.eyebrow}>EPISODE ACCESS</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {offer?.title ?? 'Unlock this episode'}
          </Text>
          {offer ? (
            <View style={styles.offer}>
              <Text style={styles.offerTitle}>{offer.action}</Text>
              <Text style={styles.body}>{offer.description}</Text>
            </View>
          ) : null}
          {state.phase === 'loading' || !recoveryResolved || busy ? (
            <ActivityIndicator accessibilityLabel="Checking episode access" color="#fafafa" />
          ) : null}
          <Text accessibilityLiveRegion="polite" style={styles.body} testID="reward-message">
            {displayMessage}
          </Text>
          {(offer || intent || attempt) && recoveryResolved && !invalidated && !terminal ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                intent || attempt?.intentId ? 'Check reward status' : 'Watch test ad'
              }
              disabled={busy}
              accessibilityState={{ disabled: busy, busy }}
              onPress={() => {
                void watch();
              }}
              style={[styles.primary, busy && styles.disabled]}
            >
              <Text style={styles.primaryText}>
                {intent || attempt?.intentId ? 'Check reward status' : 'Watch test ad'}
              </Text>
            </Pressable>
          ) : null}
          {state.phase === 'loaded' && state.unlocked && !intent && !invalidated ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue to playback"
              accessibilityState={{ disabled: busy, busy }}
              disabled={busy}
              style={[styles.primary, busy && styles.disabled]}
              onPress={() => void continuePlayback()}
            >
              <Text style={styles.primaryText}>Continue to playback</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              getSessionCredential() === null ? 'Sign in to unlock' : 'Account and preferences'
            }
            disabled={busy}
            accessibilityState={{ disabled: busy }}
            onPress={() => leave(onAccount)}
            style={[styles.button, busy && styles.disabled]}
          >
            <Text style={styles.body}>
              {getSessionCredential() === null ? 'Sign in to unlock' : 'Account and preferences'}
            </Text>
          </Pressable>
          {enabled ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ad privacy choices"
              disabled={busy}
              accessibilityState={{ disabled: busy }}
              onPress={() => {
                void privacy();
              }}
              style={[styles.button, busy && styles.disabled]}
            >
              <Text style={styles.body}>Ad privacy choices</Text>
            </Pressable>
          ) : null}
          {!busy &&
          state.phase === 'loaded' &&
          !invalidated &&
          (!intent || terminal) &&
          (!offer || terminal) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh reward offer"
              onPress={() => {
                // Only a terminal response proves an old request can no longer grant.
                if (terminal) {
                  setIntent(null);
                  setAttempt(null);
                }
                setMessage(null);
                setAttempt(undefined);
                refresh();
              }}
              style={styles.button}
            >
              <Text style={styles.body}>Refresh offer</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#09090b', flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '100%',
    backgroundColor: '#18181b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  content: { padding: 24, gap: 20 },
  eyebrow: { color: '#a1a1aa', fontSize: 12, letterSpacing: 2 },
  title: { color: '#fafafa', fontSize: 26, fontWeight: '600' },
  offer: { padding: 20, borderRadius: 16, borderColor: '#52525b', borderWidth: 1, gap: 12 },
  offerTitle: { color: '#fafafa', fontSize: 20, fontWeight: '600' },
  body: { color: '#fafafa', fontSize: 16 },
  button: { minHeight: 48, padding: 16, borderRadius: 12, backgroundColor: '#27272a' },
  primary: { minHeight: 48, padding: 16, borderRadius: 12, backgroundColor: '#fafafa' },
  primaryText: { color: '#18181b', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  disabled: { opacity: 0.5 },
});
