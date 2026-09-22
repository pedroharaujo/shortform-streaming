import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMessages } from '../../localization/messages';
import { CoinIcon } from '../../ui/CoinIcon';
import { ActionButton } from '../../ui/ScreenElements';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';
import type { CheckoutOffer } from './types';

/** Shared presentation only: selection never purchases or grants coins. Server order is kept. */
export function CoinPackPicker({
  offers,
  selection,
  onSelect,
  onCheckout,
  preview = false,
}: {
  readonly offers: readonly CheckoutOffer[];
  readonly selection: string | null;
  readonly onSelect: (id: string) => void;
  readonly onCheckout: () => void;
  readonly preview?: boolean;
}): JSX.Element {
  const messages = useMessages();
  const selected = offers.find((offer) => offer.productId === selection);
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {messages.coinStore.choosePack}
      </Text>
      {offers.length === 0 ? (
        <Text style={styles.muted}>{messages.coinStore.empty}</Text>
      ) : (
        <>
          <View style={styles.list}>
            {offers.map((offer, index) => {
              const featured = offer.highlighted;
              const checked = selection === offer.productId;
              const extraLabel =
                offer.bonusPercent > 0 ? messages.coinStore.moreCoins(offer.bonusPercent) : null;
              const badgeLabel = offer.badge.trim() || null;
              const label = preview
                ? messages.purchasePreview.packLabel(offer.coins, offer.price)
                : `${messages.coinPacks.coins(offer.coins)} \u00b7 ${offer.price}`;
              return (
                <Pressable
                  key={offer.productId}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityHint={[badgeLabel, extraLabel].filter(Boolean).join('. ')}
                  accessibilityState={{ checked }}
                  onPress={() => onSelect(offer.productId)}
                  style={({ pressed }) => [
                    styles.card,
                    featured && styles.featured,
                    checked && styles.selected,
                    pressed && styles.pressed,
                  ]}
                >
                  {badgeLabel ? (
                    <View
                      style={[styles.badge, featured ? styles.badgeFeatured : styles.badgeQuiet]}
                    >
                      <Text style={[styles.badgeText, !featured && styles.badgeTextQuiet]}>
                        {badgeLabel}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.row}>
                    <View
                      accessible={false}
                      importantForAccessibility="no-hide-descendants"
                      style={styles.art}
                    >
                      {Array.from({ length: Math.min(index + 1, 3) }, (_, layer) => (
                        <View
                          key={layer}
                          style={[styles.coin, { left: 6 + layer * 7, top: 6 + (2 - layer) * 4 }]}
                        >
                          <CoinIcon size={26} />
                        </View>
                      ))}
                    </View>
                    <View style={styles.quantity}>
                      <View style={styles.amountRow}>
                        <Text style={styles.amount}>{offer.coins.toLocaleString('en-US')}</Text>
                        <Text style={styles.unit}>{messages.coinStore.coinUnit}</Text>
                      </View>
                      {extraLabel ? <Text style={styles.extra}>{extraLabel}</Text> : null}
                    </View>
                    <View style={[styles.pricePill, checked && styles.pricePillSelected]}>
                      <Text style={[styles.price, checked && styles.priceSelected]}>
                        {offer.price}
                      </Text>
                    </View>
                    <View style={[styles.radio, checked && styles.radioSelected]}>
                      {checked ? <View style={styles.radioDot} /> : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <ActionButton
            tone="primary"
            disabled={!selected}
            label={
              selected
                ? (preview ? messages.coinStore.previewBuy : messages.coinStore.buy)(
                    selected.coins,
                    selected.price,
                  )
                : messages.coinStore.selectPack
            }
            onPress={onCheckout}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xl },
  heading: {
    color: colors.foreground,
    fontSize: fontSizes.section,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  list: { gap: spacing.xxl, paddingTop: spacing.lg },
  card: {
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + spacing.xs,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featured: {
    borderColor: colors.coinRim,
    experimental_backgroundImage: `linear-gradient(90deg, ${colors.brandSoft} 0%, ${colors.surface} 60%)`,
  },
  selected: {
    borderColor: colors.coin,
    backgroundColor: colors.coinSurface,
    borderWidth: 2,
    paddingHorizontal: spacing.lg - 1,
    paddingTop: spacing.xl + spacing.xs - 1,
    paddingBottom: spacing.xl - 1,
  },
  badge: {
    position: 'absolute',
    top: -11,
    left: spacing.lg,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
  },
  badgeFeatured: { backgroundColor: colors.coin },
  badgeQuiet: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1 },
  badgeText: {
    color: colors.coinInk,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  badgeTextQuiet: { color: colors.foreground },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  art: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.brandSoft,
    borderColor: colors.coinRim,
    borderWidth: 1,
    overflow: 'hidden',
  },
  coin: { position: 'absolute' },
  quantity: { flexGrow: 1, flexShrink: 1, maxWidth: '100%', gap: 2 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, flexWrap: 'wrap' },
  amount: {
    color: colors.foreground,
    fontSize: fontSizes.title,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  unit: { color: colors.coin, fontSize: fontSizes.caption, fontWeight: '700' },
  pricePill: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: '100%',
  },
  pricePillSelected: { backgroundColor: colors.coin },
  price: {
    color: colors.foreground,
    fontSize: fontSizes.section,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  priceSelected: { color: colors.coinInk },
  extra: { color: colors.coin, fontSize: fontSizes.caption, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: fontSizes.label, lineHeight: 22 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.coin },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coin },
  pressed: { opacity: 0.75 },
});
