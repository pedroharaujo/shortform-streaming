import ArrowDownLeft from 'lucide-react-native/icons/arrow-down-left';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import Plus from 'lucide-react-native/icons/plus';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import X from 'lucide-react-native/icons/x';
import type { JSX, ReactNode } from 'react';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Wallet, WalletActivity, WalletClient } from '../../api/wallet/types';
import type { MeClient } from '../../api/me/types';
import {
  getAuthSessionRevision,
  getSessionCredential,
  subscribeAuthSession,
} from '../../auth/session';
import { useMessages } from '../../localization/messages';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';
import { ActionButton as Action, BackButton } from '../../ui/ScreenElements';
import { CoinIcon } from '../../ui/CoinIcon';
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
  readonly onPendingUnlock: (episodeId: string) => void;
  readonly renderPacks?: ((refreshBalance: () => void) => ReactNode) | undefined;
  readonly onReturnToEpisode?: (() => void) | undefined;
}

export function WalletScreen({
  client,
  me,
  onBack,
  onAccount,
  onPendingUnlock,
  renderPacks,
  onReturnToEpisode,
}: WalletScreenProps): JSX.Element {
  const messages = useMessages();
  const [owner] = useState(getAuthSessionRevision);
  const revision = useSyncExternalStore(subscribeAuthSession, getAuthSessionRevision);
  const sessionChanged = revision !== owner;
  const [packsOpen, setPacksOpen] = useState(false);

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
  const loadActivity = useCallback(async (): Promise<
    | { readonly phase: 'loading' | 'unavailable' | 'unauthenticated' }
    | { readonly phase: 'ready'; readonly activity: WalletActivity }
  > => {
    if (getAuthSessionRevision() !== owner || getSessionCredential() === null) {
      return { phase: 'unauthenticated' };
    }
    try {
      const result = await client.getActivity();
      if (getAuthSessionRevision() !== owner) return { phase: 'unauthenticated' };
      if (result.outcome === 'ok') return { phase: 'ready', activity: result.data };
      return { phase: result.outcome === 'unauthenticated' ? 'unauthenticated' : 'unavailable' };
    } catch {
      return { phase: 'unavailable' };
    }
  }, [client, owner]);
  const { state: activity, refresh: refreshActivity } = useCatalogQuery(loadActivity);
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
      refreshActivity();
    }
  }, [owner, refreshActivity, refreshQuery, refreshRecovery]);

  useEffect(() => {
    let appState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && appState !== 'active') refresh();
      appState = next;
    });
    return () => subscription.remove();
  }, [refresh]);

  const requiresSignIn =
    sessionChanged || getSessionCredential() === null || state.phase === 'unauthenticated';
  const refreshing = state.phase === 'loading';

  return (
    <SafeAreaView style={styles.container} testID="wallet-screen">
      <ScrollView contentContainerStyle={styles.content} testID="wallet-scroll">
        <BackButton label={messages.common.back} onPress={onBack} />
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={styles.title}>
            {messages.coinStore.title}
          </Text>
          <Text style={styles.subtitle}>{messages.wallet.subtitle}</Text>
        </View>

        <View accessibilityLiveRegion="polite" style={styles.summary}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceEyebrow}>
              {messages.coinStore.balanceLabel.toUpperCase()}
            </Text>
            {!requiresSignIn ? (
              <Pressable
                accessibilityLabel={messages.wallet.refresh}
                accessibilityRole="button"
                accessibilityState={{ disabled: refreshing }}
                disabled={refreshing}
                hitSlop={4}
                onPress={refresh}
                style={({ pressed }) => [
                  styles.iconButton,
                  refreshing && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <RefreshCw color={colors.muted} size={18} strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>
          {sessionChanged ? (
            <Text style={styles.body}>{messages.wallet.sessionChanged}</Text>
          ) : state.phase === 'ready' ? (
            <>
              <View style={styles.balanceRow}>
                <CoinIcon size={44} />
                <Text style={styles.balance} testID="wallet-balance">
                  {state.wallet.balance.toLocaleString('en-US')}
                  <Text style={styles.balanceUnit}> {messages.coinStore.coinUnit}</Text>
                </Text>
              </View>
              {!state.wallet.spending_available ? (
                <Text style={styles.muted}>{messages.wallet.spendingUnavailable}</Text>
              ) : null}
            </>
          ) : state.phase === 'loading' ? (
            <Text style={styles.body}>{messages.wallet.loading}</Text>
          ) : state.phase === 'unavailable' ? (
            <Text style={styles.body}>{messages.wallet.unavailable}</Text>
          ) : (
            <Text style={styles.body}>{messages.wallet.signIn}</Text>
          )}
          {!requiresSignIn && renderPacks ? (
            <Pressable
              accessibilityLabel={messages.wallet.topUp}
              accessibilityRole="button"
              onPress={() => setPacksOpen(true)}
              style={({ pressed }) => [styles.topUp, pressed && styles.pressed]}
              testID="wallet-top-up"
            >
              <Plus color={colors.onAccent} size={16} strokeWidth={3} />
              <Text style={styles.topUpLabel}>{messages.wallet.topUp}</Text>
            </Pressable>
          ) : !renderPacks ? (
            <Text style={styles.muted}>{messages.wallet.purchasesUnavailable}</Text>
          ) : null}
        </View>

        {requiresSignIn ? (
          <Action tone="primary" label={messages.common.signIn} onPress={onAccount} />
        ) : null}
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
        {onReturnToEpisode ? (
          <Action label={messages.wallet.backToEpisode} onPress={onReturnToEpisode} />
        ) : null}

        {!requiresSignIn && state.phase === 'ready' ? (
          <View style={styles.activity} testID="wallet-activity">
            <View style={styles.activityHeader}>
              <Text accessibilityRole="header" style={styles.activityTitle}>
                {activity.phase === 'ready' && activity.activity.entries.length > 0
                  ? `${messages.wallet.activityTitle} (${activity.activity.entries.length})`
                  : messages.wallet.activityTitle}
              </Text>
              {activity.phase === 'ready' && activity.activity.has_more ? (
                <Text style={styles.activityHint}>{messages.wallet.activityLatest}</Text>
              ) : null}
            </View>
            <View style={styles.activityList}>
              {activity.phase === 'loading' ? (
                <Text style={styles.activityEmpty}>{messages.wallet.activityLoading}</Text>
              ) : activity.phase === 'unavailable' ? (
                <Text style={styles.activityEmpty}>{messages.wallet.activityUnavailable}</Text>
              ) : activity.phase === 'ready' && activity.activity.entries.length === 0 ? (
                <Text style={styles.activityEmpty}>{messages.wallet.activityEmpty}</Text>
              ) : activity.phase === 'ready' ? (
                activity.activity.entries.map((entry, index) => {
                  const credit = entry.amount > 0;
                  const Arrow = credit ? ArrowDownLeft : ArrowUpRight;
                  return (
                    <View
                      key={entry.id}
                      style={[styles.activityRow, index > 0 && styles.activityDivider]}
                    >
                      <View
                        accessible={false}
                        style={[styles.activityIcon, credit ? styles.creditIcon : styles.debitIcon]}
                      >
                        <Arrow
                          color={credit ? colors.credit : colors.coin}
                          size={16}
                          strokeWidth={2}
                        />
                      </View>
                      <View style={styles.activityCopy}>
                        <Text numberOfLines={1} style={styles.activityLabel}>
                          {entry.kind === 'purchase'
                            ? messages.wallet.activityPurchase
                            : entry.kind === 'unlock'
                              ? messages.wallet.activityUnlock(entry.episode_title)
                              : messages.wallet.activityCorrection}
                        </Text>
                        <Text numberOfLines={1} style={styles.activityMeta}>
                          {`${messages.wallet.activityWhen(entry.created_at)} \u2022 ${messages.wallet.activityBalanceAfter(entry.balance_after)}`}
                        </Text>
                      </View>
                      <Text style={credit ? styles.activityCredit : styles.activityDebit}>
                        {messages.wallet.activityAmount(entry.amount)}
                      </Text>
                    </View>
                  );
                })
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
      {renderPacks ? (
        <Modal
          animationType="slide"
          onRequestClose={() => setPacksOpen(false)}
          transparent
          visible={packsOpen && !requiresSignIn}
        >
          <View style={styles.scrim}>
            <Pressable
              accessible={false}
              onPress={() => setPacksOpen(false)}
              style={StyleSheet.absoluteFill}
            />
            <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.sheet}>
              <ScrollView contentContainerStyle={styles.sheetContent} testID="wallet-packs">
                {renderPacks(refresh)}
              </ScrollView>
              <View style={styles.sheetClose}>
                <Pressable
                  accessibilityLabel={messages.wallet.closePacks}
                  accessibilityRole="button"
                  onPress={() => setPacksOpen(false)}
                  style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                  testID="wallet-packs-close"
                >
                  <X color={colors.muted} size={20} strokeWidth={2} />
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  activity: { gap: spacing.md },
  activityCopy: { flex: 1, gap: spacing.xxs },
  activityCredit: { color: colors.credit, fontSize: fontSizes.label, fontWeight: '800' },
  activityDebit: { color: colors.foreground, fontSize: fontSizes.label, fontWeight: '800' },
  activityDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  activityEmpty: {
    color: colors.muted,
    fontSize: fontSizes.label,
    padding: spacing.xxl,
    textAlign: 'center',
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  activityHint: { color: colors.placeholder, fontSize: fontSizes.caption },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityLabel: { color: colors.foreground, fontSize: fontSizes.label, fontWeight: '700' },
  activityList: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  activityMeta: { color: colors.placeholder, fontSize: 12 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  activityTitle: {
    color: colors.foreground,
    fontSize: fontSizes.caption,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  balance: {
    color: colors.foreground,
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1.5,
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
  balanceEyebrow: {
    color: colors.coin,
    fontSize: fontSizes.caption,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  balanceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  balanceUnit: {
    color: colors.coin,
    fontSize: fontSizes.label,
    fontWeight: '800',
    letterSpacing: 0,
  },
  body: { color: colors.foreground, fontSize: fontSizes.body },
  container: { backgroundColor: colors.background, flex: 1 },
  content: {
    flexGrow: 1,
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  creditIcon: { backgroundColor: colors.creditSoft, borderColor: colors.creditRim },
  debitIcon: { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' },
  disabled: { opacity: 0.5 },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: minimumTouchTarget,
    minWidth: minimumTouchTarget,
    marginVertical: -spacing.md,
    marginRight: -spacing.md,
  },
  intro: { gap: spacing.xs, marginTop: -spacing.sm },
  muted: { color: colors.muted, fontSize: fontSizes.label },
  pressed: { opacity: 0.75 },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.75)' },
  sheet: {
    maxHeight: '94%',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderTopWidth: 1,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  sheetClose: { position: 'absolute', top: spacing.md, right: spacing.lg },
  sheetContent: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl + spacing.xs,
    paddingBottom: spacing.xxl,
  },
  subtitle: { color: colors.muted, fontSize: fontSizes.label, lineHeight: 20 },
  summary: {
    gap: spacing.lg,
    padding: spacing.xxl,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    backgroundColor: colors.surface,
    experimental_backgroundImage: `linear-gradient(135deg, ${colors.surface} 0%, ${colors.surface} 45%, rgba(69, 26, 3, 0.55) 100%)`,
  },
  title: {
    color: colors.foreground,
    fontSize: fontSizes.title,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  topUp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: minimumTouchTarget,
    borderRadius: radii.md,
    backgroundColor: colors.brand,
    shadowColor: colors.brand,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  topUpLabel: { color: colors.onAccent, fontSize: fontSizes.label, fontWeight: '800' },
});
