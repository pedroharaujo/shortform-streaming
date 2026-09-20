import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  getAuthSessionRevision,
  getSessionCredential,
  subscribeAuthSession,
} from '../../auth/session';
import { useMessages } from '../../localization/messages';
import { colors, fontSizes, spacing } from '../../ui/theme';
import { ActionButton as Action, panelStyles } from '../../ui/ScreenElements';
import { CoinPackPicker } from './CoinPackPicker';
import type { CheckoutCoordinator, CheckoutState } from './types';

export interface CoinPacksScreenProps {
  readonly coordinator: CheckoutCoordinator;
  readonly onBalanceRefresh: () => void;
}

export function CoinPacksScreen({
  coordinator,
  onBalanceRefresh,
}: CoinPacksScreenProps): JSX.Element {
  const messages = useMessages();
  const [owner] = useState(getAuthSessionRevision);
  const revision = useSyncExternalStore(subscribeAuthSession, getAuthSessionRevision);
  const mounted = useRef(false);
  const running = useRef(false);
  const [state, setState] = useState<CheckoutState | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const refreshBalance = useRef(onBalanceRefresh);
  useEffect(() => {
    refreshBalance.current = onBalanceRefresh;
  }, [onBalanceRefresh]);
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
            if (mounted.current && getAuthSessionRevision() === owner) {
              setState(result);
              if (result.status === 'credited' || result.status === 'review_required')
                refreshBalance.current();
            }
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
    setSelection(null);
    setState(null);
    void run(operation);
  };
  const checkPurchase = () => {
    begin(() => coordinator.sync());
  };
  const reload = () => {
    setPurchasing(false);
    begin(() => coordinator.load());
  };
  const retryable =
    state?.status === 'cancelled' ||
    state?.status === 'product_unavailable' ||
    state?.status === 'purchase_not_allowed' ||
    state?.status === 'unavailable' ||
    state?.status === 'busy' ||
    state?.status === 'storage_unavailable';

  return (
    <View style={styles.content} testID="coin-packs-screen">
      <View
        accessibilityLiveRegion="polite"
        style={[state?.status !== 'ready' && panelStyles.card, styles.summary]}
      >
        {requiresAccount ? (
          <Text style={styles.body}>
            {signedOut ? messages.wallet.signIn : messages.wallet.sessionChanged}
          </Text>
        ) : state === null ? (
          <Text style={styles.body}>
            {purchasing ? messages.coinStore.processing : messages.coinPacks.loading}
          </Text>
        ) : state.status === 'ready' ? (
          <>
            <CoinPackPicker
              offers={state.offers}
              selection={selection}
              onSelect={setSelection}
              onCheckout={() => {
                const offer = state.offers.find((item) => item.productId === selection);
                if (!offer) return;
                setPurchasing(true);
                begin(() => coordinator.purchase(offer.productId));
              }}
            />
            {state.offers.length > 0 ? (
              <Text style={styles.muted}>{messages.coinPacks.description}</Text>
            ) : (
              <Action label={messages.coinPacks.reload} onPress={reload} />
            )}
          </>
        ) : state.status === 'credited' ? (
          <>
            <Text style={styles.body}>{messages.coinPacks.credited}</Text>
            {state.wallet.status === 'unavailable' ? (
              <Text style={styles.body}>{messages.coinPacks.walletUnavailable}</Text>
            ) : null}
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
            {state.status === 'purchase_not_allowed'
              ? messages.coinPacks.purchaseNotAllowed
              : state.status === 'product_unavailable'
                ? messages.coinPacks.productUnavailable
                : state.status === 'cancelled'
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
      {!requiresAccount && state?.status === 'credited' ? (
        <Action label={messages.purchasePreview.again} onPress={reload} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.foreground, fontSize: fontSizes.body, lineHeight: 24 },
  content: { gap: spacing.lg },
  muted: { color: colors.muted, fontSize: fontSizes.label, lineHeight: 22 },
  summary: { gap: spacing.lg },
});
