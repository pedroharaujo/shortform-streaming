import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '../../ui/theme';
import { CatalogArtwork } from './CatalogArtwork';

/** Artwork behind the copy, with content-driven height for larger text sizes. */
export function CatalogHero({
  title,
  uri,
  compact = false,
  children,
}: {
  readonly title: string;
  readonly uri: string | null;
  readonly compact?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <View style={[styles.hero, compact && styles.compact]}>
      <View
        style={StyleSheet.absoluteFill}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <CatalogArtwork size="backdrop" title={title} uri={uri} />
        <View style={[StyleSheet.absoluteFill, styles.shade]} />
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 420,
    justifyContent: 'flex-end',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  compact: { minHeight: 320 },
  shade: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    experimental_backgroundImage:
      'linear-gradient(180deg, rgba(10, 10, 12, 0) 10%, rgba(10, 10, 12, 0.72) 58%, #0a0a0c 100%)',
  },
  content: { padding: spacing.xl, paddingTop: 130, gap: spacing.md },
});
