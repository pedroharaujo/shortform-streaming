import { useEffect, useState, type JSX } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PackPreviewClient } from '../../api/purchases/packPreviewClient';
import { useMessages } from '../../localization/messages';
import { ActionButton, panelStyles } from '../../ui/ScreenElements';
import { CoinPackPicker } from './CoinPackPicker';
import type { CheckoutOffer } from './types';
import { colors, fontSizes, radii, spacing } from '../../ui/theme';

/** Example euro price from a tier ID such as `coins_999`; real prices only come from Google Play. */
function examplePrice(productId: string): string {
  const cents = /(\d{2,6})$/.exec(productId)?.[1];
  return cents ? `\u20ac${(Number(cents) / 100).toFixed(2)}` : '\u2014';
}

// Admin packs with example prices only: no provider calls or wallet writes.
export function CoinPurchasePreview({
  client,
}: {
  readonly client: PackPreviewClient;
}): JSX.Element {
  const messages = useMessages();
  const copy = messages.purchasePreview;
  const [packs, setPacks] = useState<readonly CheckoutOffer[] | 'loading' | 'unavailable'>(
    'loading',
  );
  const [attempt, setAttempt] = useState(0);
  const [selection, setSelection] = useState<string | null>(null);
  const [step, setStep] = useState<'packs' | 'confirm' | 'complete'>('packs');
  const selected = Array.isArray(packs)
    ? packs.find((pack) => pack.productId === selection)
    : undefined;

  useEffect(() => {
    let current = true;
    void client.getPacks().then((result) => {
      if (!current) return;
      setPacks(
        result.outcome === 'ok'
          ? result.data.map((pack) => ({ ...pack, price: examplePrice(pack.productId) }))
          : 'unavailable',
      );
    });
    return () => {
      current = false;
    };
  }, [client, attempt]);

  if (!Array.isArray(packs)) {
    return (
      <View testID="purchase-preview-screen" style={styles.content}>
        <Text style={styles.muted}>{packs === 'loading' ? copy.loading : copy.unavailable}</Text>
        {packs === 'unavailable' ? (
          <ActionButton
            label={messages.common.retry}
            onPress={() => {
              setPacks('loading');
              setAttempt((value) => value + 1);
            }}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View testID="purchase-preview-screen">
      <View
        style={styles.content}
        accessibilityElementsHidden={step !== 'packs'}
        importantForAccessibility={step !== 'packs' ? 'no-hide-descendants' : 'auto'}
      >
        <CoinPackPicker
          offers={packs}
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
