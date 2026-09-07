import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type JSX } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
import type { CatalogClient } from '../../api/catalog/types';
import type { MeClient } from '../../api/me/types';
import type { PlaybackClient } from '../../api/playback/types';
import type { EpisodeOffers, RewardsClient } from '../../api/rewards/types';
import type { Wallet, WalletClient } from '../../api/wallet/types';
import {
  getAuthSessionRevision,
  getSessionCredential,
  subscribeAuthSession,
} from '../../auth/session';
import { useMessages } from '../../localization/messages';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';
import { readPendingRewardAttempt } from '../rewards/pendingRewardAttempt';
import {
  clearPendingCoinUnlock,
  readPendingCoinUnlock,
  writePendingCoinUnlock,
  type PendingCoinUnlock,
} from './pendingCoinUnlock';

interface Snapshot {
  readonly title: string;
  readonly profileId: string;
  readonly adsConsent: boolean;
  readonly offer: EpisodeOffers;
  readonly wallet: Wallet | null;
}

export interface EpisodeUnlockScreenProps {
  readonly episodeId: string;
  readonly catalog: CatalogClient;
  readonly me: MeClient;
  readonly rewards: RewardsClient;
  readonly wallet: WalletClient;
  readonly playback: PlaybackClient;
  readonly adsEnabled: boolean;
  readonly coinsEnabled: boolean;
  readonly onClose: () => void;
  readonly onAccount: () => void;
  readonly onWallet: () => void;
  readonly onAd: (episodeId: string) => void;
  readonly onPlay: (episodeId: string) => void;
}

function validOffer(offer: EpisodeOffers, episodeId: string): boolean {
  return (
    offer?.episode_id === episodeId &&
    (offer.decision === 'granted' || offer.decision === 'locked') &&
    Array.isArray(offer.methods)
  );
}

function coinPrice(offer: EpisodeOffers): number | null {
  return offer.decision === 'locked' &&
    offer.methods.some((method) => method?.type === 'coin') &&
    /^[0-9a-f]{64}$/.test(offer.policy_version) &&
    Number.isSafeInteger(offer.coin_price) &&
    offer.coin_price !== null &&
    offer.coin_price > 0 &&
    offer.coin_price <= 2147483647
    ? offer.coin_price
    : null;
}

export function EpisodeUnlockScreen({
  episodeId,
  catalog,
  me,
  rewards,
  wallet,
  playback,
  adsEnabled,
  coinsEnabled,
  onClose,
  onAccount,
  onWallet,
  onAd,
  onPlay,
}: EpisodeUnlockScreenProps): JSX.Element {
  const messages = useMessages();
  const copy = messages.unlock;
  const [revision] = useState(getAuthSessionRevision);
  const observedRevision = useSyncExternalStore(subscribeAuthSession, getAuthSessionRevision);
  const mounted = useRef(false);
  const leaving = useRef(false);
  const inFlight = useRef(false);
  const profileOwner = useRef<string | null>(null);
  const [invalidated, setInvalidated] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [pending, setPending] = useState<PendingCoinUnlock | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(true);
  const [rejectedReplayId, setRejectedReplayId] = useState<string | null>(null);
  const [message, setMessage] = useState(copy.loading);
  const sessionChanged = observedRevision !== revision || invalidated;

  const isCurrent = useCallback(
    () =>
      mounted.current &&
      !leaving.current &&
      revision === getAuthSessionRevision() &&
      getSessionCredential() !== null,
    [revision],
  );

  const acceptProfile = useCallback((profileId: string): boolean => {
    if (profileOwner.current !== null && profileOwner.current !== profileId) {
      setInvalidated(true);
      return false;
    }
    profileOwner.current = profileId;
    return true;
  }, []);

  const load = useCallback(async (): Promise<void> => {
    setSnapshot(null);
    setConfirming(false);
    setRecoveryReady(false);
    setPending(null);
    setMessage(copy.loading);
    if (!isCurrent()) {
      setMessage(messages.wallet.signIn);
      return;
    }
    const [episode, available, profile, balance] = await Promise.all([
      catalog.getEpisode(episodeId),
      rewards.offers(episodeId),
      me.getMe(),
      wallet.getWallet(),
    ]);
    if (!isCurrent()) return;
    if (profile.outcome === 'unauthenticated' || available.outcome === 'unauthenticated') {
      setMessage(messages.wallet.signIn);
      return;
    }
    if (
      episode.outcome !== 'ok' ||
      available.outcome !== 'ok' ||
      profile.outcome !== 'ok' ||
      episode.data.id !== episodeId ||
      !validOffer(available.data, episodeId)
    ) {
      setMessage(copy.unavailable);
      return;
    }
    if (!acceptProfile(profile.data.public_id)) return;
    // A delayed ad grant still needs the existing intent reconciliation and
    // consented grant analytics. Entering this path never shows another ad.
    if (available.data.decision === 'granted') {
      const pendingAd = await readPendingRewardAttempt(profile.data.public_id, episodeId);
      if (!isCurrent()) return;
      if (pendingAd !== null) {
        leaving.current = true;
        onAd(episodeId);
        return;
      }
    }
    setSnapshot({
      title: episode.data.title,
      profileId: profile.data.public_id,
      adsConsent: profile.data.ads_consent,
      offer: available.data,
      wallet: balance.outcome === 'ok' ? balance.data : null,
    });
    try {
      const attempt = await readPendingCoinUnlock(profile.data.public_id, episodeId);
      if (!isCurrent()) return;
      setPending(attempt);
      setRecoveryReady(true);
      setMessage(
        attempt !== null
          ? copy.pending
          : available.data.decision === 'granted'
            ? copy.alreadyUnlocked
            : balance.outcome !== 'ok'
              ? messages.wallet.unavailable
              : '',
      );
    } catch {
      if (isCurrent()) setMessage(copy.storageUnavailable);
    }
  }, [
    acceptProfile,
    catalog,
    copy,
    episodeId,
    isCurrent,
    me,
    messages.wallet,
    onAd,
    rewards,
    wallet,
  ]);

  async function run(task: () => Promise<void>): Promise<void> {
    if (inFlight.current || !isCurrent() || invalidated) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await task();
    } catch {
      if (isCurrent()) setMessage(copy.unavailable);
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    inFlight.current = true;
    void Promise.resolve()
      .then(load)
      .catch(() => {
        if (isCurrent()) setMessage(copy.unavailable);
      })
      .finally(() => {
        inFlight.current = false;
        if (mounted.current) setBusy(false);
      });
    return () => {
      mounted.current = false;
    };
  }, [copy.unavailable, isCurrent, load]);

  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && previous !== 'active' && isCurrent() && !inFlight.current) {
        // A foreground refresh also cancels any confirmation for old terms.
        inFlight.current = true;
        setBusy(true);
        void load()
          .catch(() => {
            if (isCurrent()) setMessage(copy.unavailable);
          })
          .finally(() => {
            inFlight.current = false;
            if (mounted.current) setBusy(false);
          });
      }
      previous = next;
    });
    return () => subscription.remove();
  }, [copy.unavailable, isCurrent, load]);

  function leave(action: () => void): void {
    leaving.current = true;
    action();
  }

  async function confirmPlayback(
    source: Snapshot,
    attempt: PendingCoinUnlock | null,
    requireBalance = false,
  ): Promise<void> {
    setSnapshot(null);
    setMessage(copy.verifying);
    // Never infer a balance or entitlement from the device or a previous receipt.
    const [balance, access, profile] = await Promise.all([
      wallet.getWallet(),
      rewards.offers(episodeId),
      me.getMe(),
    ]);
    if (!isCurrent()) return;
    if (profile.outcome !== 'ok' || !acceptProfile(profile.data.public_id)) {
      setSnapshot(null);
      setMessage(messages.wallet.signIn);
      return;
    }
    if (
      (requireBalance && balance.outcome !== 'ok') ||
      access.outcome !== 'ok' ||
      !validOffer(access.data, episodeId)
    ) {
      setSnapshot(null);
      setMessage(copy.playbackUnavailable);
      return;
    }
    setSnapshot({
      ...source,
      wallet: balance.outcome === 'ok' ? balance.data : null,
      offer: access.data,
    });
    if (access.data.decision !== 'granted') {
      setMessage(copy.playbackUnavailable);
      return;
    }
    const authorization = await playback.authorize(episodeId);
    if (!isCurrent()) return;
    if (authorization.outcome !== 'ok') {
      setMessage(copy.playbackUnavailable);
      return;
    }
    if (attempt !== null) {
      await clearPendingCoinUnlock(attempt);
      if (!isCurrent()) return;
      setPending(null);
    }
    // The player authorizes again on entry; never put media URLs in navigation.
    leave(() => onPlay(episodeId));
  }

  async function spend(): Promise<void> {
    if (
      snapshot === null ||
      !recoveryReady ||
      !coinsEnabled ||
      !snapshot.wallet?.spending_available
    )
      return;
    const price = coinPrice(snapshot.offer);
    if (pending === null && (!confirming || price === null || snapshot.wallet.balance < price))
      return;
    const source = snapshot;
    const recovering = pending !== null;
    let attempt = pending;
    const profile = await me.getMe();
    if (!isCurrent()) return;
    if (profile.outcome !== 'ok') {
      setSnapshot(null);
      setMessage(messages.wallet.signIn);
      return;
    }
    if (!acceptProfile(profile.data.public_id)) return;
    if (attempt === null) {
      attempt = {
        version: 1,
        profileId: source.profileId,
        request: {
          episode_id: episodeId,
          request_id: randomUUID(),
          expected_policy_version: source.offer.policy_version,
          expected_coin_price: price!,
        },
      };
      try {
        await writePendingCoinUnlock(attempt);
      } catch {
        if (isCurrent()) {
          setRecoveryReady(false);
          setMessage(copy.storageUnavailable);
        }
        return;
      }
      if (!isCurrent()) return;
      setPending(attempt);
    }
    setConfirming(false);
    setMessage(copy.verifying);
    const result = await wallet.unlock(attempt.request);
    if (!isCurrent()) return;
    if (result.outcome !== 'ok') {
      // A first-send rejection proves this request did not commit. After a lost
      // response, a replay rejection may instead reflect changed eligibility.
      if (
        !recovering &&
        result.outcome !== 'unreachable' &&
        [400, 404, 409].includes(result.httpStatus)
      ) {
        await clearPendingCoinUnlock(attempt);
        if (!isCurrent()) return;
        await load();
        if (isCurrent()) setMessage(copy.changed);
      } else if (
        recovering &&
        result.outcome !== 'unreachable' &&
        [400, 404, 409].includes(result.httpStatus)
      ) {
        setRejectedReplayId(attempt.request.request_id);
        setMessage(copy.unresolved(attempt.request.request_id));
      } else {
        setMessage(copy.pending);
      }
      return;
    }
    if (
      result.data.episode_id !== episodeId ||
      result.data.request_id !== attempt.request.request_id ||
      (result.data.charged_coins !== 0 &&
        result.data.charged_coins !== attempt.request.expected_coin_price)
    ) {
      setMessage(copy.pending);
      return;
    }
    await clearPendingCoinUnlock(attempt);
    if (!isCurrent()) return;
    setPending(null);
    await confirmPlayback(source, null, true);
  }

  const visible = sessionChanged ? null : snapshot;
  const price = visible === null ? null : coinPrice(visible.offer);
  const canSpend = coinsEnabled && visible?.wallet?.spending_available === true;
  const adAvailable =
    adsEnabled &&
    visible?.offer.decision === 'locked' &&
    visible.offer.methods.some((method) => method?.type === 'rewarded_ad');
  const displayMessage = sessionChanged
    ? messages.wallet.sessionChanged
    : pending !== null && pending.request.request_id === rejectedReplayId
      ? copy.unresolved(rejectedReplayId)
      : message;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Action label={messages.common.back} onPress={() => leave(onClose)} />
        <Text accessibilityRole="header" style={styles.title}>
          {copy.title}
        </Text>
        {busy && !sessionChanged ? <ActivityIndicator accessibilityLabel={copy.loading} /> : null}
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {displayMessage}
        </Text>
        {visible !== null ? (
          <>
            <Text accessibilityRole="header" style={styles.title}>
              {visible.title}
            </Text>
            {visible.wallet !== null ? (
              <Text style={styles.balance}>{messages.wallet.balance(visible.wallet.balance)}</Text>
            ) : null}
            {visible.offer.decision === 'granted' ? (
              <Action
                label={messages.common.play}
                onPress={() => {
                  void run(() => confirmPlayback(visible, pending));
                }}
                disabled={busy}
              />
            ) : (
              <>
                {pending !== null ? (
                  <Action
                    label={copy.checkPending}
                    onPress={() => {
                      void run(spend);
                    }}
                    disabled={busy || !canSpend || pending.request.request_id === rejectedReplayId}
                  />
                ) : (
                  <>
                    {price !== null && canSpend ? (
                      <>
                        <Text style={styles.body}>{copy.terms}</Text>
                        {visible.wallet!.balance < price ? (
                          <Text style={styles.body}>{copy.insufficient}</Text>
                        ) : confirming ? (
                          <>
                            <Action
                              label={copy.confirm(price)}
                              onPress={() => {
                                void run(spend);
                              }}
                              disabled={busy || !recoveryReady}
                            />
                            <Action
                              label={copy.cancel}
                              onPress={() => setConfirming(false)}
                              disabled={busy}
                            />
                          </>
                        ) : (
                          <Action
                            label={copy.coins(price)}
                            onPress={() => {
                              if (isCurrent()) setConfirming(true);
                            }}
                            disabled={busy || !recoveryReady}
                          />
                        )}
                      </>
                    ) : null}
                    {adAvailable ? (
                      <Action
                        label={copy.watchAd}
                        onPress={() => {
                          if (!isCurrent()) return;
                          leave(visible.adsConsent ? () => onAd(episodeId) : onAccount);
                        }}
                        disabled={busy || confirming}
                      />
                    ) : null}
                    {!adAvailable && !(price !== null && canSpend) ? (
                      <Text style={styles.body}>{copy.noMethods}</Text>
                    ) : null}
                  </>
                )}
                {!canSpend && (price !== null || pending !== null) ? (
                  <Text style={styles.body}>{messages.wallet.spendingUnavailable}</Text>
                ) : null}
              </>
            )}
          </>
        ) : null}
        {!sessionChanged ? (
          <Action
            label={copy.refresh}
            onPress={() => {
              void run(load);
            }}
            disabled={busy || getSessionCredential() === null}
          />
        ) : null}
        <Action label={messages.wallet.title} onPress={() => leave(onWallet)} disabled={busy} />
        <Action label={messages.common.account} onPress={() => leave(onAccount)} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({
  label,
  onPress,
  disabled = false,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, disabled && styles.disabled]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.lg },
  title: { color: colors.foreground, fontSize: fontSizes.title, fontWeight: '600' },
  balance: { color: colors.foreground, fontSize: fontSizes.section },
  body: { color: colors.muted, fontSize: fontSizes.body },
  action: {
    minHeight: minimumTouchTarget,
    padding: spacing.md,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  actionText: { color: colors.foreground, fontSize: fontSizes.body, textAlign: 'center' },
  disabled: { opacity: 0.5 },
});
