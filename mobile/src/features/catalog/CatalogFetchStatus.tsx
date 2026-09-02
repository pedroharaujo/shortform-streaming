import type { JSX } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useMessages } from '../../localization/messages';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';

export type CatalogFetchStatusPrefix = 'home' | 'series-detail' | 'episode-selected';

export interface CatalogFetchStatusProps {
  readonly phase: string;
  readonly loadingAccessibilityLabel: string;
  readonly loadingText: string;
  readonly errorKind?: 'request' | 'unreachable' | undefined;
  readonly onRetry: () => void;
  readonly testIDPrefix: CatalogFetchStatusPrefix;
}

export function CatalogFetchStatus({
  phase,
  loadingAccessibilityLabel,
  loadingText,
  errorKind,
  onRetry,
  testIDPrefix,
}: CatalogFetchStatusProps): JSX.Element | null {
  const messages = useMessages();
  const errorMessage =
    errorKind === 'unreachable' ? messages.catalog.unreachable : messages.catalog.requestFailed;

  if (phase === 'loading') {
    return (
      <View
        accessibilityLiveRegion="polite"
        style={styles.centered}
        testID={`${testIDPrefix}-loading`}
      >
        <ActivityIndicator accessibilityLabel={loadingAccessibilityLabel} />
        <Text style={styles.muted}>{loadingText}</Text>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View
        accessibilityLiveRegion="assertive"
        style={styles.centered}
        testID={`${testIDPrefix}-error`}
      >
        <Text style={styles.body}>{errorMessage}</Text>
        <Pressable
          accessibilityLabel={messages.common.retry}
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.button}
          testID={`${testIDPrefix}-retry`}
        >
          <Text style={styles.buttonLabel}>{messages.common.retry}</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  body: { color: colors.foreground, fontSize: fontSizes.body, textAlign: 'center' },
  button: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: minimumTouchTarget,
    minWidth: minimumTouchTarget,
    paddingHorizontal: spacing.xl,
  },
  buttonLabel: { color: colors.foreground, fontSize: fontSizes.body, textAlign: 'center' },
  centered: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center' },
  muted: { color: colors.muted, fontSize: fontSizes.body },
});
