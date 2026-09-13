import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getAuthSessionRevision,
  getSessionCredential,
  subscribeAuthSession,
} from '../../auth/session';
import { useMessages } from '../../localization/messages';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';
import type { CheckoutCoordinator, CheckoutState } from './types';

export interface CoinPacksScreenProps {
  readonly coordinator: CheckoutCoordinator;
  readonly onBack: () => void;
  readonly onAccount: () => void;
  readonly onWallet: () => void;
  readonly onPurchases?: (() => void) | undefined;
  readonly onReturnToEpisode?: (() => void) | undefined;
}

export function CoinPacksScreen({
  coordinator,
  onBack,
  onAccount,
  onWallet,
  onPurchases,
  onReturnToEpisode,
}: CoinPacksScreenProps): JSX.Element {
  const messages = useMessages();
  const [owner] = useState(getAuthSessionRevision);
  const revision = useSyncExternalStore(subscribeAuthSession, getAuthSessionRevision);
  const mounted = useRef(false);
  const running = useRef(false);
  const [state, setState] = useState<CheckoutState | null>(null);
  const sessionChanged = revision !== owner;
  const signedOut = getSessionCredential() === null;
  const requiresAccount = sessionChanged || signedOut || state?.status === 'session_changed';

  const run = useCallback(
    (operation: () => Promise<CheckoutState>) => {
      if (running.current || getAuthSessionRevision() !== owner || getSessionCredential() === null)
        return;
      running.current = true;
      return Promise.resolve()
        .then(operation)
        .then(
          (result) => {
            if (mounted.current && getAuthSessionRevision() === owner) setState(result);
          },
          () => {
            // An unexpected error is never evidence that a purchase was cancelled.
            if (mounted.current && getAuthSessionRevision() === owner)
              setState({ status: 'awaiting_verification' });
          },
        )
        .finally(() => {
          running.current = false;
        });
    },
    [owner],
  );

  useEffect(() => {
    mounted.current = true;
    void run(() => coordinator.load());
    return () => {
      mounted.current = false;
    };
  }, [coordinator, run]);

  const begin = (operation: () => Promise<CheckoutState>) => {
    if (running.current || getAuthSessionRevision() !== owner || getSessionCredential() === null)
      return;
    setState(null);
    void run(operation);
  };
  const checkPurchase = () => {
    begin(() => coordinator.sync());
  };
  const reload = () => {
    begin(() => coordinator.load());
  };
  const retryable =
    state?.status === 'cancelled' ||
    state?.status === 'unavailable' ||
    state?.status === 'busy' ||
    state?.status === 'storage_unavailable';

  return (
    <SafeAreaView style={styles.container} testID="coin-packs-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {messages.coinPacks.title}
        </Text>
        <View accessibilityLiveRegion="polite" style={styles.summary}>
          {requiresAccount ? (
            <Text style={styles.body}>
              {signedOut ? messages.wallet.signIn : messages.wallet.sessionChanged}
            </Text>
          ) : state === null ? (
            <Text style={styles.body}>{messages.coinPacks.loading}</Text>
          ) : state.status === 'ready' ? (
            <>
              <Text style={styles.body}>{messages.coinPacks.description}</Text>
              {state.offers.map((offer) => (
                <Pressable
                  key={offer.productId}
                  accessibilityRole="button"
                  accessibilityLabel={`${messages.coinPacks.coins(offer.coins)} · ${offer.price}`}
                  onPress={() => {
                    begin(() => coordinator.purchase(offer.productId));
                  }}
                  style={styles.button}
                >
                  <Text style={styles.body}>{messages.coinPacks.coins(offer.coins)}</Text>
                  <Text style={styles.price}>{offer.price}</Text>
                </Pressable>
              ))}
            </>
          ) : state.status === 'credited' ? (
            <>
              <Text style={styles.body}>{messages.coinPacks.credited}</Text>
              {state.wallet.status === 'available' ? (
                <Text style={styles.price} testID="purchase-wallet-balance">
                  {messages.wallet.balance(state.wallet.data.balance)}
                </Text>
              ) : (
                <Text style={styles.body}>{messages.coinPacks.walletUnavailable}</Text>
              )}
              <Text style={styles.muted}>
                {messages.purchases.supportReference(state.supportReference)}
              </Text>
            </>
          ) : state.status === 'review_required' ? (
            <>
              <Text style={styles.body}>{messages.purchases.reviewRequired}</Text>
              <Text style={styles.muted}>
                {messages.purchases.supportReference(state.supportReference)}
              </Text>
            </>
          ) : (
            <Text style={styles.body}>
              {state.status === 'cancelled'
                ? messages.coinPacks.cancelled
                : state.status === 'busy'
                  ? messages.coinPacks.busy
                  : state.status === 'storage_unavailable'
                    ? messages.coinPacks.storageUnavailable
                    : state.status === 'awaiting_verification'
                      ? messages.coinPacks.pending
                      : messages.coinPacks.unavailable}
            </Text>
          )}
        </View>
        {!requiresAccount &&
        (state?.status === 'awaiting_verification' || state?.status === 'review_required') ? (
          <Action label={messages.coinPacks.checkPurchase} onPress={checkPurchase} />
        ) : null}
        {!requiresAccount && retryable ? (
          <Action label={messages.coinPacks.reload} onPress={reload} />
        ) : null}
        <Action label={messages.coinPacks.openWallet} onPress={onWallet} />
        {onPurchases ? <Action label={messages.purchases.title} onPress={onPurchases} /> : null}
        <Action
          label={requiresAccount ? messages.common.signIn : messages.common.account}
          onPress={onAccount}
        />
        {onReturnToEpisode ? (
          <Action label={messages.wallet.backToEpisode} onPress={onReturnToEpisode} />
        ) : null}
        <Action label={messages.common.back} onPress={onBack} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({
  label,
  onPress,
}: {
  readonly label: string;
  readonly onPress: () => void;
}): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.button}
    >
      <Text style={styles.body}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.foreground, fontSize: fontSizes.body },
  button: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  container: { backgroundColor: colors.background, flex: 1 },
  content: { flexGrow: 1, gap: spacing.lg, padding: spacing.xxl },
  muted: { color: colors.muted, fontSize: fontSizes.label },
  price: { color: colors.foreground, fontSize: fontSizes.title, fontWeight: '600' },
  summary: { gap: spacing.lg },
  title: { color: colors.foreground, fontSize: fontSizes.title, fontWeight: '600' },
});
