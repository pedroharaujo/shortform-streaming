import type { JSX } from 'react';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Wallet, WalletClient } from '../../api/wallet/types';
import type { MeClient } from '../../api/me/types';
import {
  getAuthSessionRevision,
  getSessionCredential,
  subscribeAuthSession,
} from '../../auth/session';
import { useMessages } from '../../localization/messages';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';
import { useCatalogQuery } from '../catalog/useCatalog';
import { readPendingCoinUnlockForProfile, type PendingCoinUnlock } from './pendingCoinUnlock';

type WalletState =
  | { readonly phase: 'loading' | 'unavailable' | 'unauthenticated' }
  | { readonly phase: 'ready'; readonly wallet: Wallet };

export interface WalletScreenProps {
  readonly client: WalletClient;
  readonly me: MeClient;
  readonly onBack: () => void;
  readonly onAccount: () => void;
  readonly onPurchases: () => void;
  readonly onPendingUnlock: (episodeId: string) => void;
  readonly onBuyCoins?: (() => void) | undefined;
  readonly onReturnToEpisode?: (() => void) | undefined;
}

export function WalletScreen({
  client,
  me,
  onBack,
  onAccount,
  onPurchases,
  onPendingUnlock,
  onBuyCoins,
  onReturnToEpisode,
}: WalletScreenProps): JSX.Element {
  const messages = useMessages();
  const [owner] = useState(getAuthSessionRevision);
  const revision = useSyncExternalStore(subscribeAuthSession, getAuthSessionRevision);
  const sessionChanged = revision !== owner;

  const load = useCallback(async (): Promise<WalletState> => {
    if (getAuthSessionRevision() !== owner || getSessionCredential() === null) {
      return { phase: 'unauthenticated' };
    }
    try {
      const result = await client.getWallet();
      if (getAuthSessionRevision() !== owner) return { phase: 'unauthenticated' };
      if (result.outcome === 'ok') {
        return { phase: 'ready', wallet: result.data };
      }
      return {
        phase: result.outcome === 'unauthenticated' ? 'unauthenticated' : 'unavailable',
      };
    } catch {
      return { phase: 'unavailable' };
    }
  }, [client, owner]);
  // Clear the prior balance on refresh; the shared query ignores replaced and unmounted requests.
  const { state, refresh: refreshQuery } = useCatalogQuery(load);
  const loadRecovery = useCallback(async (): Promise<
    | { readonly phase: 'ready'; readonly attempt: PendingCoinUnlock | null }
    | { readonly phase: 'unavailable' | 'unauthenticated' }
  > => {
    if (getAuthSessionRevision() !== owner || getSessionCredential() === null)
      return { phase: 'unauthenticated' };
    try {
      const profile = await me.getMe();
      if (getAuthSessionRevision() !== owner) return { phase: 'unauthenticated' };
      if (profile.outcome !== 'ok')
        return { phase: profile.outcome === 'unauthenticated' ? 'unauthenticated' : 'unavailable' };
      const attempt = await readPendingCoinUnlockForProfile(profile.data.public_id);
      if (getAuthSessionRevision() !== owner) return { phase: 'unauthenticated' };
      return { phase: 'ready', attempt };
    } catch {
      return { phase: 'unavailable' };
    }
  }, [me, owner]);
  const { state: recovery, refresh: refreshRecovery } = useCatalogQuery(loadRecovery);
  const refresh = useCallback(() => {
    if (getAuthSessionRevision() === owner) {
      refreshQuery();
      refreshRecovery();
    }
  }, [owner, refreshQuery, refreshRecovery]);

  useEffect(() => {
    let appState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && appState !== 'active') refresh();
      appState = next;
    });
    return () => subscription.remove();
  }, [refresh]);

  const requiresSignIn = sessionChanged || state.phase === 'unauthenticated';

  return (
    <SafeAreaView style={styles.container} testID="wallet-screen">
      <ScrollView contentContainerStyle={styles.content} testID="wallet-scroll">
        <Text accessibilityRole="header" style={styles.title}>
          {messages.wallet.title}
        </Text>
        <View accessibilityLiveRegion="polite" style={styles.summary}>
          {sessionChanged ? (
            <Text style={styles.body}>{messages.wallet.sessionChanged}</Text>
          ) : state.phase === 'ready' ? (
            <>
              <Text style={styles.balance} testID="wallet-balance">
                {messages.wallet.balance(state.wallet.balance)}
              </Text>
              {!state.wallet.spending_available ? (
                <Text style={styles.body}>{messages.wallet.spendingUnavailable}</Text>
              ) : null}
            </>
          ) : state.phase === 'loading' ? (
            <Text style={styles.body}>{messages.wallet.loading}</Text>
          ) : state.phase === 'unavailable' ? (
            <Text style={styles.body}>{messages.wallet.unavailable}</Text>
          ) : (
            <Text style={styles.body}>{messages.wallet.signIn}</Text>
          )}
        </View>
        {!sessionChanged && recovery.phase === 'ready' && recovery.attempt !== null ? (
          <Action
            label={messages.unlock.checkPending}
            onPress={() => {
              if (getAuthSessionRevision() === owner && getSessionCredential() !== null)
                onPendingUnlock(recovery.attempt!.request.episode_id);
            }}
          />
        ) : !sessionChanged && recovery.phase === 'unavailable' ? (
          <>
            <Text style={styles.body}>{messages.wallet.recoveryUnavailable}</Text>
            <Action label={messages.wallet.retryRecovery} onPress={refreshRecovery} />
          </>
        ) : null}
        {onBuyCoins && !requiresSignIn ? (
          <Action label={messages.coinPacks.title} onPress={onBuyCoins} />
        ) : !onBuyCoins ? (
          <Text style={styles.muted}>{messages.wallet.purchasesUnavailable}</Text>
        ) : null}
        <Action label={messages.purchases.title} onPress={onPurchases} />
        {!requiresSignIn ? (
          <Action
            label={messages.wallet.refresh}
            disabled={state.phase === 'loading'}
            onPress={refresh}
          />
        ) : null}
        <Action
          label={requiresSignIn ? messages.common.signIn : messages.common.account}
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
  disabled = false,
  onPress,
}: {
  readonly label: string;
  readonly disabled?: boolean;
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

const styles = StyleSheet.create({
  balance: { color: colors.foreground, fontSize: fontSizes.title, fontWeight: '600' },
  body: { color: colors.foreground, fontSize: fontSizes.body },
  button: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  container: { backgroundColor: colors.background, flex: 1 },
  content: { flexGrow: 1, gap: spacing.lg, padding: spacing.xxl },
  disabled: { opacity: 0.5 },
  muted: { color: colors.muted, fontSize: fontSizes.label },
  summary: { gap: spacing.lg },
  title: { color: colors.foreground, fontSize: fontSizes.title, fontWeight: '600' },
});
