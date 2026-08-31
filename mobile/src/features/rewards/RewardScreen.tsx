import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
import type { CatalogClient } from '../../api/catalog/types';
import type { MeClient } from '../../api/me/types';
import type { RewardIntent, RewardsClient } from '../../api/rewards/types';
import { getAuthSessionRevision, getSessionCredential } from '../../auth/session';
import type { RewardedAdPresenter } from './types';
import { useCatalogQuery } from '../catalog/useCatalog';

type OfferState =
  | { phase: 'loading' }
  | { phase: 'loaded'; offer: { title: string; description: string } | null; message: string };

export interface RewardScreenProps {
  readonly episodeId: string;
  readonly catalog: CatalogClient;
  readonly me: MeClient;
  readonly rewards: RewardsClient;
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
  const mounted = useRef(false);
  const revision = useRef(getAuthSessionRevision());
  const inFlight = useRef(false);
  const requestId = useRef<string | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelWait = useRef<(() => void) | null>(null);

  function isCurrent(): boolean {
    return (
      mounted.current &&
      revision.current === getAuthSessionRevision() &&
      getSessionCredential() !== null
    );
  }
  function guard(): boolean {
    if (isCurrent()) return true;
    if (mounted.current) {
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
    const unavailable = (message: string): OfferState => ({
      phase: 'loaded',
      offer: null,
      message,
    });
    if (!enabled) return unavailable('Test ads are unavailable in this build.');
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
      if (profile.outcome !== 'ok') {
        return unavailable('Sign in through Account before unlocking an episode.');
      } else if (!profile.data.ads_consent) {
        return unavailable('Ads preference is off. Manage your choices in Account.');
      } else if (episode.outcome !== 'ok' || available.outcome !== 'ok') {
        return unavailable('The reward offer is unavailable. Try again later.');
      } else if (available.data.decision === 'granted') {
        return unavailable('This episode is already unlocked. Return to playback.');
      } else {
        const method = available.data.methods.find((value) => value.type === 'rewarded_ad');
        if (!method) {
          return unavailable('No rewarded ad is available for this episode.');
        }
        return {
          phase: 'loaded',
          offer: { title: episode.data.title, description: method.description },
          message: 'Test ads only. Access is confirmed by the server after verification.',
        };
      }
    } catch {
      return unavailable('The reward offer is unavailable. Try again later.');
    }
  }, [catalog, enabled, episodeId, me, rewards]);
  const { state, refresh } = useCatalogQuery(load);
  const offer = state.phase === 'loaded' && !invalidated ? state.offer : null;
  const displayMessage =
    message ?? (state.phase === 'loaded' ? state.message : 'Loading reward offer…');

  async function poll(row: RewardIntent): Promise<void> {
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
        setMessage('Reward verified. Opening playback…');
        onPlay(episodeId); // The player obtains a fresh server playback authorization.
        return;
      }
      if (verified.status === 'expired' || verified.status === 'unavailable') {
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
    if (inFlight.current || !enabled || !offer || !guard()) return;
    inFlight.current = true;
    setBusy(true);
    let created = intent;
    try {
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
        setMessage('Checking ad consent…');
        await presenter.prepare(isCurrent);
        if (!guard()) return;
        requestId.current ??= randomUUID();
        const result = await rewards.create(episodeId, requestId.current);
        if (!guard()) return;
        if (result.outcome !== 'ok') {
          setMessage('The reward could not start. Check your connection and try again.');
          return;
        }
        created = result.data;
        if (created.episode_id !== episodeId) throw new Error('Mismatched reward');
        setIntent(created);
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
    const isPrivacyCurrent = () => mounted.current && revision.current === getAuthSessionRevision();
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
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close reward"
          onPress={onClose}
          style={styles.button}
        >
          <Text style={styles.body}>Back</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {offer?.title ?? 'Episode reward'}
        </Text>
        {offer ? <Text style={styles.body}>{offer.description}</Text> : null}
        <Text accessibilityLiveRegion="polite" style={styles.body} testID="reward-message">
          {displayMessage}
        </Text>
        {offer && !terminal ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={intent ? 'Check reward status' : 'Watch test ad'}
            disabled={busy}
            onPress={() => {
              void watch();
            }}
            style={styles.button}
          >
            <Text style={styles.body}>{intent ? 'Check reward status' : 'Watch test ad'}</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Account and preferences"
          disabled={busy}
          onPress={onAccount}
          style={styles.button}
        >
          <Text style={styles.body}>Account and preferences</Text>
        </Pressable>
        {enabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ad privacy choices"
            disabled={busy}
            onPress={() => {
              void privacy();
            }}
            style={styles.button}
          >
            <Text style={styles.body}>Ad privacy choices</Text>
          </Pressable>
        ) : null}
        {!busy && (!offer || terminal) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh reward offer"
            onPress={() => {
              requestId.current = null;
              setIntent(null);
              setInvalidated(false);
              setMessage(null);
              refresh();
            }}
            style={styles.button}
          >
            <Text style={styles.body}>Refresh offer</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#09090b', flex: 1 },
  content: { padding: 24, gap: 20 },
  title: { color: '#fafafa', fontSize: 22, fontWeight: '600' },
  body: { color: '#fafafa', fontSize: 16 },
  button: { padding: 16, borderRadius: 8, backgroundColor: '#27272a' },
});
