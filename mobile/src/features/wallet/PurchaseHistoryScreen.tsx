import type { JSX } from 'react';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PurchaseHistory, PurchasesClient } from '../../api/purchases/types';
import {
  getAuthSessionRevision,
  getSessionCredential,
  subscribeAuthSession,
} from '../../auth/session';
import { useMessages } from '../../localization/messages';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';
import { useCatalogQuery } from '../catalog/useCatalog';

type HistoryState =
  | { readonly phase: 'loading' | 'unavailable' | 'unauthenticated' }
  | { readonly phase: 'ready'; readonly history: PurchaseHistory };

export interface PurchaseHistoryScreenProps {
  readonly client: PurchasesClient;
  readonly onBack: () => void;
  readonly onAccount: () => void;
  readonly onReturnToEpisode?: (() => void) | undefined;
}

export function PurchaseHistoryScreen({
  client,
  onBack,
  onAccount,
  onReturnToEpisode,
}: PurchaseHistoryScreenProps): JSX.Element {
  const messages = useMessages();
  const copy = messages.purchases;
  const [owner] = useState(getAuthSessionRevision);
  const revision = useSyncExternalStore(subscribeAuthSession, getAuthSessionRevision);
  const sessionChanged = revision !== owner;

  const load = useCallback(async (): Promise<HistoryState> => {
    if (getAuthSessionRevision() !== owner || getSessionCredential() === null) {
      return { phase: 'unauthenticated' };
    }
    try {
      const result = await client.getHistory();
      if (getAuthSessionRevision() !== owner) return { phase: 'unauthenticated' };
      if (result.outcome === 'ok') return { phase: 'ready', history: result.data };
      return { phase: result.outcome === 'unauthenticated' ? 'unauthenticated' : 'unavailable' };
    } catch {
      return { phase: 'unavailable' };
    }
  }, [client, owner]);
  // The shared query clears rows on refresh and ignores replaced or unmounted requests.
  const { state, refresh: refreshQuery } = useCatalogQuery(load);
  const refresh = useCallback(() => {
    if (getAuthSessionRevision() === owner) refreshQuery();
  }, [owner, refreshQuery]);

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
    <SafeAreaView style={styles.container} testID="purchase-history-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.title}
        </Text>
        <Text style={styles.muted}>{copy.historyExplanation}</Text>
        <View accessibilityLiveRegion="polite" style={styles.summary}>
          {sessionChanged ? (
            <Text style={styles.body}>{copy.sessionChanged}</Text>
          ) : state.phase === 'ready' ? (
            <>
              {state.history.has_more ? <Text style={styles.body}>{copy.latestOnly}</Text> : null}
              {state.history.purchases.length === 0 ? (
                <Text style={styles.body}>{copy.empty}</Text>
              ) : null}
              {state.history.purchases.map((purchase) => (
                <View key={purchase.support_reference} style={styles.record}>
                  <Text style={styles.credit}>
                    {copy.historicalCoins(purchase.historical_credited_coins)}
                  </Text>
                  <Text style={styles.body}>{copy.recordedAt(purchase.recorded_at)}</Text>
                  <Text style={styles.body}>
                    {purchase.status === 'credited' ? copy.credited : copy.reviewRequired}
                  </Text>
                  <Text selectable style={styles.muted}>
                    {copy.supportReference(purchase.support_reference)}
                  </Text>
                </View>
              ))}
            </>
          ) : state.phase === 'loading' ? (
            <Text style={styles.body}>{copy.loading}</Text>
          ) : state.phase === 'unavailable' ? (
            <Text style={styles.body}>{copy.unavailable}</Text>
          ) : (
            <Text style={styles.body}>{copy.signIn}</Text>
          )}
        </View>
        {!requiresSignIn ? (
          <Action label={copy.refresh} disabled={state.phase === 'loading'} onPress={refresh} />
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
  credit: { color: colors.foreground, fontSize: fontSizes.body, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  muted: { color: colors.muted, fontSize: fontSizes.label },
  record: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  summary: { gap: spacing.lg },
  title: { color: colors.foreground, fontSize: fontSizes.title, fontWeight: '600' },
});
