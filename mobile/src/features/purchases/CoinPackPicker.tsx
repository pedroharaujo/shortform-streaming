import { useState, type JSX } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useMessages } from '../../localization/messages';
import { CoinIcon } from '../../ui/CoinIcon';
import { ActionButton } from '../../ui/ScreenElements';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';
import { bestValueProductId, coinsPerCurrencyUnit } from './offerValue';
import type { CheckoutOffer } from './types';

/** Shared presentation only: selection never purchases or grants coins. */
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
  const { fontScale } = useWindowDimensions();
  const [availableWidth, setAvailableWidth] = useState(0);
  const useGrid = availableWidth >= 344 && fontScale <= 1.1;
  const best = bestValueProductId(offers);
  const selected = offers.find((offer) => offer.productId === selection);
  const ordered = [...offers].sort((a, b) => a.coins - b.coins);
  return (
    <View
      style={styles.section}
      onLayout={({ nativeEvent }) => setAvailableWidth(nativeEvent.layout.width)}
    >
      <Text accessibilityRole="header" style={styles.heading}>
        {messages.coinStore.choosePack}
      </Text>
      {offers.length === 0 ? (
        <Text style={styles.muted}>{messages.coinStore.empty}</Text>
      ) : (
        <>
          <View style={[styles.list, useGrid && styles.grid]}>
            {ordered.map((offer, index) => {
              const isBest = best === offer.productId;
              const checked = selection === offer.productId;
              const rate = coinsPerCurrencyUnit(offer);
              const rateLabel =
                rate !== null && offer.currencyCode
                  ? messages.coinStore.rate(rate, offer.currencyCode)
                  : null;
              const label = preview
                ? messages.purchasePreview.packLabel(offer.coins, offer.price)
                : `${messages.coinPacks.coins(offer.coins)} \u00b7 ${offer.price}`;
              return (
                <Pressable
                  key={offer.productId}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityHint={[isBest ? messages.coinStore.bestValue : null, rateLabel]
                    .filter(Boolean)
                    .join('. ')}
                  accessibilityState={{ checked }}
                  onPress={() => onSelect(offer.productId)}
                  style={({ pressed }) => [
                    styles.card,
                    useGrid && styles.gridCard,
                    isBest && styles.best,
                    checked && styles.selected,
                    pressed && styles.pressed,
                  ]}
                >
                  {isBest ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{messages.coinStore.bestValue}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.row, useGrid && styles.gridRow]}>
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
                    </View>
                    <View style={[styles.pricePill, checked && styles.pricePillSelected]}>
                      <Text style={[styles.price, checked && styles.priceSelected]}>
                        {offer.price}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        useGrid && styles.gridRadio,
                        checked && styles.radioSelected,
                      ]}
                    >
                      {checked ? <View style={styles.radioDot} /> : null}
                    </View>
                  </View>
                  {rateLabel ? <Text style={styles.rate}>{rateLabel}</Text> : null}
                </Pressable>
              );
            })}
          </View>
          {best ? <Text style={styles.note}>{messages.coinStore.valueExplanation}</Text> : null}
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
  section: { gap: spacing.lg },
  heading: {
    color: colors.foreground,
    fontSize: fontSizes.section,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  list: { gap: spacing.lg, paddingTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCard: { flexBasis: '47%', flexGrow: 1, minWidth: 160 },
  gridRow: { flexDirection: 'column', alignItems: 'flex-start', gap: spacing.md },
  gridRadio: { position: 'absolute', top: spacing.xs, right: 0 },
  card: {
    minHeight: minimumTouchTarget,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  best: {
    borderColor: colors.coinRim,
    experimental_backgroundImage: `linear-gradient(90deg, ${colors.brandSoft} 0%, ${colors.surface} 60%)`,
  },
  selected: {
    borderColor: colors.coin,
    backgroundColor: colors.coinSurface,
    borderWidth: 2,
    padding: spacing.lg - 1,
  },
  badge: {
    position: 'absolute',
    top: -11,
    left: spacing.lg,
    backgroundColor: colors.coin,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
  },
  badgeText: {
    color: colors.coinInk,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  art: {
    width: 52,
    height: 52,
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
    fontSize: fontSizes.label,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  priceSelected: { color: colors.coinInk },
  muted: { color: colors.muted, fontSize: fontSizes.label, lineHeight: 22 },
  rate: { color: colors.muted, fontSize: fontSizes.caption, lineHeight: 20 },
  note: { color: colors.muted, fontSize: fontSizes.caption, lineHeight: 20 },
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
