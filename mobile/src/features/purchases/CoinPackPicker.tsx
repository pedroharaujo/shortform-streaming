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
                          style={[styles.coin, { left: layer * 8, top: (2 - layer) * 5 }]}
                        >
                          <CoinIcon size={32} />
                        </View>
                      ))}
                    </View>
                    <View style={styles.quantity}>
                      <Text style={styles.amount}>{offer.coins.toLocaleString('en-US')}</Text>
                      <Text style={styles.muted}>{messages.coinStore.coinUnit}</Text>
                    </View>
                    <Text style={styles.price}>{offer.price}</Text>
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
  heading: { color: colors.foreground, fontSize: fontSizes.section, fontWeight: '700' },
  list: { gap: spacing.md },
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
  best: { borderColor: colors.coinRim },
  selected: {
    borderColor: colors.coin,
    backgroundColor: colors.coinSurface,
    borderWidth: 2,
    padding: spacing.lg - 1,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.coin,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: { color: colors.coinInk, fontSize: fontSizes.caption, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  art: { width: 50, height: 44 },
  coin: { position: 'absolute' },
  quantity: { flexGrow: 1, flexShrink: 1, maxWidth: '100%', gap: 2 },
  amount: {
    color: colors.foreground,
    fontSize: fontSizes.display,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  price: {
    color: colors.foreground,
    maxWidth: '100%',
    fontSize: fontSizes.section,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
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
