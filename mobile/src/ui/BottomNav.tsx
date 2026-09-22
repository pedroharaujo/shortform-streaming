import type { JSX } from 'react';
import Film from 'lucide-react-native/icons/film';
import User from 'lucide-react-native/icons/user';
import Wallet from 'lucide-react-native/icons/wallet';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMessages } from '../localization/messages';
import { colors, minimumTouchTarget, spacing } from './theme';

export type BottomNavTab = 'browse' | 'coins' | 'account';

const tabIcon = {
  browse: Film,
  coins: Wallet,
  account: User,
} as const;

/** Same Lucide icons as the web bottom bar. Selected state uses amber-400. */
export function BottomNav({
  active,
  onNavigate,
}: {
  readonly active: BottomNavTab;
  readonly onNavigate: (tab: BottomNavTab) => void;
}): JSX.Element {
  const messages = useMessages();
  const tabs: readonly { readonly id: BottomNavTab; readonly label: string }[] = [
    { id: 'browse', label: messages.nav.home },
    { id: 'coins', label: messages.nav.wallet },
    { id: 'account', label: messages.nav.account },
  ];
  return (
    <SafeAreaView
      accessibilityRole="tablist"
      edges={['bottom', 'left', 'right']}
      style={styles.bar}
      testID="bottom-nav"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        const Icon = tabIcon[tab.id];
        const tint = selected ? colors.coin : colors.muted;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) onNavigate(tab.id);
            }}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            testID={`bottom-nav-${tab.id}`}
          >
            <Icon color={tint} size={20} strokeWidth={2} />
            <Text style={[styles.label, { color: tint }, selected && styles.labelSelected]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-around',
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: minimumTouchTarget,
    minWidth: minimumTouchTarget,
    paddingVertical: spacing.xs,
  },
  label: { fontSize: 11, fontWeight: '600' },
  labelSelected: { fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
