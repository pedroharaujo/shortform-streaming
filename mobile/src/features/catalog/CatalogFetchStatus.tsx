import type { JSX } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export type CatalogFetchStatusPrefix = 'home' | 'series-detail' | 'episode-selected';

export interface CatalogFetchStatusProps {
  readonly phase: string;
  readonly loadingAccessibilityLabel: string;
  readonly loadingText: string;
  readonly errorMessage?: string | undefined;
  readonly onRetry: () => void;
  readonly testIDPrefix: CatalogFetchStatusPrefix;
}

export function CatalogFetchStatus({
  phase,
  loadingAccessibilityLabel,
  loadingText,
  errorMessage,
  onRetry,
  testIDPrefix,
}: CatalogFetchStatusProps): JSX.Element | null {
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
      <View style={styles.centered} testID={`${testIDPrefix}-error`}>
        <Text style={styles.body}>{errorMessage}</Text>
        <Pressable
          accessibilityLabel="Try again"
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.button}
          testID={`${testIDPrefix}-retry`}
        >
          <Text style={styles.buttonLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  body: { color: '#fafafa', fontSize: 16, textAlign: 'center' },
  button: {
    borderColor: '#3f3f46',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonLabel: { color: '#fafafa', fontSize: 16 },
  centered: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center' },
  muted: { color: '#a1a1aa', fontSize: 16 },
});
