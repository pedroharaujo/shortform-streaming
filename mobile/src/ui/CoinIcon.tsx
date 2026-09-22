import type { JSX } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from './theme';

/** Decorative coin shared by wallet access, tabs and store product cards. */
export function CoinIcon({
  size = 22,
  tone = 'gold',
}: {
  readonly size?: number;
  /** Gold for selected / store; muted outline matches other unselected tab glyphs. */
  readonly tone?: 'gold' | 'muted';
}): JSX.Element {
  const inset = Math.round(size * 0.65);
  const fill = tone === 'gold' ? colors.coin : 'transparent';
  const rim = tone === 'gold' ? colors.coinRim : colors.muted;
  const mark = tone === 'gold' ? colors.coinInk : colors.muted;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.coin,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fill,
          borderColor: rim,
        },
      ]}
    >
      <View
        style={[
          styles.inset,
          { width: inset, height: inset, borderRadius: inset / 2, borderColor: mark },
        ]}
      >
        <View
          style={{
            backgroundColor: mark,
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
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inset: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
