import { useState, type JSX } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMessages } from '../../localization/messages';
import { ActionButton, panelStyles } from '../../ui/ScreenElements';
import { CoinPackPicker } from './CoinPackPicker';
import { colors, fontSizes, radii, spacing } from '../../ui/theme';

// Illustrative design fixtures only: local UI identifiers only; no provider calls or wallet writes.
const examplePacks = [
  {
    productId: 'preview_100',
    coins: 100,
    price: '\u20ac0.99',
    priceAmount: 0.99,
    currencyCode: 'EUR',
  },
  {
    productId: 'preview_500',
    coins: 500,
    price: '\u20ac4.99',
    priceAmount: 4.99,
    currencyCode: 'EUR',
  },
  {
    productId: 'preview_1200',
    coins: 1200,
    price: '\u20ac9.99',
    priceAmount: 9.99,
    currencyCode: 'EUR',
  },
] as const;

export function CoinPurchasePreview(): JSX.Element {
  const messages = useMessages();
  const copy = messages.purchasePreview;
  const [selection, setSelection] = useState<string | null>(null);
  const [step, setStep] = useState<'packs' | 'confirm' | 'complete'>('packs');
  const selected = examplePacks.find((pack) => pack.productId === selection);

  return (
    <View testID="purchase-preview-screen">
      <View
        style={styles.content}
        accessibilityElementsHidden={step !== 'packs'}
        importantForAccessibility={step !== 'packs' ? 'no-hide-descendants' : 'auto'}
      >
        <View style={styles.notice}>
          <Text style={styles.previewLabel}>{copy.badge}</Text>
          <Text style={styles.muted}>{copy.notice}</Text>
        </View>
        <CoinPackPicker
          offers={examplePacks}
          selection={selection}
          onSelect={setSelection}
          preview
          onCheckout={() => {
            if (selected) setStep('confirm');
          }}
        />
      </View>
      <Modal
        visible={step !== 'packs'}
        transparent
        animationType="slide"
        onRequestClose={() => setStep('packs')}
      >
        <View style={styles.scrim}>
          <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.sheet}>
            <ScrollView contentContainerStyle={styles.sheetContent}>
              <Text style={styles.previewLabel}>{copy.badge}</Text>
              <Text accessibilityRole="header" style={styles.heading}>
                {step === 'complete' ? copy.complete : copy.confirmation}
              </Text>
              {step === 'complete' ? (
                <Text style={styles.body}>{copy.completeDescription}</Text>
              ) : selected ? (
                <>
                  <View style={panelStyles.card}>
                    <Text style={styles.coins}>{messages.coinPacks.coins(selected.coins)}</Text>
                    <Text style={styles.price}>{selected.price}</Text>
                    <Text style={styles.muted}>{copy.examplePack}</Text>
                  </View>
                  <Text style={styles.body}>{copy.notice}</Text>
                </>
              ) : null}
              {step === 'complete' ? (
                <>
                  <ActionButton
                    label={messages.coinStore.done}
                    tone="primary"
                    onPress={() => setStep('packs')}
                  />
                </>
              ) : (
                <>
                  <ActionButton
                    label={copy.simulate}
                    tone="primary"
                    onPress={() => setStep('complete')}
                  />
                  <ActionButton label={copy.cancel} onPress={() => setStep('packs')} />
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  notice: {
    gap: spacing.sm,
    borderLeftWidth: 3,
    borderColor: colors.coin,
    paddingLeft: spacing.lg,
  },
  previewLabel: { color: colors.coin, fontSize: fontSizes.caption, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: fontSizes.label, lineHeight: 22 },
  body: { color: colors.foreground, fontSize: fontSizes.body, lineHeight: 24 },
  heading: { color: colors.foreground, fontSize: fontSizes.title, fontWeight: '700' },
  coins: { color: colors.foreground, fontSize: fontSizes.section, fontWeight: '700' },
  price: { color: colors.foreground, fontSize: fontSizes.section, fontWeight: '700' },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.75)' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  sheetContent: { padding: spacing.xxl, gap: spacing.xl },
});
