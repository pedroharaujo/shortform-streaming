import type { JSX } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from './theme';

/** Decorative coin shared by wallet access and store product cards. */
export function CoinIcon({ size = 22 }: { readonly size?: number }): JSX.Element {
  const inset = Math.round(size * 0.65);
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.coin, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <View style={[styles.inset, { width: inset, height: inset, borderRadius: inset / 2 }]}>
        <View
          style={{
            backgroundColor: colors.coinInk,
            width: Math.max(2, Math.round(size / 12)),
            height: Math.round(size / 3),
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  coin: {
    backgroundColor: colors.coin,
    borderColor: colors.coinRim,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inset: {
    borderColor: colors.coinInk,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
