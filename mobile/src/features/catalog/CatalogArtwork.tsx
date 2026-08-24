import { useState, type JSX } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

export interface CatalogArtworkProps {
  readonly title: string;
  readonly uri: string | null;
  readonly size: 'card' | 'hero';
}

export function CatalogArtwork({ title, uri, size }: CatalogArtworkProps): JSX.Element {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const frameStyle = size === 'hero' ? styles.hero : styles.card;
  const initial = title.trim().charAt(0) || '?';

  if (uri === null || uri === '' || uri === failedUri) {
    return (
      <View
        accessibilityLabel={title}
        accessibilityRole="image"
        style={[styles.fallback, frameStyle]}
        testID="catalog-artwork-fallback"
      >
        <Text style={styles.fallbackLabel}>{initial}</Text>
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={title}
      accessibilityRole="image"
      onError={() => setFailedUri(uri)}
      source={{ uri }}
      style={frameStyle}
      testID="catalog-artwork-image"
    />
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 8, height: 160, width: 120 },
  fallback: {
    alignItems: 'center',
    backgroundColor: '#18181b',
    justifyContent: 'center',
  },
  fallbackLabel: { color: '#a1a1aa', fontSize: 28, fontWeight: '600' },
  hero: { alignSelf: 'stretch', borderRadius: 8, height: 220, width: '100%' },
});
