import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type JSX } from 'react';
import { AppState, Pressable, StyleSheet, Text } from 'react-native';

import type { WalletClient } from '../../api/wallet/types';
import { getAuthSessionRevision, getSessionCredential } from '../../auth/session';
import { CoinIcon } from '../../ui/CoinIcon';
import { useMessages } from '../../localization/messages';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';

type BalanceState =
  | { readonly phase: 'loading' | 'unavailable' }
  | { readonly phase: 'ready'; readonly balance: number };

/** Mounted by Home only for the current signed-in session, keyed by its revision. */
export function HomeWalletButton({
  client,
  owner,
  onPress,
}: {
  readonly client: WalletClient;
  readonly owner: number;
  readonly onPress: () => void;
}): JSX.Element {
  const messages = useMessages();
  const [state, setState] = useState<BalanceState>({ phase: 'loading' });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let request = 0;
      const ownsSession = () =>
        getAuthSessionRevision() === owner && getSessionCredential() !== null;
      const refresh = async () => {
        if (!ownsSession()) return;
        const current = ++request;
        setState({ phase: 'loading' });
        try {
          const result = await client.getWallet();
          if (!active || current !== request || !ownsSession()) return;
          setState(
            result.outcome === 'ok'
              ? { phase: 'ready', balance: result.data.balance }
              : { phase: 'unavailable' },
          );
        } catch {
          if (active && current === request && ownsSession()) setState({ phase: 'unavailable' });
        }
      };
      void refresh();
      let previous = AppState.currentState;
      const subscription = AppState.addEventListener('change', (next) => {
        if (next === 'active' && previous !== 'active') void refresh();
        previous = next;
      });
      return () => {
        active = false;
        subscription.remove();
      };
    }, [client, owner]),
  );

  const label =
    state.phase === 'ready'
      ? messages.wallet.shortcutBalance(state.balance)
      : state.phase === 'loading'
        ? messages.wallet.loading
        : messages.wallet.shortcutUnavailable;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={messages.wallet.openWallet}
      accessibilityState={{ busy: state.phase === 'loading' }}
      onPress={() => {
        if (getAuthSessionRevision() === owner && getSessionCredential() !== null) onPress();
      }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      testID="home-wallet"
    >
      <CoinIcon />
      <Text style={styles.label} numberOfLines={1}>
        {state.phase === 'ready'
          ? messages.wallet.shortBalance(state.balance)
          : state.phase === 'loading'
            ? '\u2026'
            : messages.wallet.shortcutTitle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: minimumTouchTarget,
    minWidth: minimumTouchTarget,
    maxWidth: 180,
    flexShrink: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  label: {
    color: colors.foreground,
    fontSize: fontSizes.label,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  pressed: { opacity: 0.75 },
});
