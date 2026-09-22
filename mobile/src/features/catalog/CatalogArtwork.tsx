import { useState, type JSX } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { artworkPalettes, radii } from '../../ui/theme';

export interface CatalogArtworkProps {
  readonly title: string;
  readonly uri: string | null;
  readonly size: 'card' | 'hero' | 'backdrop';
}

export function CatalogArtwork({ title, uri, size }: CatalogArtworkProps): JSX.Element {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const frameStyle = styles[size];
  const palette =
    artworkPalettes[
      Array.from(title).reduce((sum, character) => sum + character.charCodeAt(0), 0) %
        artworkPalettes.length
    ]!;

  if (uri === null || uri === '' || uri === failedUri) {
    return (
      <View
        accessibilityLabel={title}
        accessibilityRole="image"
        style={[styles.fallback, frameStyle, { backgroundColor: palette.background }]}
        testID="catalog-artwork-fallback"
      >
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={StyleSheet.absoluteFill}
        >
          <View style={[styles.beam, { backgroundColor: palette.beam }]} />
          <View style={[styles.orbit, { borderColor: palette.glow }]} />
          <View style={[styles.sun, { backgroundColor: palette.glow }]} />
          <View style={[styles.horizon, { backgroundColor: palette.foreground }]} />
          <View style={[styles.tower, { backgroundColor: palette.foreground }]} />
          <View style={[styles.window, { backgroundColor: palette.glow }]} />
        </View>
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={title}
      accessibilityRole="image"
      onError={() => setFailedUri(uri)}
      source={{ uri }}
      resizeMode="cover"
      style={frameStyle}
      testID="catalog-artwork-image"
    />
  );
}

const styles = StyleSheet.create({
  backdrop: { width: '100%', height: '100%' },
  card: { borderRadius: radii.md, aspectRatio: 2 / 3, width: '100%' },
  fallback: {
    alignItems: 'center',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  beam: {
    position: 'absolute',
    width: '55%',
    height: '160%',
    top: '-25%',
    left: '35%',
    opacity: 0.5,
    transform: [{ rotate: '32deg' }],
  },
  orbit: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 1,
    top: '-15%',
    right: '-20%',
    opacity: 0.35,
  },
  sun: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    right: '15%',
    top: '16%',
  },
  horizon: {
    position: 'absolute',
    width: '160%',
    height: '70%',
    bottom: '-42%',
    left: '-20%',
    transform: [{ rotate: '-22deg' }],
  },
  tower: {
    position: 'absolute',
    width: '24%',
    height: '65%',
    bottom: '-8%',
    left: '20%',
    borderTopLeftRadius: 70,
    borderTopRightRadius: 70,
    transform: [{ rotate: '12deg' }],
  },
  window: {
    position: 'absolute',
    width: 3,
    height: '22%',
    bottom: '7%',
    left: '32%',
    opacity: 0.6,
    transform: [{ rotate: '12deg' }],
  },
  hero: {
    alignSelf: 'stretch',
    borderRadius: radii.lg,
    aspectRatio: 1,
    maxHeight: 440,
    width: '100%',
  },
});
