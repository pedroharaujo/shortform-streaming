import type { JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CatalogClient } from '../../api/catalog/types';
import { useMessages } from '../../localization/messages';
import { colors, fontSizes, minimumTouchTarget, radii, spacing } from '../../ui/theme';
import { CatalogFetchStatus } from './CatalogFetchStatus';
import { CatalogHero } from './CatalogHero';
import { useCatalogEpisode } from './useCatalog';

export interface EpisodeSelectedScreenProps {
  readonly client: CatalogClient;
  readonly episodeId: string;
  readonly onBack: () => void;
  readonly onPlay: (episodeId: string) => void;
}

export function EpisodeSelectedScreen({
  client,
  episodeId,
  onBack,
  onPlay,
}: EpisodeSelectedScreenProps): JSX.Element {
  const { state, refresh } = useCatalogEpisode(client, episodeId);
  const messages = useMessages();

  return (
    <SafeAreaView style={styles.container} testID="episode-selected-screen">
      <Pressable
        accessibilityLabel={messages.common.back}
        accessibilityRole="button"
        onPress={onBack}
        style={styles.back}
        testID="episode-selected-back"
      >
        <Text style={styles.backLabel}>‹ {messages.common.back}</Text>
      </Pressable>

      <CatalogFetchStatus
        errorKind={state.phase === 'error' ? state.kind : undefined}
        loadingAccessibilityLabel={messages.catalog.episodeLoadingLabel}
        loadingText={messages.catalog.episodeLoading}
        onRetry={refresh}
        phase={state.phase}
        testIDPrefix="episode-selected"
      />

      {state.phase === 'not-found' ? (
        <View
          accessibilityLiveRegion="polite"
          style={styles.centered}
          testID="episode-selected-not-found"
        >
          <Text style={styles.body}>{messages.catalog.episodeNotAvailable}</Text>
        </View>
      ) : null}

      {state.phase === 'loaded' ? (
        <ScrollView
          contentContainerStyle={styles.content}
          style={styles.scroll}
          testID="episode-selected"
        >
          <CatalogHero compact title={state.episode.title} uri={null}>
            <Text accessibilityRole="header" style={styles.kicker}>
              {messages.catalog.selectedEpisode}
            </Text>
            <Text style={styles.title}>{state.episode.title}</Text>
          </CatalogHero>
          <Text style={styles.synopsis}>{state.episode.synopsis}</Text>
          <Text style={styles.metadata}>
            {messages.catalog.season(state.episode.season_number)} ·{' '}
            {messages.catalog.episode(state.episode.order)} ·{' '}
            {messages.catalog.duration(state.episode.duration_seconds)}
          </Text>
          <Pressable
            accessibilityLabel={messages.common.play}
            accessibilityRole="button"
            onPress={() => onPlay(episodeId)}
            style={({ pressed }) => [styles.play, pressed && styles.pressed]}
            testID="episode-selected-play"
          >
            <Text style={styles.playLabel}>{messages.common.play}</Text>
          </Pressable>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginBottom: spacing.md,
    minHeight: minimumTouchTarget,
    minWidth: minimumTouchTarget,
    paddingHorizontal: spacing.lg,
  },
  backLabel: { color: colors.foreground, fontSize: fontSizes.body },
  body: { color: colors.foreground, fontSize: fontSizes.body, textAlign: 'center' },
  centered: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center' },
  container: {
    backgroundColor: colors.background,
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  content: { flexGrow: 1, paddingBottom: spacing.xxl },
  kicker: {
    color: colors.foreground,
    fontSize: fontSizes.label,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  play: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    justifyContent: 'center',
    marginTop: spacing.xl,
    minHeight: minimumTouchTarget,
    minWidth: minimumTouchTarget,
    paddingHorizontal: spacing.xl,
  },
  playLabel: {
    color: colors.onAccent,
    fontSize: fontSizes.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  metadata: { color: colors.muted, fontSize: fontSizes.caption, marginTop: spacing.lg },
  pressed: { opacity: 0.75 },
  synopsis: {
    color: colors.muted,
    fontSize: fontSizes.body,
    marginTop: spacing.lg,
    lineHeight: 24,
  },
  title: {
    color: colors.foreground,
    fontSize: fontSizes.display,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
});
